// ===============================================
// utils/download.js — FINAL 5-ENGINE DOWNLOADER
// ===============================================

const fs = require("fs-extra");
const ytdl = require("@distube/ytdl-core");   // Engine 1
const axios = require("axios");               // Engine 3,4,5
const path = require("path");

// Ensure tmp exists
const TMP = path.join(__dirname, "..", "tmp");
fs.ensureDirSync(TMP);

// Small helper
const delay = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * downloadAudio(url, outPath)
 * Returns: Promise<void>
 */
async function downloadAudio(url, outPath) {

  // ===============================
  // ENGINE 1 — ytdl-core (distube)
  // ===============================
  try {
    if (ytdl.validateURL(url)) {
      await new Promise((resolve, reject) => {
        ytdl(url, {
          filter: "audioonly",
          quality: "highestaudio",
          highWaterMark: 1 << 25
        })
        .pipe(fs.createWriteStream(outPath))
        .on("finish", resolve)
        .on("error", reject);
      });

      console.log("ENGINE 1: ytdl-core success");
      return;
    }
  } catch (err) {
    console.log("ENGINE 1 error:", err.message);
  }

  // Short cooldown
  await delay(400);

  // =====================================
  // ENGINE 2 — Quick API (YouTube-dl web)
  // =====================================
  try {
    const api = `https://api-v2.musicallydown.com/download?url=${encodeURIComponent(url)}`;
    const r = await axios.get(api);
    if (r.data?.audio) {
      const mp3 = await axios.get(r.data.audio, { responseType: "arraybuffer" });
      fs.writeFileSync(outPath, mp3.data);
      console.log("ENGINE 2 success");
      return;
    }
  } catch (err) {
    console.log("ENGINE 2 error:", err.message);
  }

  await delay(400);

  // ======================
  // ENGINE 3 — SaveTube.io
  // ======================
  try {
    const api = `https://api.savetube.io/info?url=${encodeURIComponent(url)}`;
    const info = await axios.get(api);

    const audio = info.data?.audios?.[0];
    if (audio?.url) {
      const mp3 = await axios.get(audio.url, { responseType: "arraybuffer" });
      fs.writeFileSync(outPath, mp3.data);
      console.log("ENGINE 3 success");
      return;
    }
  } catch (err) {
    console.log("ENGINE 3 error:", err.message);
  }

  await delay(400);

  // ===========================
  // ENGINE 4 — ytop1.com / API
  // ===========================
  try {
    const api = `https://ytop1.com/api?url=${encodeURIComponent(url)}&format=mp3`;
    const r = await axios.get(api);

    if (r.data?.download) {
      const mp3 = await axios.get(r.data.download, { responseType: "arraybuffer" });
      fs.writeFileSync(outPath, mp3.data);
      console.log("ENGINE 4 success");
      return;
    }
  } catch (err) {
    console.log("ENGINE 4 error:", err.message);
  }

  await delay(400);

  // =======================================
  // ENGINE 5 — YT5 Downloader (final backup)
  // =======================================
  try {
    const api = `https://api.yt5s.io/api/ajaxSearch?vid=${encodeURIComponent(url)}`;
    const r = await axios.get(api);

    const link = r.data?.links?.mp3?.["128"]?.dlink;
    if (link) {
      const mp3 = await axios.get(link, { responseType: "arraybuffer" });
      fs.writeFileSync(outPath, mp3.data);
      console.log("ENGINE 5 success");
      return;
    }
  } catch (err) {
    console.log("ENGINE 5 error:", err.message);
  }

  // If all failed:
  throw new Error("All engines failed.");
}

module.exports = downloadAudio;
