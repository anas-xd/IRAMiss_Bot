// commands/song.js
const yts = require("yt-search");
const ytdl = require("ytdl-core");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// NOTE: This file expects index.js to register
//  - a callback_query handler that handles callback_data starting with "song_"
//  - a text-number handler (1-5) that triggers selection if user replies with a number
//
// I'll include the index.js snippets below — add them where your bot handlers are defined.

const TMP_DIR = path.join(__dirname, "..", "tmp");
fs.ensureDirSync(TMP_DIR);

// Per-user search storage (kept in memory)
global.songResults = global.songResults || {};

async function getSpotifyMeta(title) {
  // optional: search spotify if credentials provided
  const clientId = process.env.SPOTIFY_ID;
  const clientSecret = process.env.SPOTIFY_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const SpotifyWebApi = require("spotify-web-api-node");
    const spotify = new SpotifyWebApi({ clientId, clientSecret });
    const token = (await spotify.clientCredentialsGrant()).body.access_token;
    spotify.setAccessToken(token);

    const res = await spotify.searchTracks(title, { limit: 1 });
    if (res.body.tracks.items.length === 0) return null;
    const track = res.body.tracks.items[0];

    return {
      artist: track.artists.map(a => a.name).join(", "),
      album: track.album.name,
      release_date: track.album.release_date,
      popularity: track.popularity,
      spotify_url: track.external_urls.spotify,
      album_image: track.album.images?.[0]?.url || null
    };
  } catch (e) {
    console.warn("Spotify metadata error:", e?.message || e);
    return null;
  }
}

module.exports = {
  name: "song",
  description: "Search song on YouTube (and Spotify metadata). Usage: /song <name>",
  cooldown: 3,
  run: async (ctx, args) => {
    try {
      const query = args && args.length ? args.join(" ") : null;
      if (!query) return ctx.reply("🎵 Please provide a song name. Example: `/song shape of you`");

      await ctx.reply(`🔎 Searching for: <b>${query}</b>`, { parse_mode: "HTML" });

      const res = await yts(query);
      const videos = (res && res.videos) ? res.videos.slice(0, 5) : [];

      if (!videos.length) return ctx.reply("❌ No results found for that query.");

      // store per-user
      const uid = String(ctx.from.id);
      global.songResults[uid] = videos;

      // Build list message
      let listMsg = `🎶 <b>Search results for:</b> <i>${query}</i>\n\n`;
      videos.forEach((v, i) => {
        listMsg += `<b>${i + 1}.</b> ${escapeHtml(v.title)}\n`;
        listMsg += `⏱ ${v.timestamp} • 👁 ${v.views.toLocaleString()} • ${escapeHtml(v.author.name)}\n\n`;
      });

      // Inline keyboard: select 1..N
      const rows = videos.map((v, i) => [{ text: `${i + 1}. ${truncate(v.title, 40)}`, callback_data: `song_select:${uid}:${i}` }]);
      // add a cancel row
      rows.push([{ text: "Cancel ❌", callback_data: `song_cancel:${uid}` }]);

      await ctx.replyWithHTML(listMsg, {
        reply_markup: {
          inline_keyboard: rows
        }
      });

      // note: user can also reply with a number (1-5) — index.js snippet handles that
    } catch (err) {
      console.error("song.run error:", err);
      ctx.reply("⚠️ Something went wrong while searching.");
    }
  }
};

// helpers
function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
