// =========================================================
// utils/download.js — YT-DLP ONLY (Render Safe)
// =========================================================

const fs = require("fs-extra");
const path = require("path");
const ytdlp = require("yt-dlp-exec"); // Correct import

const TMP = path.join(__dirname, "..", "tmp");
fs.ensureDirSync(TMP);

// URL detector
const isYouTube = (url) => /(youtube\.com|youtu\.be)/i.test(url);

// MAIN FUNCTION
async function downloadAudio(url, outPath) {
  if (!isYouTube(url)) {
    throw new Error("Only YouTube links are supported");
  }

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

module.exports = downloadAudio;
