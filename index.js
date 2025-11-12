// ====== MISS IRA BOT (PRO VERSION - WITH DB + STATUS TOGGLE) ======
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

// ====== DATABASE SETUP ======
const dbDir = path.join(__dirname, "database");
const dbFile = path.join(dbDir, "users.json");
fs.ensureDirSync(dbDir);
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, "[]", "utf8");

function loadUserData() {
  try {
    const data = fs.readFileSync(dbFile, "utf8") || "[]";
    return JSON.parse(data);
  } catch (err) {
    console.error("⚠️ Corrupted users.json — resetting...");
    fs.writeFileSync(dbFile, "[]", "utf8");
    return [];
  }
}

function saveUserData(ctx) {
  try {
    const users = loadUserData();
    const u = ctx.from;
    const id = String(u.id);

    const existing = users.find(x => x.id === id);
    if (!existing) {
      const newUser = {
        id,
        first_name: u.first_name || "N/A",
        last_name: u.last_name || "",
        username: u.username ? `@${u.username}` : "N/A",
        is_premium: !!u.is_premium,
        language_code: u.language_code || "N/A",
        added_at: getTime(),
        last_active: getTime(),
      };
      users.push(newUser);
      console.log(`🆕 New user added: ${u.first_name} (${id})`);
    } else {
      existing.last_active = getTime();
    }

    fs.writeFileSync(dbFile, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("❌ Failed to save user:", err);
  }
}

function getTime() {
  const tz = config.timezone || "Asia/Dhaka";
  return moment().tz(tz).format("DD/MM/YYYY HH:mm:ss");
}

// ====== TELEGRAM BOT ======
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
global.commands = new Map();

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

// ====== EXPRESS SERVER ======
const app = express();
const PORT = process.env.PORT || 3000;

// Serve index.html directly
app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.send("<h2>Index file not found.</h2>");
});

// ====== Toggleable Status Page ======
app.get("/status", (req, res) => {
  const users = loadUserData();
  const statsHTML = `
  <html>
  <head>
    <title>${config.botname} | Status</title>
    <style>
      body {
        background: #0d1117;
        color: #e6edf3;
        font-family: 'Poppins', sans-serif;
        text-align: center;
        margin: 0;
        padding: 40px;
      }
      .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        background: linear-gradient(45deg, #ff416c, #ff4b2b);
        color: #fff;
        font-weight: bold;
        cursor: pointer;
        transition: 0.3s;
      }
      .btn:hover {
        background: linear-gradient(45deg, #1f4037, #99f2c8);
        transform: scale(1.05);
      }
      #stats {
        margin-top: 25px;
        display: none;
      }
    </style>
  </head>
  <body>
    <h1>🤖 ${config.botname} Dashboard</h1>
    <button class="btn" onclick="toggleStats()">🔁 Toggle Status</button>
    <div id="stats">
      <h3>📊 Bot Statistics</h3>
      <p>🕒 ${getTime()} (${config.timezone})</p>
      <p>👥 Total Users: <b>${users.length}</b></p>
      <p>🌐 Language: ${config.language}</p>
      <p>💻 Server: Render</p>
      <p>💖 Owner: <a href="https://t.me/xd_anas" style="color:#ffb6c1;">⏤͟͞〲ᗩᑎᗩՏ 𓊈乂ᗪ𓊉</a></p>
    </div>

    <script>
      function toggleStats() {
        const el = document.getElementById("stats");
        el.style.display = el.style.display === "none" ? "block" : "none";
      }
    </script>
  </body>
  </html>
  `;
  res.send(statsHTML);
});

// ====== LAUNCH BOT WITH WEBHOOK ======
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

app.listen(PORT, () => console.log(`🌍 Web server active on port ${PORT}`));
