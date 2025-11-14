// ==========================================
// commands/song.js — FINAL REBUILD
// ==========================================

const yts = require("yt-search");
const fs = require("fs-extra");
const path = require("path");

// TMP DIR
const TMP = path.join(__dirname, "..", "tmp");
fs.ensureDirSync(TMP);

// OPTIONAL SPOTIFY META
async function getSpotifyMeta(title) {
  const ID = process.env.SPOTIFY_ID;
  const SECRET = process.env.SPOTIFY_SECRET;
  if (!ID || !SECRET) return null;

  try {
    const SpotifyWebApi = require("spotify-web-api-node");
    const api = new SpotifyWebApi({ clientId: ID, clientSecret: SECRET });

    const token = (await api.clientCredentialsGrant()).body.access_token;
    api.setAccessToken(token);

    const res = await api.searchTracks(title, { limit: 1 });
    if (!res.body.tracks.items.length) return null;

    const t = res.body.tracks.items[0];
    return {
      artist: t.artists.map(a => a.name).join(", "),
      album: t.album.name,
      release_date: t.album.release_date,
      popularity: t.popularity,
      album_image: t.album.images?.[0]?.url || null,
      spotify_url: t.external_urls?.spotify || null
    };
  } catch {
    return null;
  }
}

const esc = s =>
  String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");

module.exports = {
  name: "song",
  description: "Search and download any song",
  cooldown: 3,

  run: async (ctx, args) => {
    const query = args.join(" ").trim();
    if (!query) return ctx.reply("🎵 Use: /song <song name>");

    // Temporary "searching" message
    const msg = await ctx.reply(
      `⏳ Searching for: <b>${esc(query)}</b>`,
      { parse_mode: "HTML" }
    );

    try {
      // ================
      // 1) YOUTUBE SEARCH
      // ================
      const result = await yts(query);
      const videos = result?.videos?.slice(0, 6) || [];

      if (!videos.length) {
        return ctx.telegram.editMessageText(
          msg.chat.id,
          msg.message_id,
          null,
          "❌ No results found."
        );
      }

      // Store user session
      const uid = String(ctx.from.id);
      global.songSessions = global.songSessions || {};
      global.songSessions[uid] = {
        query,
        videos,
        createdAt: Date.now()
      };

      // ====================
      // 2) BUILD RESULT TEXT
      // ====================
      let text = `🎵 <b>Showing results for:</b> <i>${esc(query)}</i>\n\n`;

      videos.forEach((v, i) => {
        text += `<b>${i + 1}.</b> ${esc(v.title)}\n`;
        text += `⏱ ${v.timestamp} • 👁 ${v.views.toLocaleString()} • ${esc(v.author.name)}\n\n`;
      });

      // ======================
      // 3) INLINE GRID BUTTONS
      // ======================
      const kb = { inline_keyboard: [] };

      for (let i = 0; i < videos.length; i += 2) {
        const row = [];

        const v1 = videos[i];
        row.push({
          text: `🎵 ${i + 1}. ${v1.title.length > 28 ? v1.title.slice(0, 25) + "…" : v1.title}`,
          callback_data: `song_play:${uid}:${i}`
        });

        if (videos[i + 1]) {
          const v2 = videos[i + 1];
          row.push({
            text: `🎵 ${i + 2}. ${v2.title.length > 28 ? v2.title.slice(0, 25) + "…" : v2.title}`,
            callback_data: `song_play:${uid}:${i + 1}`
          });
        }

        kb.inline_keyboard.push(row);
      }

      kb.inline_keyboard.push([
        { text: "❌ Cancel", callback_data: `song_cancel:${uid}` }
      ]);

      // ===========================
      // 4) EDIT MESSAGE TO RESULTS
      // ===========================
      await ctx.telegram.editMessageText(
        msg.chat.id,
        msg.message_id,
        null,
        text,
        {
          parse_mode: "HTML",
          reply_markup: kb
        }
      );

    } catch (err) {
      console.log("❌ song.js error:", err.message);
      await ctx.telegram.editMessageText(
        msg.chat.id,
        msg.message_id,
        null,
        "⚠️ Search failed."
      );
    }
  },

  getSpotifyMeta
};
