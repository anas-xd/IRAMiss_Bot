// ====== USERINFO COMMAND ======
const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");

module.exports = {
  name: "userinfo",
  description: "Displays detailed user profile and system data.",
  category: "info",
  usage: "/userinfo [user_id]",
  cooldown: 5,
  hasPermission: 0,
  credits: "⏤͟͞〲ᗩᑎᗩՏ 𓊈乂ᗪ𓊉",

  run: async (ctx, args) => {
    try {
      const config = require(path.join(__dirname, "..", "config.json"));
      const tz = config.timezone || "Asia/Dhaka";

      // ✅ Ensure user database file exists
      const dbPath = path.join(__dirname, "..", "database", "users.json");
      if (!fs.existsSync(dbPath)) fs.outputJsonSync(dbPath, []);

      const users = fs.readJsonSync(dbPath);

      // 🎯 Find the target user
      const queryId = args[0] ? args[0].trim() : ctx.from.id.toString();
      let user = users.find(u => u.id === queryId);

      // 🧩 If user not found, create a new one automatically
      if (!user) {
        user = {
          id: ctx.from.id.toString(),
          first_name: ctx.from.first_name || "Unknown",
          last_name: ctx.from.last_name || "",
          username: ctx.from.username ? `@${ctx.from.username}` : "N/A",
          is_premium: ctx.from.is_premium || false,
          language_code: ctx.from.language_code || "unknown",
          added_at: moment().tz(tz).format("DD/MM/YYYY HH:mm:ss"),
          last_active: moment().tz(tz).format("DD/MM/YYYY HH:mm:ss"),
        };
        users.push(user);
        fs.writeJsonSync(dbPath, users, { spaces: 2 });
      } else {
        user.last_active = moment().tz(tz).format("DD/MM/YYYY HH:mm:ss");
        fs.writeJsonSync(dbPath, users, { spaces: 2 });
      }

      // 💠 Role & Status
      const role = config.admin.includes(user.id)
        ? "👑 OWNER / ADMIN"
        : user.is_premium
        ? "💎 PREMIUM USER"
        : "🧑‍💻 REGULAR USER";

      const displayName = `${user.first_name} ${user.last_name || ""}`;
      const joined = user.added_at || "N/A";
      const active = user.last_active || "N/A";
      const timeNow = moment().tz(tz).format("DD/MM/YYYY HH:mm:ss");

      // 🪪 Profile layout
      const caption = `
👤 *USER INFORMATION*
━━━━━━━━━━━━━━━━━━━
🆔 *ID:* \`${user.id}\`
📛 *Name:* ${displayName}
🔗 *Username:* ${user.username}
💠 *Role:* ${role}
🌐 *Language:* ${user.language_code.toUpperCase()}

📅 *Joined:* ${joined}
🕒 *Last Active:* ${active}
🕓 *Server Time:* ${timeNow} (${tz})

🤖 *Queried By:* ${ctx.from.first_name}
━━━━━━━━━━━━━━━━━━━
❤️ *Powered by ${config.botname}*
`;

      // 🖼️ Random profile banner
      const banners = [
        "https://i.imgur.com/sxSn1K3.jpeg",
        "https://i.imgur.com/Huz3nAE.png",
        "https://i.imgur.com/wu0iDqS.jpeg",
        "https://i.imgur.com/zqsuJnX.jpeg"
      ];
      const banner = banners[Math.floor(Math.random() * banners.length)];

      // 🧠 Reply with the profile info
      await ctx.replyWithPhoto(banner, {
        caption,
        parse_mode: "Markdown"
      });
    } catch (err) {
      console.error("❌ Error in userinfo command:", err);
      ctx.reply("⚠️ Something went wrong while fetching user info.");
    }
  }
};
