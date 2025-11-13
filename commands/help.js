const fs = require("fs");
const path = require("path");
const axios = require("axios");
const config = require("../config.json");

module.exports = {
  name: "help",
  description: "Show all commands or get info about one.",
  category: "system",
  usage: "/help [command/page]",
  cooldown: 3,
  credits: "ᴍɪꜱꜱ ﾉ尺卂 (with multi-language support)",

  run: async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);
    const lang = config.language || "en";
    const commandDir = path.join(__dirname);
    const files = fs.readdirSync(commandDir).filter(f => f.endsWith(".js"));
    const commands = files.map(f => require(path.join(commandDir, f)));

    const randomImages = [
      "https://i.imgur.com/sxSn1K3.jpeg",
      "https://i.imgur.com/8WvpgUL.jpeg",
      "https://i.imgur.com/zqsuJnX.jpeg",
      "https://i.imgur.com/Huz3nAE.png"
    ];
    const randomImage = randomImages[Math.floor(Math.random() * randomImages.length)];

    // === Language strings ===
    const text = {
      en: {
        header: "✨ COMMAND INFO ✨",
        listHeader: "📜 COMMAND LIST 📜",
        notFound: "❌ Command not found.",
        name: "Name",
        usage: "Usage",
        description: "Description",
        permission: "Permission",
        credits: "Credits",
        category: "Category",
        cooldown: "Cooldown",
        page: "Page",
        total: "Total",
        prefix: "Prefix",
        bot: "Bot",
        owner: "Owner"
      },
      bn: {
        header: "✨ কমান্ড ইনফো ✨",
        listHeader: "📜 কমান্ড লিস্ট 📜",
        notFound: "❌ কমান্ড খুঁজে পাওয়া যায়নি।",
        name: "নাম",
        usage: "ব্যবহার",
        description: "বর্ণনা",
        permission: "অনুমতি",
        credits: "ক্রেডিটস",
        category: "বিভাগ",
        cooldown: "কুলডাউন",
        page: "পৃষ্ঠা",
        total: "মোট",
        prefix: "প্রিফিক্স",
        bot: "বট",
        owner: "ওনার"
      }
    };

    const t = text[lang];

    // === Specific command help ===
    if (args[0]) {
      const cmdName = args[0].toLowerCase();
      const command = commands.find(c => c.name === cmdName);
      if (!command) return ctx.reply(`${t.notFound}`);

      const msg = `
╭━━━━━━━━━━━━━━━━╮
┃ ${t.header}
┣━━━━━━━━━━━┫
┃ 🔖 *${t.name}:* ${command.name}
┃ 📄 *${t.usage}:* ${command.usage || "N/A"}
┃ 📜 *${t.description}:* ${command.description || "No description"}
┃ 🔑 *${t.permission}:* ${command.hasPermission || 0}
┃ 👨‍💻 *${t.credits}:* ${command.credits || "Unknown"}
┃ 📂 *${t.category}:* ${command.category || "General"}
┃ ⏳ *${t.cooldown}:* ${command.cooldown || 0}s
┣━━━━━━━━━━━━━━━━┫
┃ ⚙ ${t.prefix}: ${config.prefix}
┃ 🤖 ${t.bot}: ${config.botname}
╰━━━━━━━━━━━━━━━━╯`;

      try {
        const imgPath = path.join(__dirname, "cache", "help.jpg");
        const response = await axios.get(randomImage, { responseType: "arraybuffer" });
        fs.writeFileSync(imgPath, response.data);
        await ctx.replyWithPhoto({ source: imgPath }, { caption: msg, parse_mode: "Markdown" });
        fs.unlinkSync(imgPath);
      } catch {
        await ctx.replyWithMarkdown(msg);
      }
      return;
    }

    // === Paginated help list ===
    const page = parseInt(args[0]) || 1;
    const perPage = 15;
    const total = commands.length;
    const totalPages = Math.ceil(total / perPage);
    const start = (page - 1) * perPage;
    const end = start + perPage;

    const list = commands.slice(start, end)
      .map(c => `┃ ✪ \`${config.prefix}${c.name}\` — ${c.description || "No description"}`)
      .join("\n");

    const msg = `
╭━━━━━━━━━━━━━━━━╮
┃ ${t.listHeader}
┣━━━━━━━━━━━━━━━┫
┃ 📄 ${t.page}: ${page}/${totalPages}
┃ 🧮 ${t.total}: ${total}
┣━━━━━━━━━━━━━━━━┫
┃ ${list}
╰━━━━━━━━━━━━━━━━╯`;

    try {
      const imgPath = path.join(__dirname, "cache", "help_list.jpg");
      const response = await axios.get(randomImage, { responseType: "arraybuffer" });
      fs.writeFileSync(imgPath, response.data);
      await ctx.replyWithPhoto({ source: imgPath }, { caption: msg, parse_mode: "Markdown" });
      fs.unlinkSync(imgPath);
    } catch {
      await ctx.replyWithMarkdown(msg);
    }
  }
};
