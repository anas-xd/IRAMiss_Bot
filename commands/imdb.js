const axios = require("axios");

module.exports = {
  name: "imdb",
  description: "Find movie or series details from IMDb",
  category: "search",
  usage: "imdb <movie/series name>",
  hasPermission: 0,
  cooldown: 3,
  credits: "MirryKal",

  run: async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ");
    if (!query) {
      return ctx.reply("❗ कृपया कोई फ़िल्म या सीरीज़ का नाम दर्ज करें!");
    }

    const apiKey = "8f50e26e"; // Replace with your OMDb API key
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(query)}&apikey=${apiKey}`;

    try {
      const res = await axios.get(url);
      const data = res.data;

      if (data.Response === "False") {
        return ctx.reply(`❌ IMDb पर *${query}* से संबंधित कोई जानकारी नहीं मिली।`);
      }

      let message = `🎬 *${data.Title}* (${data.Year})\n⭐ IMDB रेटिंग: ${data.imdbRating}/10\n🎭 Genre: ${data.Genre}\n🎬 डायरेक्टर: ${data.Director}\n📜 कहानी: ${data.Plot}\n🌍 देश: ${data.Country}\n\n🔗 IMDb: https://www.imdb.com/title/${data.imdbID}/`;

      if (data.Poster && data.Poster !== "N/A") {
        await ctx.replyWithPhoto({ url: data.Poster }, {
          caption: message,
          parse_mode: "Markdown"
        });
      } else {
        message += `\n\n_Poster available नहीं है_`;
        await ctx.reply(message, { parse_mode: "Markdown" });
      }

    } catch (error) {
      console.error("IMDb API Error:", error.message);
      ctx.reply("⚠️ IMDb API से डेटा लाने में समस्या हो रही है। बाद में पुनः प्रयास करें!");
    }
  }
};
