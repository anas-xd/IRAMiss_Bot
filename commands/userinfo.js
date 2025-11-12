const { readFileSync } = require("fs");
const path = require("path");
const dbFile = path.join(__dirname, "../database/users.json");

module.exports = {
  name: "userinfo",
  description: "Display detailed information about the current user.",

  run: async (ctx) => {
    try {
      const users = JSON.parse(readFileSync(dbFile, "utf8"));
      const user = users.find(u => u.id === String(ctx.from.id)) || {};

      // Escape HTML special chars to prevent Telegram parsing issues
      const escape = (text) => String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      const id = escape(ctx.from.id);
      const name = escape(ctx.from.first_name || "N/A");
      const username = ctx.from.username ? `@${escape(ctx.from.username)}` : "N/A";
      const premium = ctx.from.is_premium ? "💎 <b>YES (TG PREMIUM)</b>" : "⚪ NO";
      const addedAt = escape(user.added_at || "Unknown");
      const lastActive = escape(user.last_active || "N/A");

      const caption = `
🌸 <b>『 ᴜꜱᴇʀ ɪɴꜰᴏ 』</b>
──────────────────────

🪪 <b>ID:</b> <code>${id}</code>
👤 <b>Name:</b> ${name}
🔗 <b>Username:</b> ${username}
💠 <b>Premium:</b> ${premium}

📆 <b>Joined:</b> ${addedAt}
🕒 <b>Last Active:</b> ${lastActive}

──────────────────────
⚙️ <b>Powered by:</b> <a href="https://t.me/xd_anas">⏤͟͞〲ᗩᑎᗩՏ 𓊈乂ᗪ𓊉</a>
`;

      const profilePhoto = "https://telegra.ph/file/cc716e89f66f9d28d8e6a.jpg"; // fallback avatar

      await ctx.replyWithPhoto(
        { url: profilePhoto },
        {
          caption,
          parse_mode: "HTML"
        }
      );
    } catch (err) {
      console.error("❌ userinfo error:", err);
      ctx.reply("⚠️ Unable to fetch user info right now.");
    }
  },
};
