const userDB = require("../utils/userDB");
const moment = require("moment-timezone");

module.exports = {
  name: "users",
  description: "Display user statistics",
  category: "info",
  usage: "/users",
  run: async (ctx) => {
    const users = await userDB.getAllUsers();
    const activeUsers = users.filter(u => u["🔰_STATUS"] === "ACTIVE");
    const premiumUsers = users.filter(u => u["💎_IS_PREMIUM"]);

    const msg = `
📂 *USER DATABASE OVERVIEW*

👥 *Total Users:* ${users.length}
🟢 *Active Users:* ${activeUsers.length}
💎 *Premium Users:* ${premiumUsers.length}

🕓 *Last Updated:* ${moment().tz("Asia/Dhaka").format("DD/MM/YYYY HH:mm:ss")}
📁 *Storage Path:* \`data/users.json\`

⚙️ *Powered By:* ᴍɪꜱꜱ ﾉ尺卂
👑 *Developer:* ⏤͟͞〲ᗩᑎᗩՏ 𓊈乂ᗪ𓊉
    `;

    await ctx.replyWithMarkdown(msg);
  }
};
