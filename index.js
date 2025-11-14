// ==================================================
// MISS IRA BOT — FINAL INDEX.JS (5-ENGINE SONG BOT)
// ==================================================

const { Telegraf } = require("telegraf");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");
const moment = require("moment-timezone");
const axios = require("axios");
require("dotenv").config();

// CONFIG
const config = require("./config.json");

// DOWNLOAD ENGINE
const downloadAudio = require("./utils/download");

// ==================================================
// OPTIONAL MONGO
// ==================================================
let useMongo = false;
let mongoose, UserModel;

if (process.env.MONGO_URI) {
  try {
    mongoose = require("mongoose");
    useMongo = true;

    mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    .then(() => console.log("🗄️ MongoDB connected"))
    .catch((e) => {
      console.log("❌ Mongo error:", e.message);
      useMongo = false;
    });

  } catch {
    console.log("⚠️ mongoose missing — skipping Mongo");
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
// LANGUAGE LOADER
// ==================================================
let lang;
try {
  lang = require(`./languages/${config.language}.lang.js`);
} catch (err) {
  lang = require("./languages/en.lang.js");
  console.log("⚠️ Language fallback → EN");
}

// ==================================================
// FILE DB
// ==================================================
const DB_DIR = path.join(__dirname, "database");
const DB_FILE = path.join(DB_DIR, "users.json");

fs.ensureDirSync(DB_DIR);
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return []; }
}

function saveUsers(arr) {
  fs.writeFileSync(DB_FILE, JSON.stringify(arr, null, 2));
}

// ==================================================
// HELPERS
// ==================================================
const now = () => moment().tz(config.timezone || "Asia/Dhaka").format("DD/MM/YYYY HH:mm:ss");

const escape = (s="") =>
  String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

// ==================================================
// SAVE USER
// ==================================================
async function saveUser(ctx) {
  try {
    if (!ctx.from?.id) return;

    const u = ctx.from;

    const data = {
      id: String(u.id),
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      username: u.username ? `@${u.username}` : "",
      is_premium: !!u.is_premium,
      language_code: u.language_code || "",
      added_at: now(),
      last_active: now()
    };

    if (useMongo && UserModel) {
      await UserModel.findOneAndUpdate({ id: data.id }, data, { upsert: true });
    } else {
      const users = loadUsers();
      const exists = users.find(x => x.id === data.id);

      if (!exists) users.push(data);
      else exists.last_active = now();

      saveUsers(users);
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

global.commands = new Map();
global.songSessions = {}; // { userId: { videos, createdAt } }

// ==================================================
// LOAD COMMANDS
// ==================================================
const COMMANDS_DIR = path.join(__dirname, "commands");
fs.ensureDirSync(COMMANDS_DIR);

fs.readdirSync(COMMANDS_DIR).forEach(file => {
  if (!file.endsWith(".js")) return;

  try {
    const cmd = require(path.join(COMMANDS_DIR, file));
    if (cmd?.name && cmd?.run) {
      global.commands.set(config.prefix + cmd.name, cmd);
      console.log("✅ Command loaded:", cmd.name);
    }
  } catch (err) {
    console.log("⚠️ Failed to load", file, err.message);
  }
});

// ==================================================
// START COMMAND
// ==================================================
bot.start(async ctx => {
  await saveUser(ctx);
  const name = ctx.from?.first_name || "User";

  const welcome = lang.startMessage
    ? lang.startMessage(name, config.botname, config.prefix)
    : `👋 Hello ${name}! Use ${config.prefix}help`;

  return ctx.reply(welcome, { parse_mode: "Markdown" });
});

// ==================================================
// MESSAGE HANDLER (PREFIX)
// ==================================================
bot.on("text", async ctx => {
  try {
    const txt = ctx.message?.text?.trim() || "";
    if (!txt.startsWith(config.prefix)) return;

    await saveUser(ctx);

    const parts = txt.slice(config.prefix.length).trim().split(/\s+/);
    const cmdName = parts.shift();
    const args = parts;

    if (!cmdName) {
      const defCmd = global.commands.get(config.prefix + "help");
      return defCmd ? defCmd.run(ctx, args) : ctx.reply("Use /help");
    }

    const command = global.commands.get(config.prefix + cmdName);
    if (!command) return ctx.reply("❌ Unknown command");

    await command.run(ctx, args);

  } catch (e) {
    console.log("❌ Handler error:", e.message);
    ctx.reply("⚠️ Error occurred.");
  }
});

// ==================================================
// CALLBACK HANDLER (SONG SYSTEM)
// ==================================================
bot.on("callback_query", async ctx => {
  try {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    await ctx.answerCbQuery();
    const [action, uid, index] = data.split(":");
    const caller = String(ctx.from?.id);

    if (uid !== caller)
      return ctx.answerCbQuery("Not your menu!", { show_alert: true });

    const session = global.songSessions[uid];
    if (!session) {
      return ctx.answerCbQuery("Session expired!", { show_alert: true });
    }

    if (action === "song_cancel") {
      delete global.songSessions[uid];
      try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch {}
      return ctx.reply("❌ Cancelled");
    }

    const i = parseInt(index);
    const video = session.videos[i];
    if (!video) return ctx.answerCbQuery("Invalid selection!");

    if (action === "song_play") {
      try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch {}

      await ctx.reply(`⏳ Preparing ${escape(video.title)}...`, { parse_mode: "HTML" });

      const outPath = path.join(__dirname, "tmp", `dl_${uid}_${Date.now()}.mp3`);
      try {
        await downloadAudio(video.url, outPath);

        if (video.thumbnail) {
          await ctx.replyWithPhoto(
            { url: video.thumbnail },
            {
              caption: `<b>${escape(video.title)}</b>\n🎤 ${escape(video.author || "")}`,
              parse_mode: "HTML"
            }
          );
        }

        await ctx.replyWithAudio(
          { source: fs.createReadStream(outPath) },
          { title: video.title, performer: video.author || "" }
        );

      } catch (err) {
        console.log("❌ FINAL DOWNLOAD ERROR:", err.message);
        await ctx.reply("❌ Failed to download from all engines.");
      }

      try { fs.unlinkSync(outPath); } catch {}
      return;
    }

  } catch (err) {
    console.log("❌ callback error:", err.message);
    ctx.answerCbQuery("Error!");
  }
});

// ==================================================
// EXPRESS SERVER
// ==================================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  const users = loadUsers();
  res.send(`<h2>${config.botname}</h2><p>Users: ${users.length}</p>`);
});

app.get("/status", async (req, res) => {
  let total = 0;
  if (useMongo && UserModel) total = await UserModel.countDocuments();
  else total = loadUsers().length;

  res.send(`
    <h1>${escape(config.botname)} Status</h1>
    <p>Time: ${now()}</p>
    <p>Users: ${total}</p>
  `);
});

// ==================================================
// WEBHOOK OR POLLING
// ==================================================
(async () => {
  const external = process.env.RENDER_EXTERNAL_URL || process.env.EXTERNAL_URL || "";
  const hook = `/bot${TOKEN}`;

  try {
    if (external) {
      await bot.telegram.setWebhook(external + hook);
      app.use(bot.webhookCallback(hook));
      console.log("🚀 Webhook:", external + hook);
    } else {
      await bot.launch();
      console.log("🚀 Polling mode");
    }
  } catch (err) {
    console.log("❌ Launch failed → fallback polling");
    await bot.launch();
  }
})();

app.listen(PORT, () => console.log(`🌍 Web running on port ${PORT}`));
