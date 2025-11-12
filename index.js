// ====== MAIN TELEGRAM BOT FILE ======
const { Telegraf } = require("telegraf");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");
const moment = require("moment-timezone");
const { execSync } = require("child_process");
require("dotenv").config();

// ====== CONFIG ======
const config = require("./config.json");

// ====== LANGUAGE HANDLER ======
let lang;
try {
  lang = require(`./languages/${config.language}.lang.js`);
  console.log(`🌐 Language set to: ${config.language}`);
} catch (error) {
  console.error(`⚠️ Language file not found for '${config.language}', defaulting to English.`);
  lang = require("./languages/en.lang.js");
}

// ====== BOT SETUP ======
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
global.commands = new Map();

// ====== AUTO-INSTALL MISSING MODULES ======
function ensureModuleInstalled(moduleName) {
  try {
    require.resolve(moduleName);
  } catch (err) {
    console.log(`📦 Installing missing module: ${moduleName}`);
    execSync(`npm install ${moduleName} --save`, { stdio: "inherit" });
  }
}

// ====== LOAD COMMANDS ======
fs.readdirSync("./commands").forEach(file => {
  if (!file.endsWith(".js")) return;
  const commandPath = path.join(__dirname, "commands", file);
  const command = require(commandPath);

  if (command.name && command.run) {
    global.commands.set(config.prefix + command.name, command);
    console.log(`✅ Loaded command: ${command.name}`);
  }
});

// ====== TIMEZONE FUNCTION ======
function getCurrentTime() {
  const tz = config.timezone || "Asia/Dhaka";
  return moment().tz(tz).format("DD/MM/YYYY HH:mm:ss");
}

// ====== START MESSAGE ======
bot.start((ctx) => {
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
    ctx.reply(lang.commandError || "⚠️ An error occurred while executing this command.");
  }
});

// ====== DUMMY SERVER (for uptime, Render/Replit) ======
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "index.html");
  res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(`🌍 Server active on port ${PORT}`);
});

// ====== LAUNCH THE BOT ======
bot.launch()
  .then(() => {
    console.log(`🚀 ${config.botname} is online!`);
    console.log(`🗣️ Language: ${config.language}`);
    console.log(`🌍 Timezone: ${config.timezone}`);
  })
  .catch((err) => console.error("❌ Launch failed:", err));
