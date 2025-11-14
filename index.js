// ====== MISS IRA BOT — FULL REBUILD (WEBHOOK + POLLING + SONG READY) ======
const { Telegraf } = require("telegraf");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");
const moment = require("moment-timezone");
require("dotenv").config();

const config = require("./config.json");

// ====== OPTIONAL MONGO ======
let useMongo = false;
let mongoose;
let UserModel = null;

if (process.env.MONGO_URI) {
  try {
    mongoose = require("mongoose");
    useMongo = true;
    mongoose
      .connect(process.env.MONGO_URI, { 
        useNewUrlParser: true,
        useUnifiedTopology: true 
      })
      .then(() => console.log("🗄️ MongoDB connected"))
      .catch((e) => { 
        console.log("❌ Mongo error:", e);
        useMongo = false; 
      });
  } catch {
    console.log("⚠️ Install mongoose to enable MongoDB");
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

// ====== LANGUAGE ======
let lang;
try { lang = require(`./languages/${config.language}.lang.js`); }
catch { lang = require("./languages/en.lang.js"); }

// ====== FILE-DB ======
const dbDir = path.join(__dirname, "database");
const dbFile = path.join(dbDir, "users.json");
fs.ensureDirSync(dbDir);
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, "[]");

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(dbFile, "utf8")); }
  catch { return []; }
}

function saveUsers(arr) {
  try { fs.writeFileSync(dbFile, JSON.stringify(arr, null, 2)); }
  catch (e) { console.log("❌ Failed to save users.json", e); }
}

// ====== TIME ======
const now = () => moment().tz(config.timezone || "Asia/Dhaka").format("DD/MM/YYYY HH:mm:ss");

// ====== SAVE USER ======
async function saveUser(ctx) {
  try {
    const u = ctx.from;
    if (!u) return;

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
      const exist = users.find(x => x.id === data.id);
      if (!exist) users.push(data);
      else exist.last_active = now();
      saveUsers(users);
    }
  } catch (err) {
    console.log("❌ saveUser error", err);
  }
}

// ====== BOT INIT ======
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
global.commands = new Map();
global.songSessions = {};   // 🔥 For song search → select → download

// ====== LOAD COMMANDS ======
const commandsDir = path.join(__dirname, "commands");
fs.readdirSync(commandsDir).forEach(file => {
  if (!file.endsWith(".js")) return;
  try {
    const cmd = require(path.join(commandsDir, file));
    if (cmd.name && cmd.run) {
      global.commands.set(config.prefix + cmd.name, cmd);
      console.log("✅ Loaded cmd:", cmd.name);
    }
  } catch (e) {
    console.log(`⚠️ Failed to load ${file}:`, e);
  }
});

// ====== START ======
bot.start(async (ctx) => {
  await saveUser(ctx);
  const name = ctx.from?.first_name || "User";
  return ctx.reply(
    lang.startMessage ? lang.startMessage(name, config.botname, config.prefix) 
                      : `Hello ${name}! Use ${config.prefix}help`,
    { parse_mode: "Markdown" }
  );
});

// ====== TEXT HANDLER (prefix only) ======
bot.on("text", async (ctx) => {
  const msg = ctx.message.text.trim();
  if (!msg.startsWith(config.prefix)) return;

  await saveUser(ctx);

  const args = msg.slice(config.prefix.length).trim().split(/\s+/);
  const cmdRaw = args.shift();
  const cmdKey = config.prefix + cmdRaw;

  // only prefix → run default
  if (!cmdRaw) {
    const d = global.commands.get(config.prefix + (process.env.DEFAULT_CMD || "help"));
    return d ? d.run(ctx, args) : ctx.reply(`Use ${config.prefix}help`);
  }

  const command = global.commands.get(cmdKey);
  if (!command) return ctx.reply("❌ Unknown Command");

  try { await command.run(ctx, args); }
  catch (e) {
    console.log("❌ Command error:", e);
    ctx.reply("⚠️ Something went wrong.");
  }
});

// ====== EXPRESS ======
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/status", async (req, res) => {
  let total = 0;

  if (useMongo && UserModel) total = await UserModel.countDocuments();
  else total = loadUsers().length;

  res.send(`
    <h1>${config.botname} Status</h1>
    <p>Server Time: ${now()}</p>
    <p>Total Users: ${total}</p>
  `);
});

// ====== WEBHOOK OR POLLING ======
(async () => {
  const url = process.env.RENDER_EXTERNAL_URL || "";
  const hook = `/bot${process.env.TELEGRAM_BOT_TOKEN}`;

  try {
    if (url) {
      await bot.telegram.deleteWebhook().catch(() => {});
      await bot.telegram.setWebhook(url + hook);
      app.use(bot.webhookCallback(hook));
      console.log("🚀 Webhook running:", url + hook);
    } else {
      await bot.launch();
      console.log("🚀 Bot started (Polling Mode)");
    }
  } catch (err) {
    console.log("❌ Failed to launch webhook, fallback to polling...", err);
    await bot.launch();
  }
})();

app.listen(PORT, () => console.log(`🌍 Web Server Ready on ${PORT}`));
