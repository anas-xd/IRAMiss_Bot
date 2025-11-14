// commands/song.js
const yts = require("yt-search");
const ytdl = require("ytdl-core");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

// tmp dir for downloads
const TMP = path.join(__dirname, "..", "tmp");
fs.ensureDirSync(TMP);

async function getSpotifyMeta(title) {
  const id = process.env.SPOTIFY_ID;
  const secret = process.env.SPOTIFY_SECRET;
  if (!id || !secret) return null;
  try {
    const SpotifyWebApi = require("spotify-web-api-node");
    const spotify = new SpotifyWebApi({ clientId: id, clientSecret: secret });
    const token = (await spotify.clientCredentialsGrant()).body.access_token;
    spotify.setAccessToken(token);
    const res = await spotify.searchTracks(title, { limit: 1 });
    if (res.body.tracks.items.length === 0) return null;
    const t = res.body.tracks.items[0];
    return {
      artist: t.artists.map(a => a.name).join(", "),
      album: t.album.name,
      release_date: t.album.release_date,
      popularity: t.popularity,
      album_image: t.album.images?.[0]?.url || null,
      spotify_url: t.external_urls?.spotify || null
    };
  } catch (e) {
    // ignore spotify errors
    return null;
  }
}

function escapeHtml(s = "") {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

module.exports = {
  name: "song",
  description: "Search a song on YouTube (and Spotify meta) and download audio. Usage: /song <name>",
  cooldown: 3,

  run: async (ctx, args) => {
    const query = args.join(" ").trim();
    if (!query) return ctx.reply("🎵 Use: /song <song name>");

    // 1) initial temporary message
    const searching = await ctx.reply(`⏳ Searching for: <b>${escapeHtml(query)}</b>`, { parse_mode: "HTML" });

    try {
      // 2) YouTube search (yt-search)
      const sr = await yts(query);
      const videos = (sr && sr.videos) ? sr.videos.slice(0, 5) : [];

      if (!videos.length) {
        return ctx.editMessageText
          ? ctx.editMessageText("❌ No results found.", { chat_id: searching.chat.id, message_id: searching.message_id })
          : ctx.reply("❌ No results found.");
      }

      // store session globally by user id (so callback handler knows)
      const uid = String(ctx.from.id);
      global.songSessions = global.songSessions || {};
      global.songSessions[uid] = { query, videos, createdAt: Date.now() };

      // build the message text
      let msg = `🎵 <b>Showing results for:</b> <i>${escapeHtml(query)}</i>\n\n`;
      videos.forEach((v, i) => {
        msg += `<b>${i+1}.</b> ${escapeHtml(v.title)}\n⏱ ${v.timestamp} • 👁 ${v.views.toLocaleString()} • ${escapeHtml(v.author.name)}\n\n`;
      });

      // create grid inline keyboard (Option 3: Advanced Grid with titles)
      // We'll make 2 columns per row where possible
      const keyboard = { inline_keyboard: [] };
      for (let i = 0; i < videos.length; i += 2) {
        const row = [];
        // left
        const left = videos[i];
        row.push({
          text: `🎵 ${i+1}. ${left.title.length > 30 ? left.title.slice(0,27)+"…" : left.title}`,
          callback_data: `song_play:${uid}:${i}`
        });
        // right (if exists)
        if (i + 1 < videos.length) {
          const right = videos[i+1];
          row.push({
            text: `🎵 ${i+2}. ${right.title.length > 30 ? right.title.slice(0,27)+"…" : right.title}`,
            callback_data: `song_play:${uid}:${i+1}`
          });
        }
        keyboard.inline_keyboard.push(row);
      }
      // final row: cancel
      keyboard.inline_keyboard.push([{ text: "Cancel ❌", callback_data: `song_cancel:${uid}` }]);

      // 3) edit previous message to show results + buttons
      await ctx.telegram.editMessageText(searching.chat.id, searching.message_id, null, msg, {
        parse_mode: "HTML",
        reply_markup: keyboard
      });
    } catch (e) {
      console.error("song.run error:", e);
      try { await ctx.telegram.editMessageText(searching.chat.id, searching.message_id, null, "⚠️ Search failed."); } catch {}
    }
  },

  // export helper for callback handler use
  getSpotifyMeta
};
