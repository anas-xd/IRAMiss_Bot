# 🌸 ᴍɪꜱꜱ ﾉ尺卂 — Telegram Bot

A modern and customizable Telegram bot built with **Node.js** and **Telegraf**.  
Originally inspired by *Messenger BOT’s project*, this version has been improved and enhanced by **ᴍɪꜱꜱ ﾉ尺卂**.

---

## 🚀 Features
- 💬 Command-based interaction system  
- ⚙️ Easy configuration via `config.json`  
- 🗂️ Modular command structure (`/commands` folder)  
- 🌐 Supports uptime through Express (for Replit / Render)  
- 🕓 Timezone & language support  
- 🔐 Admin-only command system  
- 🎨 Fully customizable — name, prefix, responses, and images

---

## 🧩 Project Structure

📁 TelegramBot/ ├─ index.js              # Main bot file ├─ config.json           # Bot configuration ├─ commands/             # All command modules ├─ languages/            # Language files ├─ package.json          # Dependencies and startup └─ .env                  # Telegram bot token

---

## ⚙️ Setup Guide

### 1. Get Your Bot Token
Talk to [@BotFather](https://t.me/BotFather) on Telegram and create a new bot.  
Copy the token and keep it safe.

### 2. Create `.env` File

TELEGRAM_BOT_TOKEN=your_bot_token_here

### 3. Edit `config.json`
Example:
```json
{
  "botname": "ᴍɪꜱꜱ ﾉ尺卂",
  "prefix": "/",
  "admin": ["your_user_id_here"],
  "language": "en",
  "timezone": "Asia/Dhaka",
  "version": "1.0.0"
}

4. Install Dependencies

Run this command:

npm install

5. Start the Bot

npm start

Or directly:

node index.js


---

💡 Example Commands

Command	Description

/start	Start the bot and get a welcome message
/info	Shows bot and admin information
/help	Lists available commands



---

👑 Credits

Original base: Messenger Mirai BOT

Developer: ⏤͟͞〲ᗩᑎᗩՏ 𓊈乂ᗪ𓊉

Inspired & Improved by ᴍɪꜱꜱ ﾉ尺卂


---

✨ Built with love and code — ᴍɪꜱꜱ ﾉ尺卂

---

Would you like me to make a **fancier version** (with GitHub badges, emoji icons, and aesthetic styling like “Made with ❤️ by ᴍɪꜱꜱ ﾉ尺卂”)?
