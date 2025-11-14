// ==================================================
// MISS IRA BOT — FINAL INDEX.JS (CLEAN & STABLE)
// ==================================================

const { Telegraf } = require("telegraf");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");
const moment = require("moment-timezone");
require("dotenv").config();

// CONFIG
const config = require("./config.json");

// MAIN DOWNLOADER (must export function)
const downloadAudio = require("./utils/download");

// ==================================================
// OPTIONAL MONGO
// ==================================================
let useMongo = false;
let mongoose, UserModel;

if (process.env.MONGO_URI) {
  try {
    mongoose = require("mongoose");
    mongoose.connect(process.env.MONGO_URI)
      .then(() => {
        console.log("🗄️ MongoDB connected");
        useMongo = true;
      })
      .catch(err => {
        console.log("❌ Mongo error:", err.message);
        useMongo = false;
      });
  } catch {
    console.log("⚠️ mongoose missing → skipping Mongo");
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
    last_active: String,
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
// FILE-BASED USER DB (if Mongo disabled)
// ==================================================
const DB_DIR = path.join(__dirname, "database");
const DB_FILE = path.join(DB_DIR, "users.json");
fs.ensureDirSync(DB_DIR);
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");

const loadUsers  = () => {
  try { return JSON.parse(fs.readFileSync(DB_FILE)); }
  catch { return []; }
};

const saveUsers = data =>
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// ==================================================
// HELPERS
// ==================================================
const now = () =>
  moment().tz(config.timezone || "Asia/Dhaka").format("DD/MM/YYYY HH:mm:ss");

const esc = txt =>
  String(txt)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");

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
    last_active: now(),
  };

  try {
    if (useMongo && UserModel) {
      await UserModel.findOneAndUpdate({ id: item.id }, item, { upsert: true });
    } else {
      let list = loadUsers();
      const exists = list.find(x => x.id === item.id);

      if (!exists) list.push(item);
      else exists.last_active = now();

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
  console.log("❌ TELEGRAM_BOT_TOKEN missing!");
  process.exit(1);
}

const bot = new Telegraf(TOKEN);

// Bot memory
global.commands = new Map();
global.songSessions = {};

// ==================================================
// LOAD COMMANDS
// ==================================================
const CMD_DIR = path.join(__dirname, "commands");
fs.ensureDirSync(CMD_DIR);

for (const file of fs.readdirSync(CMD_DIR)) {
  if (!file.endsWith(".js")) continue;

  try {
    const cmd = require(path.join(CMD_DIR, file));
    if (cmd.name && cmd.run) {
      global.commands.set(config.prefix + cmd.name, cmd);
      console.log("✅ Loaded command:", cmd.name);
    }
  } catch (err) {
    console.log("⚠️ Failed to load:", file, err.message);
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
    const txt = (ctx.message.text || "").trim();
    if (!txt.startsWith(config.prefix)) return;

    await saveUser(ctx);

    const parts = txt.slice(config.prefix.length).trim().split(/\s+/);
    const cmd = parts.shift();
    const args = parts;

    const handler = global.commands.get(config.prefix + cmd);
    if (!handler) return ctx.reply("❌ Unknown command");

    await handler.run(ctx, args);

  } catch (err) {
    console.log("❌ text handler error:", err.message);
    ctx.reply("⚠️ Something went wrong.");
  }
});

// ==================================================
// CALLBACK HANDLER (SONG SYSTEM)
// ==================================================
bot.on("callback_query", async ctx => {
  try {
    const data = ctx.callbackQuery.data;
    if (!data) return;

    await ctx.answerCbQuery();

    const [action, uid, index] = data.split(":");
    const me = String(ctx.from.id);

    if (uid !== me)
      return ctx.answerCbQuery("Not your menu!", { show_alert: true });

    const session = global.songSessions[uid];
    if (!session)
      return ctx.answerCbQuery("Session expired!", { show_alert: true });

    if (action === "song_cancel") {
      delete global.songSessions[uid];
      try { await ctx.editMessageReplyMarkup(); } catch {}
      return ctx.reply("❌ Cancelled");
    }

    if (action === "song_play") {
      const i = Number(index);
      const video = session.videos[i];
      if (!video) return;

      try { await ctx.editMessageReplyMarkup(); } catch {}

      await ctx.reply(
        `⏳ Preparing: <b>${esc(video.title)}</b>`,
        { parse_mode: "HTML" }
      );

      // DOWNLOAD → multi-engine
      const filename = `dl_${uid}_${Date.now()}.mp3`;
      const filepath = path.join(__dirname, "tmp", filename);

      try {
        await downloadAudio(video.url, filepath);

        if (video.thumbnail) {
          await ctx.replyWithPhoto(
            { url: video.thumbnail },
            {
              caption: `<b>${esc(video.title)}</b>\n🎤 ${esc(video.author)}`,
              parse_mode: "HTML"
            }
          );
        }

        await ctx.replyWithAudio(
          { source: fs.createReadStream(filepath) },
          {
            title: video.title,
            performer: video.author || ""
          }
        );

      } catch (err) {
        console.log("❌ DOWNLOAD ERROR:", err.message);
        await ctx.reply("❌ Failed to download from all engines.");
      }

      try { fs.unlinkSync(filepath); } catch {}

      return;
    }
  } catch (err) {
    console.log("❌ callback error:", err.message);
    ctx.answerCbQuery("Error!", { show_alert: true });
  }
});

// ==================================================
// EXPRESS SERVER
// ==================================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) =>
  res.send(`<h2>${config.botname}</h2><p>Bot running</p>`)
);

app.get("/status", async (req, res) => {
  let total = 0;
  if (useMongo && UserModel) total = await UserModel.countDocuments();
  else total = loadUsers().length;

  res.send(`
    <h1>${esc(config.botname)} Status</h1>
    <p>Time: ${now()}</p>
    <p>Users: ${total}</p>
  `);
});

// ==================================================
// RUN BOT (WEBHOOK OR POLLING)
// ==================================================
(async () => {
  const external = process.env.RENDER_EXTERNAL_URL || process.env.EXTERNAL_URL;
  const hook = `/bot${TOKEN}`;

  try {
    if (external) {
      await bot.telegram.setWebhook(external + hook);
      app.use(bot.webhookCallback(hook));
      console.log("🚀 Webhook mode:", external + hook);
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
  console.log(`🌍 Web dashboard running → PORT ${PORT}`)
);
