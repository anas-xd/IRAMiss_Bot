// ====== MAIN TELEGRAM BOT FILE (PRO VERSION) ======
const { Telegraf } = require("telegraf");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");
const moment = require("moment-timezone");
require("dotenv").config();

// ====== CONFIG ======
const config = require("./config.json");

// ====== LANGUAGE HANDLER ======
let lang;
try {
  lang = require(`./languages/${config.language}.lang.js`);
  console.log(`🌐 Language set to: ${config.language}`);
} catch {
  console.warn(`⚠️ Language file not found for '${config.language}', using English fallback.`);
  lang = require("./languages/en.lang.js");
}

// ====== ENSURE DATABASE ======
const dbDir = path.join(__dirname, "database");
const dbFile = path.join(dbDir, "users.json");

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, "[]", "utf8");

// ====== LOAD SAFE USER DATA ======
function loadUserData() {
  try {
    const data = fs.readFileSync(dbFile, "utf8") || "[]";
    return JSON.parse(data);
  } catch (err) {
    console.error("⚠️ Corrupted users.json — resetting file...");
    fs.writeFileSync(dbFile, "[]", "utf8");
    return [];
  }
}

// ====== SAVE USER INFO ======
function saveUserData(ctx) {
  try {
    const users = loadUserData();
    const u = ctx.from;
    const userId = String(u.id);

    const existing = users.find(x => x.id === userId);

    if (!existing) {
      const newUser = {
        id: userId,
        first_name: u.first_name || "N/A",
        last_name: u.last_name || "",
        username: u.username ? `@${u.username}` : "N/A",
        is_premium: !!u.is_premium,
        language_code: u.language_code || "N/A",
        added_at: getTime(),
        last_active: getTime(),
      };
      users.push(newUser);
      console.log(`🆕 New user added: ${u.first_name} (${userId})`);
    } else {
      existing.last_active = getTime();
    }

    fs.writeFileSync(dbFile, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("❌ Failed to write user data:", err);
  }
}

// ====== TIMEZONE FUNCTION ======
function getTime() {
  const tz = config.timezone || "Asia/Dhaka";
  return moment().tz(tz).format("DD/MM/YYYY HH:mm:ss");
}

// ====== BOT SETUP ======
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
global.commands = new Map();

// ====== LOAD COMMANDS ======
fs.readdirSync("./commands").forEach(file => {
  if (file.endsWith(".js")) {
    try {
      const command = require(path.join(__dirname, "commands", file));
      if (command.name && command.run) {
        global.commands.set(config.prefix + command.name, command);
        console.log(`✅ Loaded command: ${command.name}`);
      }
    } catch (err) {
      console.error(`⚠️ Failed to load command ${file}:`, err);
    }
  }
});

// ====== START MESSAGE ======
bot.start(async (ctx) => {
  saveUserData(ctx);
  const name = ctx.from.first_name || "User";
  const msg = lang.startMessage
    ? lang.startMessage(name, config.botname, config.prefix)
    : `👋 Hello *${name}!*  
Welcome to *${config.botname}*!  
Use \`${config.prefix}help\` to see all commands.`;

  ctx.reply(msg, { parse_mode: "Markdown" });
});

// ====== TEXT COMMAND HANDLER ======
bot.on("text", async (ctx) => {
  const text = ctx.message.text || "";
  if (!text.startsWith(config.prefix)) return;

  saveUserData(ctx);

  const [cmdName, ...args] = text.slice(config.prefix.length).trim().split(" ");
  const command = global.commands.get(config.prefix + cmdName);

  if (!command) {
    return ctx.reply(
      lang.unknownCommand
        ? lang.unknownCommand.replace("%1", cmdName)
        : `❌ Unknown command: ${cmdName}\nTry: ${config.prefix}help`
    );
  }

  try {
    await command.run(ctx, args);
  } catch (err) {
    console.error(`❌ Error in ${cmdName}:`, err);
    ctx.reply(lang.commandError || "⚠️ Command execution failed.");
  }
});

// ====== EXPRESS SERVER (for uptime + status) ======
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  const users = loadUserData();
  res.send(`
  <html>
    <head><title>${config.botname} | Status</title></head>
    <body style="background:#0d1117;color:#e6edf3;text-align:center;font-family:sans-serif;">
      <h1>🤖 ${config.botname} is Active</h1>
      <p>🕓 ${getTime()} (${config.timezone})</p>
      <p>👥 Total Users: <b>${users.length}</b></p>
      <p>💻 Server: Render (Node.js)</p>
      <p>🌐 Language: ${config.language}</p>
      <hr style="width:50%;border:1px solid #444;">
      <p>💖 Made by <a href="https://t.me/xd_anas" style="color:#58a6ff;text-decoration:none;">⏤͟͞〲ᗩᑎᗩՏ 𓊈乂ᗪ𓊉</a></p>
    </body>
  </html>
  `);
});

app.listen(PORT, () => console.log(`🌍 Web server active on port ${PORT}`));

// ====== LAUNCH BOT (WEBHOOK MODE for Render) ======
(async () => {
  try {
    const webhookURL = `${process.env.RENDER_EXTERNAL_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`;
    await bot.telegram.setWebhook(webhookURL);
    app.use(bot.webhookCallback(`/bot${process.env.TELEGRAM_BOT_TOKEN}`));
    console.log(`🚀 ${config.botname} is online with webhook mode!`);
  } catch (err) {
    console.error("❌ Launch failed:", err);
  }
})();
