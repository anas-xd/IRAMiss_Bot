// ====== MISS IRA BOT — Rebuilt index.js (WEBHOOK + POLLING + SONG READY) ======
const { Telegraf } = require("telegraf");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");
const moment = require("moment-timezone");
const ytdl = require("ytdl-core");
require("dotenv").config();

const config = require("./config.json");

// ====== Optional Mongo support ======
let useMongo = false;
let mongoose, UserModel = null;
if (process.env.MONGO_URI) {
  try {
    mongoose = require("mongoose");
    useMongo = true;
    mongoose
      .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(() => console.log("🗄️ MongoDB connected"))
      .catch((e) => { console.warn("❌ Mongo error:", e); useMongo = false; });
  } catch (e) {
    console.warn("⚠️ mongoose not available. Skipping Mongo support.");
    useMongo = false;
  }
}
if (useMongo && mongoose) {
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

// ====== Language loader (fallback to en) ======
let lang;
try { lang = require(`./languages/${config.language}.lang.js`); }
catch { lang = require("./languages/en.lang.js"); console.warn("⚠️ Language fallback to en"); }

// ====== File DB setup ======
const DB_DIR = path.join(__dirname, "database");
const DB_FILE = path.join(DB_DIR, "users.json");
fs.ensureDirSync(DB_DIR);
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]", "utf8");

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8") || "[]"); }
  catch (e) { fs.writeFileSync(DB_FILE, "[]", "utf8"); return []; }
}
function saveUsers(arr) { fs.writeFileSync(DB_FILE, JSON.stringify(arr, null, 2), "utf8"); }

// ====== Util helpers ======
const now = () => moment().tz(config.timezone || "Asia/Dhaka").format("DD/MM/YYYY HH:mm:ss");
function escapeHtml(s = "") { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// ====== Save user (file or mongo) ======
async function saveUser(ctx) {
  try {
    const u = ctx.from;
    if (!u || !u.id) return;
    const payload = {
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
      await UserModel.findOneAndUpdate({ id: payload.id }, payload, { upsert: true, setDefaultsOnInsert: true });
    } else {
      const users = loadUsers();
      const exist = users.find(x => x.id === payload.id);
      if (!exist) users.push(payload);
      else exist.last_active = now();
      saveUsers(users);
    }
  } catch (err) {
    console.error("❌ saveUser error:", err);
  }
}

// ====== Init bot ======
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN missing in environment. Exiting.");
  process.exit(1);
}
const bot = new Telegraf(BOT_TOKEN);

// global maps
global.commands = new Map();
global.songSessions = global.songSessions || {}; // { userId: { query, videos, createdAt } }

// ====== Commands loader ======
const COMMANDS_DIR = path.join(__dirname, "commands");
fs.ensureDirSync(COMMANDS_DIR);
fs.readdirSync(COMMANDS_DIR).forEach(file => {
  if (!file.endsWith(".js")) return;
  try {
    const cmd = require(path.join(COMMANDS_DIR, file));
    if (cmd && cmd.name && cmd.run) {
      global.commands.set((config.prefix || "/") + cmd.name, cmd);
      console.log(`✅ Loaded command: ${cmd.name}`);
    } else {
      console.warn(`⚠️ Skipped ${file} (missing name/run)`);
    }
  } catch (e) {
    console.error(`⚠️ Failed to load ${file}:`, e.message || e);
  }
});

// ====== Start handler ======
bot.start(async (ctx) => {
  await saveUser(ctx);
  const name = ctx.from?.first_name || "User";
  const welcome = lang.startMessage ? lang.startMessage(name, config.botname, config.prefix) : `👋 Hello ${name}! Use ${config.prefix}help`;
  return ctx.reply(welcome, { parse_mode: "Markdown" }).catch(()=>{});
});

// ====== Message handler (prefix only) ======
bot.on("text", async (ctx) => {
  try {
    const text = ctx.message && ctx.message.text ? ctx.message.text.trim() : "";
    if (!text.startsWith(config.prefix)) return;

    await saveUser(ctx);

    const parts = text.slice(config.prefix.length).trim().split(/\s+/);
    const cmdRaw = parts.shift();
    const args = parts;

    if (!cmdRaw) {
      const defaultCmd = global.commands.get((config.prefix || "/") + (process.env.DEFAULT_CMD || "help"));
      return defaultCmd ? defaultCmd.run(ctx, args) : ctx.reply(`Use ${config.prefix}help`);
    }

    const key = (config.prefix || "/") + cmdRaw;
    const command = global.commands.get(key);
    if (!command) return ctx.reply("❌ Unknown command");

    await command.run(ctx, args);
  } catch (err) {
    console.error("❌ Message handler error:", err);
    try { ctx.reply("⚠️ An error occurred."); } catch (e){}
  }
});

// ====== Helper: tmp dir and download ======
const TMP_DIR = path.join(__dirname, "tmp");
fs.ensureDirSync(TMP_DIR);

function tmpFile(name) { return path.join(TMP_DIR, `${name}_${Date.now()}`); }

function downloadYtToFile(url, outPath) {
  return new Promise((resolve, reject) => {
    try {
      const stream = ytdl(url, { filter: "audioonly", quality: "highestaudio" });
      const writer = fs.createWriteStream(outPath);
      stream.pipe(writer);
      stream.on("error", (e) => { try { writer.close(); } catch{}; reject(e); });
      writer.on("finish", () => resolve(outPath));
      writer.on("error", (e) => reject(e));
    } catch (e) {
      reject(e);
    }
  });
}

