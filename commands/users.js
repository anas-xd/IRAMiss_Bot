const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");

module.exports = {
  name: "users",
  description: "View or manage user database. Use /users <page>, /users all, or /users find <keyword>.",
  category: "admin",
  usage: "/users [page|all|find <keyword>]",
  cooldown: 3,
  hasPermission: 0,
  credits: "⏤͟͞〲ᗩᑎᗩՏ 𓊈乂ᗪ𓊉",

  run: async (ctx, args = []) => {
    try {
      const config = require(path.join(__dirname, "..", "config.json"));
      const adminIds = config.admin || [];
      const userId = ctx.from.id.toString();

      // ===== ADMIN CHECK =====
      if (!adminIds.includes(userId)) {
        return ctx.reply("🚫 *Access Denied!* Only the bot admin can use this command.", { parse_mode: "Markdown" });
      }

      // ===== DATABASE PATH =====
      const dbPath = path.join(__dirname, "..", "database", "users.json");
      if (!fs.existsSync(dbPath)) {
        return ctx.reply("⚠️ No user database found yet.");
      }

      const users = await fs.readJson(dbPath);
      if (!Array.isArray(users) || users.length === 0) {
        return ctx.reply("📭 Database empty.");
      }

      // ===== FIND MODE =====
      if (args[0] && args[0].toLowerCase() === "find") {
        const keyword = args.slice(1).join(" ").trim().toLowerCase();
        if (!keyword)
          return ctx.reply("🔍 Usage: `/users find <name|username|id>`", { parse_mode: "Markdown" });

        const matches = users.filter(u => {
          const fields = [
            u.id?.toString().toLowerCase(),
            u.username?.toLowerCase(),
            u.first_name?.toLowerCase(),
            u.last_name?.toLowerCase()
          ].filter(Boolean);
          return fields.some(f => f.includes(keyword));
        });

        if (matches.length === 0)
          return ctx.reply(`❌ No user found for: \`${keyword}\``, { parse_mode: "Markdown" });

        const results = matches.slice(0, 10).map((u, i) => {
          const id = u.id || "N/A";
          const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
          const username = u.username ? `[@${u.username}](https://t.me/${u.username})` : "—";
          const joined = u.added_at || "N/A";
          const last = u.last_active || "N/A";
          const cmds = u.total_commands_used || 0;
          const premium = u.is_premium ? "💎" : "—";

          return `*${i + 1}.* \`${id}\` — *${name}* (${username})\n   ${premium} Joined: _${joined}_ • Last: _${last}_ • Cmds: _${cmds}_`;
        });

        return ctx.replyWithMarkdown(`🔍 *Search Results for:* \`${keyword}\`\n\n${results.join("\n\n")}`);
      }

      // ===== ALL USERS (send file) =====
      if (args[0] && args[0].toLowerCase() === "all") {
        await ctx.reply(`📁 Sending full database (${users.length} users)...`);
        return ctx.replyWithDocument({ source: dbPath, filename: "users.json" });
      }

      // ===== PAGINATION =====
      const perPage = 10;
      const page = Math.max(parseInt(args[0]) || 1, 1);
      const totalPages = Math.ceil(users.length / perPage);
      const start = (page - 1) * perPage;
      const pageUsers = users.slice(start, start + perPage);

      const lines = pageUsers.map((u, i) => {
        const id = u.id || "N/A";
        const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
        const username = u.username ? `[@${u.username}](https://t.me/${u.username})` : "—";
        const joined = u.added_at || "N/A";
        const last = u.last_active || "N/A";
        const cmds = u.total_commands_used || 0;
        const premium = u.is_premium ? "💎" : "—";

        return `*${start + i + 1}.* \`${id}\` — *${name}* (${username})\n   ${premium} Joined: _${joined}_ • Last: _${last}_ • Cmds: _${cmds}_`;
      });

      const tz = config.timezone || "Asia/Dhaka";
      const footer = `\n📊 Page ${page}/${totalPages} • Total users: ${users.length}\n🕒 ${moment().tz(tz).format("DD/MM/YYYY HH:mm:ss")} (${tz})`;

      await ctx.replyWithMarkdown(lines.join("\n\n") + footer);

    } catch (err) {
      console.error("❌ Error in /users command:", err);
      ctx.reply("⚠️ Error occurred while fetching user data.");
    }
  }
};
