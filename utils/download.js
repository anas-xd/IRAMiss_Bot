// =========================================================
// utils/download.js — YTDLP + Spotify (Render Safe)
// =========================================================

const fs = require("fs-extra");
const path = require("path");
const ytdlp = require("yt-dlp-exec"); // ✅ FIXED
const Spotify = require("@nechlophomeriaa/spotifydl").default;

const TMP = path.join(__dirname, "..", "tmp");
fs.ensureDirSync(TMP);

// Spotify client
let spot = null;
if (process.env.SPOTIFY_ID && process.env.SPOTIFY_SECRET) {
  spot = new Spotify({
    clientId: process.env.SPOTIFY_ID,
    clientSecret: process.env.SPOTIFY_SECRET,
  });
}

// URL detectors
const isYouTube = (url) => /(youtube\.com|youtu\.be)/i.test(url);
const isSpotify = (url) => /open\.spotify\.com\/(track)/i.test(url);

// MAIN FUNCTION
async function downloadAudio(url, outPath) {
  // ==========================
  // SPOTIFY
  // ==========================
  if (isSpotify(url)) {
    if (!spot) throw new Error("Spotify keys missing");

    try {
      console.log("SPOTIFY → downloading…");
      const track = await spot.downloadTrack(url); // Buffer
      fs.writeFileSync(outPath, track);
      console.log("SPOTIFY success");
      return;
    } catch (err) {
      console.log("SPOTIFY error:", err.message);
      throw new Error("Spotify download failed");
    }
  }

  // ==========================
  // YOUTUBE (yt-dlp-exec)
  // ==========================
  if (isYouTube(url)) {
    try {
      console.log("YTDLP → downloading…");

      await ytdlp(url, {
        extractAudio: true,
        audioFormat: "mp3",
        output: outPath,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
      });

      console.log("YTDLP success");
      return;
    } catch (err) {
      console.log("YTDLP error:", err.message);
      throw new Error("YouTube download failed");
    }
  }

  throw new Error("Unsupported URL");
}

module.exports = downloadAudio;