// ====== Callback query handler (song buttons) ======
bot.on("callback_query", async (ctx) => {
  try {
    const data = ctx.callbackQuery && ctx.callbackQuery.data ? ctx.callbackQuery.data : "";
    if (!data) return;
    await ctx.answerCbQuery(); // ack

    const [action, uid, idxStr] = data.split(":");
    const caller = String(ctx.from?.id || "");

    // simple security: buttons only for original searcher
    if (uid !== caller) {
      return ctx.answerCbQuery("These buttons are for the user who searched.", { show_alert: true }).catch(()=>{});
    }

    const session = global.songSessions && global.songSessions[uid];
    if (!session) {
      return ctx.answerCbQuery("Session expired. Please search again.", { show_alert: true });
    }

    if (action === "song_cancel") {
      delete global.songSessions[uid];
      // try remove inline keyboard from message (if possible)
      try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch {}
      return ctx.reply("Cancelled ✅");
    }

    const idx = parseInt(idxStr, 10);
    if (isNaN(idx) || idx < 0 || idx >= (session.videos || []).length) {
      return ctx.answerCbQuery("Invalid selection.", { show_alert: true });
    }

    const video = session.videos[idx];

    if (action === "song_play" || action === "song_download") {
      // edit original message to remove buttons (optional)
      try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch {}

      // notify preparing
      await ctx.reply(`⏳ Preparing: ${escapeHtml(video.title)}`, { parse_mode: "HTML" }).catch(()=>{});

      // download to tmp
      const out = tmpFile(`song_${uid}_${idx}.mp3`);
      try {
        await downloadYtToFile(video.url || `https://www.youtube.com/watch?v=${video.videoId || video.id}`, out);
        // send photo with metadata (if thumbnail exists)
        const captionParts = [];
        captionParts.push(`<b>${escapeHtml(video.title)}</b>`);
        if (video.author || video.authorName) captionParts.push(`🎤 <b>Artist/Channel:</b> ${escapeHtml(video.author?.name || video.authorName || "")}`);
        if (video.timestamp) captionParts.push(`⏱ <b>Duration:</b> ${escapeHtml(video.timestamp)}`);
        if (video.views) captionParts.push(`👁 <b>Views:</b> ${String(video.views).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`);

        const caption = captionParts.join("\n");

        if (video.thumbnail) {
          try {
            await ctx.replyWithPhoto({ url: video.thumbnail }, { caption, parse_mode: "HTML" });
          } catch {
            await ctx.replyWithHTML(caption);
          }
        } else {
          await ctx.replyWithHTML(caption);
        }

        // send audio
        await ctx.replyWithAudio({ source: fs.createReadStream(out) }, { title: video.title, performer: video.author?.name || "" });

        // cleanup file
        try { fs.unlinkSync(out); } catch {}
      } catch (e) {
        console.error("❌ Download/send audio error:", e);
        try { await ctx.reply("❌ Failed to download/send audio."); } catch {}
      }
      return;
    }

    if (action === "song_lyrics") {
      // attempt fetch from lyrics.ovh
      const videoTitle = video.title || "";
      let artist = "";
      let title = videoTitle;
      if (videoTitle.includes(" - ")) {
        const parts = videoTitle.split(" - ");
        artist = parts[0];
        title = parts.slice(1).join(" - ");
      } else {
        artist = video.author?.name || "";
      }

      try {
        const res = await require("axios").get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`).catch(()=>null);
        if (res && res.data && res.data.lyrics) {
          const lyrics = res.data.lyrics;
          if (lyrics.length > 3000) {
            const tfile = tmpFile(`lyrics_${uid}.txt`);
            fs.writeFileSync(tfile, lyrics, "utf8");
            await ctx.replyWithDocument({ source: tfile, filename: `${title}_lyrics.txt` });
            try { fs.unlinkSync(tfile); } catch {}
          } else {
            await ctx.replyWithHTML(`<b>Lyrics — ${escapeHtml(title)}</b>\n\n${escapeHtml(lyrics)}`);
          }
        } else {
          await ctx.reply("ℹ️ Lyrics not found (lyrics.ovh).");
        }
      } catch (e) {
        console.error("lyrics error:", e);
        try { await ctx.reply("❌ Failed to fetch lyrics."); } catch {}
      }
      return;
    }

    // unknown action
    return ctx.answerCbQuery("Unknown action.", { show_alert: true });
  } catch (err) {
    console.error("❌ callback_query handler error:", err);
    try { await ctx.answerCbQuery("An error occurred."); } catch {}
  }
});

// ====== Express server (serve index.html + status) ======
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  const users = loadUsers();
  return res.send(`<h2>${config.botname} — running</h2><p>Users: ${Array.isArray(users) ? users.length : users}</p>`);
});

app.get("/status", async (req, res) => {
  let total = 0;
  if (useMongo && UserModel) total = await UserModel.countDocuments();
  else total = loadUsers().length;
  res.send(`<h1>${escapeHtml(config.botname)} Status</h1><p>Time: ${now()}</p><p>Users: ${total}</p>`);
});

// ====== Launch: webhook on Render (RENDER_EXTERNAL_URL) or polling fallback ======
(async () => {
  const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.EXTERNAL_URL || "";
  const hookPath = `/bot${BOT_TOKEN}`;

  try {
    if (externalUrl) {
      await bot.telegram.deleteWebhook().catch(()=>{});
      await bot.telegram.setWebhook(externalUrl + hookPath);
      app.use(bot.webhookCallback(hookPath));
      console.log("🚀 Webhook set:", externalUrl + hookPath);
    } else {
      await bot.launch();
      console.log("🚀 Bot launched (polling mode)");
    }
  } catch (err) {
    console.error("❌ Bot launch failed, trying fallback to polling:", err);
    try { await bot.launch(); console.log("⚠️ Fallback polling started"); } catch (e) { console.error("❌ Final fallback failed", e); process.exit(1); }
  }
})();

app.listen(PORT, () => console.log(`🌍 Web server active on port ${PORT}`));
