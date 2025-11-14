// =========================================================
// utils/download.js — YTDLP + SPOTDL (Render Safe)
// =========================================================

const fs = require("fs-extra");
const path = require("path");
const { ytdlp } = require("yt-dlp-exec");
const Spotify = require("spotifydl-core");

const TMP = path.join(__dirname, "..", "tmp");
fs.ensureDirSync(TMP);

// Spotify client (optional)
let spot = null;
if (process.env.SPOTIFY_ID && process.env.SPOTIFY_SECRET) {
  spot = new Spotify({
    clientId: process.env.SPOTIFY_ID,
    clientSecret: process.env.SPOTIFY_SECRET
  });
}

// Detect URL types
const isYouTube = url =>
  /(youtube\.com|youtu\.be)/i.test(url);

const isSpotify = url =>
  /open\.spotify\.com\/(track|playlist|album)/i.test(url);

/**
 * downloadAudio(url, outPath)
 */
async function downloadAudio(url, outPath) {
  // ==========================
  // SPOTIFY
  // ==========================
  if (isSpotify(url)) {
    if (!spot) throw new Error("Spotify keys missing");

    try {
      console.log("SPOTIFY → downloading…");

      const mp3 = await spot.downloadTrack(url); // Buffer
      fs.writeFileSync(outPath, mp3);

      console.log("SPOTIFY success");
      return;
    } catch (err) {
      console.log("SPOTIFY error:", err.message);
      throw new Error("Spotify download failed");
    }
  }

  // ==========================
  // YOUTUBE → YTDLP EXEC
  // ==========================
  if (isYouTube(url)) {
    try {
      console.log("YOUTUBE → yt-dlp downloading…");

      await ytdlp(url, {
        extractAudio: true,
        audioFormat: "mp3",
        output: outPath,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        ignoreErrors: true,
        retries: 2
      });

      console.log("YTDLP success");
      return;
    } catch (err) {
      console.log("YTDLP error:", err.message);
      throw new Error("YouTube download failed");
    }
  }

  // ==========================
  // INVALID LINK
  // ==========================
  throw new Error("Unsupported URL (not YT or Spotify)");
}

module.exports = downloadAudio;
