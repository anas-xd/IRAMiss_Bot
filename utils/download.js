// =========================================================
// utils/download.js — FINAL 5-ENGINE DOWNLOADER (SAFE + CLEAN)
// =========================================================

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const ytdl = require("@distube/ytdl-core");   // Engine 1

const TMP = path.join(__dirname, "..", "tmp");
fs.ensureDirSync(TMP);

const delay = ms => new Promise(r => setTimeout(r, ms));

/**
 * downloadAudio(url, outPath)
 * Returns file written OR throws error
 */
async function downloadAudio(url, outPath) {

  // ====================================================
  // ENGINE 1 — ytdl-core (distube) — Fastest native
  // ====================================================
  try {
    if (ytdl.validateURL(url)) {
      await new Promise((resolve, reject) => {
        const stream = ytdl(url, {
          filter: "audioonly",
          quality: "highestaudio",
          highWaterMark: 1 << 25
        });

        stream
          .pipe(fs.createWriteStream(outPath))
          .on("finish", resolve)
          .on("error", reject);
      });

      console.log("ENGINE 1 success (ytdl-core)");
      return;
    }
  } catch (err) {
    console.log("ENGINE 1 error:", err.message);
  }

  await delay(350);

  // ====================================================
  // ENGINE 2 — YouTube Simplify API (Stable JSON API)
  // ====================================================
  try {
    const api = `https://p.oceansaver.in/ajax/analyze?url=${encodeURIComponent(url)}&lang=en`;
    const r = await axios.get(api);

    const audios = r.data?.links?.audios;
    if (Array.isArray(audios) && audios.length > 0) {
      const link = audios[0].link;
      const buff = await axios.get(link, { responseType: "arraybuffer" });
      fs.writeFileSync(outPath, buff.data);

      console.log("ENGINE 2 success (oceansaver)");
      return;
    }
  } catch (err) {
    console.log("ENGINE 2 error:", err.message);
  }

  await delay(350);

  // ====================================================
  // ENGINE 3 — SaveTube (Stable server-side engine)
  // ====================================================
  try {
    const info = await axios.get(`https://api.savetube.me/info?url=${encodeURIComponent(url)}`);
    const audio = info.data?.audios?.[0];

    if (audio?.url) {
      const buff = await axios.get(audio.url, { responseType: "arraybuffer" });
      fs.writeFileSync(outPath, buff.data);

      console.log("ENGINE 3 success (SaveTube)");
      return;
    }
  } catch (err) {
    console.log("ENGINE 3 error:", err.message);
  }

  await delay(350);

  // ====================================================
  // ENGINE 4 — YTGrab / Server-based converter
  // ====================================================
  try {
    const api = `https://converter.download/api/v1/convert?url=${encodeURIComponent(url)}&format=mp3`;
    const r = await axios.get(api);

    if (r.data?.url) {
      const buff = await axios.get(r.data.url, { responseType: "arraybuffer" });
      fs.writeFileSync(outPath, buff.data);

      console.log("ENGINE 4 success (converter.download)");
      return;
    }
  } catch (err) {
    console.log("ENGINE 4 error:", err.message);
  }

  await delay(350);

  // ====================================================
  // ENGINE 5 — yt5s (Correct FIXED Implementation)
  // ====================================================
  try {
    // STEP 1 — Get video ID
    const info = await axios.post(
      "https://yt5s.io/api/ajaxSearch",
      new URLSearchParams({ q: url, vt: "mp3" }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const vid = info.data?.vid;
    if (!vid) throw new Error("Invalid vid");

    // STEP 2 — Request MP3 link
    const conv = await axios.post(
      "https://yt5s.io/api/ajaxConvert",
      new URLSearchParams({ vid, k: info.data.links.mp3["128"].k }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const dl = conv.data?.dlink;
    if (dl) {
      const buff = await axios.get(dl, { responseType: "arraybuffer" });
      fs.writeFileSync(outPath, buff.data);

      console.log("ENGINE 5 success (yt5s)");
      return;
    }
  } catch (err) {
    console.log("ENGINE 5 error:", err.message);
  }

  // ====================================================
  // If ALL engines failed
  // ====================================================
  throw new Error("All 5 download engines failed.");
}

module.exports = downloadAudio;
