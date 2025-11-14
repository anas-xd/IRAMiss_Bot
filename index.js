// ==================================================
// MISS IRA BOT — FINAL INDEX.JS (YTDLP + SPOTIFY SAFE)
// ==================================================

const { Telegraf } = require("telegraf");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");
const moment = require("moment-timezone");
require("dotenv").config();

// CONFIG
const config = require("./config.json");

// NEW DOWNLOADER (yt-dlp + spotifydl-core)
const downloadAudio = require("./utils/download");

// ==================================================
// OPTIONAL MONGO
// ==================================================
let useMongo = false;
let mongoose, UserModel;

if (process.env.MONGO_URI) {
  try {
    mongoose = require("mongoose");

    mongoose
      .connect(process.env.MONGO_URI)
      .then(() => {
        console.log("🗄️ MongoDB connected");
        useMongo = true;
      })
      .catch(err => {
        console.log("❌ Mongo error:", err.message);
        useMongo = false;
      });
  } catch {
    console.log("⚠️ Missing mongoose → skipping database");
  }
}

if (useMongo) {
  const userSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    first_name: String,
    last_name: String,
    username: String,
    is_premium: Boolean,
    language_code: String,
    added_at: String,
    last_active: String
  });

  UserModel = mongoose.model("User", userSchema);
}

// ==================================================
// LANGUAGE
// ==================================================
let lang;
try {
  lang = require(`./languages/${config.language}.lang.js`);
} catch {
  lang = require("./languages/en.lang.js");
  console.log("⚠️ Language fallback → English");
}

// ==================================================
// FILE-BASED USER DB (fallback)
// ==================================================
const DB_DIR = path.join(__dirname, "database");
const DB_FILE = path.join(DB_DIR, "users.json");
fs.ensureDirSync(DB_DIR);
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");

const loadUsers = () => {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE));
  } catch {
    return [];
  }
};

const saveUsers = data =>
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// ==================================================
// HELPERS
// ==================================================
const now = () =>
  moment().tz(config.timezone || "Asia/Dhaka").format("DD/MM/YYYY HH:mm:ss");

const esc = t =>
  String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// ==================================================
// SAVE USER FUNCTION
// ==================================================
async function saveUser(ctx) {
  const u = ctx.from;
  if (!u || !u.id) return;

  const item = {
    id: String(u.id),
    first_name: u.first_name || "",
    last_name: u.last_name || "",
    username: u.username ? "@" + u.username : "",
    is_premium: !!u.is_premium,
    language_code: u.language_code || "",
    added_at: now(),
    last_active: now()
  };

  try {
    if (useMongo && UserModel) {
      await UserModel.findOneAndUpdate({ id: item.id }, item, {
        upsert: true
      });
    } else {
      let list = loadUsers();
      const found = list.find(x => x.id === item.id);

      if (!found) list.push(item);
      else found.last_active = now();

      saveUsers(list);
    }
  } catch (err) {
    console.log("❌ saveUser:", err.message);
  }
}

// ==================================================
// INIT BOT
// ==================================================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.log("❌ Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const bot = new Telegraf(TOKEN);
global.commands = new Map();
global.songSessions = {};

// ==================================================
// LOAD COMMANDS
// ==================================================
const CMD_DIR = path.join(__dirname, "commands");
fs.ensureDirSync(CMD_DIR);

for (const file of fs.readdirSync(CMD_DIR)) {
  if (!file.endsWith(".js")) continue;

  const cmd = require(path.join(CMD_DIR, file));
  if (cmd.name && cmd.run) {
    global.commands.set(config.prefix + cmd.name, cmd);
    console.log("✅ Loaded command:", cmd.name);
  }
}

// ==================================================
// /start
// ==================================================
bot.start(async ctx => {
  await saveUser(ctx);

  const name = ctx.from?.first_name || "User";

  const text = lang.startMessage
    ? lang.startMessage(name, config.botname, config.prefix)
    : `👋 Hello ${name}!`;

  return ctx.reply(text, { parse_mode: "Markdown" });
});

// ==================================================
// MAIN TEXT HANDLER
// ==================================================
bot.on("text", async ctx => {
  try {
    const txt = ctx.message.text.trim();
    if (!txt.startsWith(config.prefix)) return;

    await saveUser(ctx);

    const parts = txt.slice(config.prefix.length).trim().split(/\s+/);
    const cmd = global.commands.get(config.prefix + parts[0]);

    if (!cmd) return ctx.reply("❌ Unknown command");

    await cmd.run(ctx, parts.slice(1));
  } catch (err) {
    console.log("❌ text handler:", err.message);
    ctx.reply("⚠️ Error occurred");
  }
});

// ==================================================
// CALLBACK HANDLER (Download song)
// ==================================================
bot.on("callback_query", async ctx => {
  try {
    const data = ctx.callbackQuery.data;
    if (!data) return;

    await ctx.answerCbQuery();

    const [action, uid, index] = data.split(":");
    const me = String(ctx.from.id);

    if (uid !== me)
      return ctx.answerCbQuery("❌ Not your menu!", { show_alert: true });

    const session = global.songSessions[uid];
    if (!session)
      return ctx.answerCbQuery("❌ Session expired!", { show_alert: true });

    if (action === "song_cancel") {
      delete global.songSessions[uid];
      try {
        await ctx.editMessageReplyMarkup();
      } catch {}
      return ctx.reply("❌ Cancelled");
    }

    if (action === "song_play") {
      const video = session.videos[index];
      if (!video) return;

      await ctx.reply(`⏳ Preparing: <b>${esc(video.title)}</b>`, {
        parse_mode: "HTML"
      });

      const filename = `dl_${uid}_${Date.now()}.mp3`;
      const filepath = path.join(__dirname, "tmp", filename);

      try {
        await downloadAudio(video.url, filepath);

        await ctx.replyWithAudio(
          { source: fs.createReadStream(filepath) },
          { title: video.title, performer: video.author }
        );
      } catch (err) {
        console.log("❌ DOWNLOAD:", err.message);
        await ctx.reply("❌ Download failed");
      }

      try {
        fs.unlinkSync(filepath);
      } catch {}

      return;
    }
  } catch (err) {
    console.log("❌ callback:", err.message);
  }
});

// ==================================================
// EXPRESS SERVER
// ==================================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(`<h2>${config.botname}</h2><p>Bot is running.</p>`);
});

app.get("/status", async (req, res) => {
  let total = useMongo ? await UserModel.countDocuments() : loadUsers().length;

  res.send(`
    <h1>${esc(config.botname)} Status</h1>
    <p>Time: ${now()}</p>
    <p>Users: ${total}</p>
  `);
});

// ==================================================
// RUN BOT (WEBHOOK/POLLING)
// ==================================================
(async () => {
  const ext = process.env.RENDER_EXTERNAL_URL || process.env.EXTERNAL_URL;
  const hook = `/bot${TOKEN}`;

  try {
    if (ext) {
      await bot.telegram.setWebhook(ext + hook);
      app.use(bot.webhookCallback(hook));
      console.log("🚀 Webhook mode:", ext + hook);
    } else {
      await bot.launch();
      console.log("🚀 Polling mode");
    }
  } catch (err) {
    console.log("❌ Webhook failed → fallback polling");
    await bot.launch();
  }
})();

app.listen(PORT, () =>
  console.log(`🌍 Dashboard running → PORT ${PORT}`)
);
