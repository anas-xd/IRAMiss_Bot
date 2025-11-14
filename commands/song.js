// =========================================================
// commands/song.js — YouTube + Spotify Metadata (SAFE)
// =========================================================

const yt = require("yt-search");
const SpotifyWebApi = require("spotify-web-api-node");

// Spotify (metadata only)
const spotify = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_ID || "",
  clientSecret: process.env.SPOTIFY_SECRET || ""
});

/**
 * Convert Spotify Track → YouTube Search Query
 */
async function getSpotifyInfo(url) {
  try {
    const token = await spotify.clientCredentialsGrant();
    spotify.setAccessToken(token.body.access_token);

    const id = url.split("/track/")[1]?.split("?")[0];
    if (!id) return null;

    const res = await spotify.getTrack(id);
    const t = res.body;

    return {
      title: t.name,
      artist: t.artists.map(a => a.name).join(", "),
      album: t.album?.name || "",
      thumbnail: t.album.images?.[0]?.url || "",
      search: `${t.name} ${t.artists[0].name} audio`
    };
  } catch (err) {
    console.log("Spotify metadata error:", err.message);
    return null;
  }
}

// =========================================================
// SONG COMMAND
// =========================================================

module.exports = {
  name: "song",

  run: async (ctx, args) => {
    const q = args.join(" ");
    if (!q) return ctx.reply("⚠️ Please give a song name or link.");

    let searchQuery = q;
    let meta = null;

    // ==========================================
    // SPOTIFY LINK DETECTED → FETCH METADATA
    // ==========================================
    if (q.includes("spotify.com/track/")) {
      meta = await getSpotifyInfo(q);

      if (!meta)
        return ctx.reply("❌ Could not read Spotify metadata.");

      searchQuery = meta.search;
    }

    // ==========================================
    // YOUTUBE SEARCH
    // ==========================================
    const res = await yt(searchQuery);
    if (!res.videos.length)
      return ctx.reply("❌ No results found.");

    // Pick top 5 results
    const videos = res.videos.slice(0, 5);

    const uid = String(ctx.from.id);

    global.songSessions[uid] = {
      videos: videos.map(v => ({
        title: meta?.title || v.title,
        author: meta?.artist || v.author.name,
        url: v.url,
        thumbnail: meta?.thumbnail || v.thumbnail
      }))
    };

    // ============================
    // Inline keyboard (callback)
    // ============================

    const keyboard = videos.map((v, i) => ([{
      text: `${i + 1}. ${v.title.slice(0, 32)}`,
      callback_data: `song_play:${uid}:${i}`
    }]));

    keyboard.push([
      { text: "❌ Cancel", callback_data: `song_cancel:${uid}:x` }
    ]);

    return ctx.reply(
      meta
        ? `🎵 *${meta.title}*\n👤 ${meta.artist}\n\nChoose version ↓`
        : `🎵 Search results:\n\nChoose one ↓`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
      }
    );
  }
};
