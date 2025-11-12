const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");

module.exports = {
  name: "userinfo",
  description: "Shows your Telegram profile info",
  category: "general",
  usage: "/userinfo",
  cooldown: 3,
  hasPermission: 0,
  credits: "⏤͟͞〲ᗩᑎᗩՏ 𓊈乂ᗪ𓊉",

  run: async (ctx) => {
    try {
      const dbPath = path.join(__dirname, "..", "database", "users.json");
      const users = fs.existsSync(dbPath) ? await fs.readJson(dbPath) : [];
      const user = users.find(u => u.id === ctx.from.id);

      const id = ctx.from.id;
      const name = `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim();
      const username = ctx.from.username ? `@${ctx.from.username}` : "—";
      const isPremium = ctx.from.is_premium ? "💎 YES" : "❌ NO";
      const joinDate = user?.added_at || "Unknown";
      const lastActive = user?.last_active || "N/A";

      const caption = `
👤 *USER INFORMATION*

🪪 *ID:* \`${id}\`
🧭 *Name:* ${name}
🔗 *Username:* ${username}
💠 *Premium:* ${isPremium}

📆 *Joined:* ${joinDate}
🕒 *Last Active:* ${lastActive}
`;

      // Try to get the user’s profile photo
      const photos = await ctx.telegram.getUserProfilePhotos(id, 0, 1);

      if (photos.total_count > 0) {
        const fileId = photos.photos[0][0].file_id;
        await ctx.replyWithPhoto(fileId, { caption, parse_mode: "Markdown" });
      } else {
        await ctx.reply(caption, { parse_mode: "Markdown" });
      }
    } catch (err) {
      console.error("❌ Error in /userinfo:", err);
      ctx.reply("⚠️ Unable to fetch user information.");
    }
  }
};
