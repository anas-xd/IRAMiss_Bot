// =======================================================
// commands/song.js — FINAL ULTRA CLEAN REBUILD (2025)
// Compatible with 5-engine downloader
// =======================================================

const yts = require("yt-search");
const downloadAudio = require("../utils/download");
const fs = require("fs-extra");
const path = require("path");

const TMP = path.join(__dirname, "..", "tmp");
fs.ensureDirSync(TMP);

// Escape HTML safely
const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// =======================================================
// OPTIONAL SPOTIFY ENRICH DATA
// =======================================================
async function getSpotifyInfo(title) {
  try {
    const ID = process.env.SPOTIFY_ID;
    const SECRET = process.env.SPOTIFY_SECRET;
    if (!ID || !SECRET) return null;

    const SpotifyAPI = require("spotify-web-api-node");
    const api = new SpotifyAPI({ clientId: ID, clientSecret: SECRET });

    const token = (await api.clientCredentialsGrant()).body.access_token;
    api.setAccessToken(token);

    const data = await api.searchTracks(title, { limit: 1 });
    if (!data.body.tracks.items.length) return null;

    const s = data.body.tracks.items[0];
    return {
      artist: s.artists.map(a => a.name).join(", "),
      album: s.album.name,
      release: s.album.release_date,
      cover: s.album.images?.[0]?.url || null,
      url: s.external_urls?.spotify || null
    };
  } catch {
    return null;
  }
}

// =======================================================
// EXPORT COMMAND
// =======================================================
module.exports = {
  name: "song",
  description: "Search YouTube & download any song.",
  cooldown: 2,

  run: async (ctx, args) => {
    const query = args.join(" ").trim();
    if (!query) return ctx.reply("🎵 Use: /song <song name>");

    // Temporary message
    const msg = await ctx.reply(`⏳ Searching for <b>${esc(query)}</b>...`, {
      parse_mode: "HTML",
    });

    try {
      // ---------------------------------------------------
      // 1) Search YouTube
      // ---------------------------------------------------
      const r = await yts(query);
      const videos = r?.videos?.slice(0, 6) || [];

      if (!videos.length) {
        return ctx.telegram.editMessageText(
          msg.chat.id,
          msg.message_id,
          null,
          "❌ No result found.",
        );
      }

      // ---------------------------------------------------
      // 2) Save user search session
      // ---------------------------------------------------
      const uid = String(ctx.from.id);
      global.songSessions[uid] = {
        videos,
        createdAt: Date.now(),
      };

      // ---------------------------------------------------
      // 3) Clean result text
      // ---------------------------------------------------
      let txt = `🎵 <b>Results for:</b> <i>${esc(query)}</i>\n\n`;

      videos.forEach((v, i) => {
        txt += `<b>${i + 1}.</b> ${esc(v.title)}\n`;
        txt += `⏱ ${v.timestamp} • 👁 ${v.views.toLocaleString()} • ${esc(
          v.author.name
        )}\n\n`;
      });

      // ---------------------------------------------------
      // 4) Inline Buttons (2 per row)
      // ---------------------------------------------------
      const kb = [];
      for (let i = 0; i < videos.length; i += 2) {
        const row = [];

        const v1 = videos[i];
        row.push({
          text: `🎵 ${i + 1}`,
          callback_data: `song_play:${uid}:${i}`,
        });

        if (videos[i + 1]) {
          row.push({
            text: `🎵 ${i + 2}`,
            callback_data: `song_play:${uid}:${i + 1}`,
          });
        }

        kb.push(row);
      }

      kb.push([{ text: "❌ Cancel", callback_data: `song_cancel:${uid}` }]);

      // ---------------------------------------------------
      // 5) Edit message into full result UI
      // ---------------------------------------------------
      await ctx.telegram.editMessageText(
        msg.chat.id,
        msg.message_id,
        null,
        txt,
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: kb },
        }
      );
    } catch (err) {
      console.log("song.js error:", err.message);

      try {
        await ctx.telegram.editMessageText(
          msg.chat.id,
          msg.message_id,
          null,
          "⚠️ Search failed."
        );
      } catch {}
    }
  },
};
