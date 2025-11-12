const axios = require("axios");

const languageMap = {
  hindi: "hi",
  english: "en",
  punjabi: "pa",
  urdu: "ur",
  bhojpuri: "bho",
  bengali: "bn",
  bangali: "bn",
  korean: "ko",
  japanese: "ja",
  japani: "ja",
  marathi: "mr",
  tamil: "ta",
  telugu: "te",
  gujarati: "gu",
  kannada: "kn"
};

module.exports = {
  name: "trans",
  description: "Translate text to any language",
  category: "tools",
  usage: "/trans <lang> <text> OR reply with /trans <lang>",
  cooldown: 3,
  hasPermission: 0,
  credits: "Priyansh + ChatGPT",

  run: async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);
    const targetInput = args[0]?.toLowerCase();

    // Lang detect
    const targetLang = languageMap[targetInput] || targetInput;

    let text = args.slice(1).join(" ");

    // Agar message pe reply kiya gaya ho
    if (ctx.message.reply_to_message?.text) {
      text = ctx.message.reply_to_message.text;
    }

    if (!targetLang || !text) {
      return ctx.reply("❗ Usage:\n- `/trans hindi I love you`\n- (reply karke) `/trans hindi`", {
        parse_mode: "Markdown"
      });
    }

    try {
      const res = await axios.get("https://translate.googleapis.com/translate_a/single", {
        params: {
          client: "gtx",
          sl: "auto",
          tl: targetLang,
          dt: "t",
          q: text
        }
      });

      const translated = res.data[0].map(item => item[0]).join("");
      const fromLang = res.data[2] || res.data[8]?.[0]?.[0] || "unknown";

      await ctx.reply(`✍️ *${fromLang} ➜ ${targetInput.toUpperCase()}*\n\n${translated}`, {
        parse_mode: "Markdown"
      });

    } catch (err) {
      console.error("Translate error:", err.message);
      ctx.reply("⚠️ Translate nahi ho paya. Language ya input check karo.");
    }
  }
};
