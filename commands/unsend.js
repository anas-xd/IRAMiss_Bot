module.exports = {
  name: "uns",
  description: "Bot ke message ko delete karta hai (reply karke)",
  category: "utility",
  usage: "/unsend (reply to bot message)",
  hasPermission: 0,
  cooldown: 2,

  run: async (ctx) => {
    try {
      const reply = ctx.message.reply_to_message;
      if (!reply) return ctx.reply("❗ Kripya bot ke kisi message pe reply karo `/unsend` ke saath.");

      const isBot = reply.from.id === ctx.botInfo.id;
      if (!isBot) return ctx.reply("❌ Ye message bot ka nahi hai.");

      await ctx.deleteMessage(reply.message_id);
    } catch (err) {
      console.error("Unsend error:", err.message);
      ctx.reply("⚠️ Message delete nahi ho paaya.");
    }
  }
};
