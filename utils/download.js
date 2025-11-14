// =========================================================
// utils/download.js — YTDLP only (Spotify metadata allowed)
// =========================================================

const fs = require("fs-extra");
const path = require("path");
const { ytdlp } = require("yt-dlp-exec");

// TMP folder
const TMP = path.join(__dirname, "..", "tmp");
fs.ensureDirSync(TMP);

// URL detectors
const isYouTube = url =>
  /(youtube\.com|youtu\.be)/i.test(url);

const isSpotify = url =>
  /open\.spotify\.com\/track/i.test(url);

// MAIN FUNCTION
async function downloadAudio(url, outPath) {

  // ==================================================
  // SPOTIFY (metadata only — NO DOWNLOAD)
  // ==================================================
  if (isSpotify(url)) {
    throw new Error(
      "Spotify audio download disabled. Use metadata only."
    );
  }

  // ==================================================
  // YOUTUBE DOWNLOAD (yt-dlp-exec)
  // ==================================================
  if (isYouTube(url)) {
    try {
      console.log("YTDLP → downloading…");

      await ytdlp(url, {
        extractAudio: true,
        audioFormat: "mp3",
        output: outPath,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true
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
