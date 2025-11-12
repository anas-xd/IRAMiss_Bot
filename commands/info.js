// commands/info.js
const axios = require("axios");
const moment = require("moment-timezone");
const path = require("path");

module.exports = {
  name: "info",
  description: "Shows bot and owner information",
  category: "info",
  usage: "/info",
  cooldown: 5,
  hasPermission: 0,
  credits: "⏤͟͞〲ᗩᑎᗩՏ 𓊈乂ᗪ𓊉",

  run: async (ctx, args) => {
    try {
      const config = require(path.join(__dirname, "..", "config.json"));

      // ===== BASIC INFO =====
      const botName = config.botname || "My Bot";
      const ownerName = "⏤͟͞〲ᗩᑎᗩՏ 𓊈乂ᗪ𓊉";
      const ownerTag = "@xd_anas";
      const fbLink = "https://www.facebook.com/61550653641051";

      // ===== SYSTEM INFO =====
      const uptimeSec = process.uptime();
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = Math.floor(uptimeSec % 60);

      const tz = config.timezone || "Asia/Dhaka";
      const timeNow = moment().tz(tz).format("DD/MM/YYYY HH:mm:ss");

      const msgDateSec = ctx.message?.date ? ctx.message.date : Math.floor(Date.now() / 1000);
      const pingMs = Date.now() - msgDateSec * 1000;

      const commandsCount = global.commands ? global.commands.size : "N/A";
      const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

      // ===== API STATUS CHECK =====
      let apiStatus = "🔴 DOWN";
      let apiPing = "N/A";
      const start = Date.now();
      try {
        await axios.get("https://api.telegram.org"); // Telegram core API check
        apiPing = Date.now() - start;
        apiStatus = "🟢 OK";
      } catch {
        apiStatus = "🔴 DOWN";
      }

      // ===== IMAGE LINKS =====
      const imgLinks = [
        "https://i.imgur.com/zqsuJnX.jpeg",
        "https://i.imgur.com/sxSn1K3.jpeg",
        "https://i.imgur.com/wu0iDqS.jpeg",
        "https://i.imgur.com/Huz3nAE.png"
      ];
      const image = imgLinks[Math.floor(Math.random() * imgLinks.length)];

      // ===== MESSAGE =====
      const caption = `
🌸 *BOT & OWNER INFORMATION*

🤖 *Bot Name:* ${botName}
👑 *Owner:* ${ownerName}
📱 *Telegram:* ${ownerTag}
🌐 *Facebook:* [Click Here](${fbLink})

⚙️ *Prefix:* \`${config.prefix}\`
🕓 *Uptime:* ${hours}h ${minutes}m ${seconds}s
🕒 *Server Time:* ${timeNow} (${tz})
📶 *Ping:* ${pingMs} ms

📊 *Statistics*
• Commands Loaded: ${commandsCount}
• Memory Usage: ${memMb} MB

🌍 *API Status*
• Telegram API: ${apiStatus}
• Response Time: ${apiPing} ms

❤️ *Thanks for using ${botName}!*`;

      await ctx.replyWithPhoto(image, {
        caption,
        parse_mode: "Markdown",
      });
    } catch (err) {
      console.error("❌ Error in /info command:", err);
      ctx.reply("⚠️ Something went wrong while fetching bot info.");
    }
  },
};