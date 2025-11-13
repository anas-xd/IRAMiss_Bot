// ====== MISS IRA BOT (FULL REBUILD: AUTO WEBHOOK + POLLING + OPTIONAL MONGO) ======
const { Telegraf } = require("telegraf");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");
const moment = require("moment-timezone");
require("dotenv").config();

// ====== CONFIG ======
const config = require("./config.json");

// ====== OPTIONAL MONGOOSE ======
let useMongo = false;
let mongoose; // declared if used
if (process.env.MONGO_URI) {
  try {
    mongoose = require("mongoose");
    useMongo = true;
    mongoose
      .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(() => console.log("🗄️ Connected to MongoDB"))
      .catch((e) => { console.error("❌ MongoDB connection failed:", e); useMongo = false; });
  } catch (e) {
    console.warn("⚠️ mongoose not installed. To use Mongo, run: npm i mongoose");
    useMongo = false;
  }
}

// ====== LANGUAGE LOADER ======
let lang;
try { lang = require(`./languages/${config.language}.lang.js`); }
catch { lang = require("./languages/en.lang.js"); }

// ====== DATABASE (file fallback) ======
const dbDir = path.join(__dirname, "database");
const dbFile = path.join(dbDir, "users.json");
fs.ensureDirSync(dbDir);
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, "[]", "utf8");

function safeLoadUsers() {
  try {
    const raw = fs.readFileSync(dbFile, "utf8") || "[]";
    return JSON.parse(raw);
  } catch (e) {
    fs.writeFileSync(dbFile, "[]", "utf8");
    return [];
  }
}

function safeSaveUsers(arr) {
  try { fs.writeFileSync(dbFile, JSON.stringify(arr, null, 2), "utf8"); }
  catch (e) { console.error("❌ Failed to write users.json", e); }
}

// If using Mongo, define a simple user schema
let UserModel = null;
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

// ====== HELPERS ======
function now() { return moment().tz(config.timezone || "Asia/Dhaka").format("DD/MM/YYYY HH:mm:ss"); }

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
      const users = safeLoadUsers();
      const exist = users.find(x => x.id === payload.id);
      if (!exist) users.push(payload);
      else { exist.last_active = now(); exist.username = payload.username; exist.first_name = payload.first_name; }
      safeSaveUsers(users);
    }
  } catch (e) { console.error("❌ saveUser error", e); }
}

// ====== BOT SETUP ======
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) { console.error("❌ TELEGRAM_BOT_TOKEN missing in .env"); process.exit(1); }
const bot = new Telegraf(BOT_TOKEN);
global.commands = new Map();

// ====== COMMAND LOADER ======
const commandsPath = path.join(__dirname, "commands");
fs.readdirSync(commandsPath).forEach(file => {
  if (!file.endsWith(".js")) return;
  try {
    const cmd = require(path.join(commandsPath, file));
    if (cmd.name && cmd.run) {
      global.commands.set((config.prefix || "/") + cmd.name, cmd);
      console.log(`✅ Loaded command: ${cmd.name}`);
    }
  } catch (e) { console.error(`⚠️ Failed to load ${file}:`, e); }
});

// ====== START + TEXT HANDLER (prefix-only) ======
bot.start(async (ctx) => {
  await saveUser(ctx);
  const name = ctx.from?.first_name || "User";
  const m = (lang.startMessage) ? lang.startMessage(name, config.botname, config.prefix) : `Hello ${name}! Use ${config.prefix}help`;
  return ctx.reply(m, { parse_mode: "Markdown" });
});

bot.on("text", async (ctx) => {
  const text = (ctx.message && ctx.message.text) ? ctx.message.text.trim() : "";
  if (!text.startsWith(config.prefix)) return; // only prefix commands
  await saveUser(ctx);

  const [cmdNameRaw, ...rest] = text.slice(config.prefix.length).trim().split(/\s+/);
  const cmdKey = (config.prefix || "/") + (cmdNameRaw || "");

  // if user sends only prefix (e.g. "/"), run custom default
  if (!cmdNameRaw) {
    const defaultCmd = global.commands.get((config.prefix||"/") + (process.env.DEFAULT_CMD || "help"));
    if (defaultCmd) return defaultCmd.run(ctx, rest);
    return ctx.reply(`Type ${config.prefix}help to see commands.`);
  }

  const command = global.commands.get(cmdKey);
  if (!command) return ctx.reply(`❌ Unknown command: ${cmdNameRaw}`);

  try { await command.run(ctx, rest); }
  catch (e) { console.error(`❌ Command ${cmdNameRaw} error`, e); ctx.reply("⚠️ Command failed."); }
});

// ====== EXPRESS (serve index.html + status) ======
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  const users = useMongo && UserModel ? 'MongoDB' : safeLoadUsers();
  res.send(`<h2>${config.botname} — running</h2><p>Users: ${Array.isArray(users) ? users.length : users}</p>`);
});

app.get("/status", async (req, res) => {
  let total = 0;
  if (useMongo && UserModel) total = await UserModel.countDocuments();
  else total = safeLoadUsers().length;
  res.send(`<!doctype html><html><body><h1>${config.botname} Status</h1><p>Time: ${now()}</p><p>Users: ${total}</p></body></html>`);
});

// ====== AUTO-MODE: WEBHOOK (Render) or POLLING (Replit/Local) ======
(async () => {
  const renderURL = process.env.RENDER_EXTERNAL_URL || process.env.EXTERNAL_URL || "";
  const webhookPath = `/bot${BOT_TOKEN}`;
  try {
    if (renderURL) {
      const webhookURL = `${renderURL}${webhookPath}`;
      try { await bot.telegram.deleteWebhook(); } catch(e){}
      await bot.telegram.setWebhook(webhookURL);
      app.use(bot.webhookCallback(webhookPath));
      console.log(`🚀 Webhook set: ${webhookURL}`);
    } else {
      await bot.launch();
      console.log(`🚀 Bot launched in polling mode`);
    }
  } catch (e) {
    console.error("❌ Launch error:", e);
    // try fallback to polling
    try { await bot.launch(); console.log("⚠️ Fallback: polling mode"); } catch (err) { console.error("❌ Final fallback failed", err); process.exit(1); }
  }
})();

app.listen(PORT, () => console.log(`🌍 Web server listening on ${PORT}`));
