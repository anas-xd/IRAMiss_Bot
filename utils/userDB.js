const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");

const dbPath = path.join(__dirname, "..", "data", "users.json");

// Ensure file exists
fs.ensureFileSync(dbPath);
if (!fs.existsSync(dbPath)) fs.writeJsonSync(dbPath, []);

module.exports = {
  async addOrUpdateUser(ctx, commandName = "UNKNOWN") {
    let users = [];
    try {
      users = await fs.readJson(dbPath);
    } catch {
      users = [];
    }

    const user = ctx.from;
    const now = new Date().toISOString();

    const userData = {
      🆔_ID: user.id,
      👤_FIRST_NAME: (user.first_name || "").toUpperCase(),
      🧍‍♂️_LAST_NAME: (user.last_name || "").toUpperCase(),
      🔖_USERNAME: (user.username || "UNKNOWN").toUpperCase(),
      🌐_LANGUAGE: (user.language_code || "UNKNOWN").toUpperCase(),
      💎_IS_PREMIUM: user.is_premium || false,
      🤖_IS_BOT: user.is_bot || false,
      📅_JOINED_AT: now,
      ⏰_LAST_ACTIVE: now,
      ⚡_TOTAL_COMMANDS_USED: 1,
      🧾_LAST_COMMAND: commandName.toUpperCase(),
      💬_MESSAGE_COUNT: 1,
      🔰_STATUS: "ACTIVE",
      🛡️_IS_ADMIN: false,
      📱_DEVICE: ctx?.message?.via_bot ? "BOT" : "TELEGRAM",
      🕒_TIMEZONE: "ASIA/DHAKA"
    };

    const index = users.findIndex(u => u["🆔_ID"] === user.id);
    if (index === -1) {
      users.push(userData);
    } else {
      const existing = users[index];
      existing["⏰_LAST_ACTIVE"] = now;
      existing["⚡_TOTAL_COMMANDS_USED"] += 1;
      existing["💬_MESSAGE_COUNT"] += 1;
      existing["🧾_LAST_COMMAND"] = commandName.toUpperCase();
      users[index] = existing;
    }

    await fs.writeJson(dbPath, users, { spaces: 2 });
  },

  async getAllUsers() {
    try {
      return await fs.readJson(dbPath);
    } catch {
      return [];
    }
  },

  async getUserById(id) {
    try {
      const users = await fs.readJson(dbPath);
      return users.find(u => u["🆔_ID"] === id);
    } catch {
      return null;
    }
  }
};
