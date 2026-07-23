#!/usr/bin/env node
// Generates public/feed.xml (a podcast-style RSS feed) from
// public/mixes.json, so the mixes can be followed in Apple Podcasts,
// Overcast, etc. by URL — no submission to a directory required.
// Run manually after editing mixes.json, then redeploy public/.
const fs = require("fs");
const path = require("path");
const https = require("https");

const REPO_ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");
const MIXES_JSON = path.join(PUBLIC_DIR, "mixes.json");
const CONFIG_JS = path.join(PUBLIC_DIR, "config.js");
const FEED_XML = path.join(PUBLIC_DIR, "feed.xml");

const SITE_URL = "https://mixhoster.com/";
const SHOW_TITLE = "Mixes";
const SHOW_DESCRIPTION = "A DJ mix archive.";
const SHOW_AUTHOR = "Tim Dionne";
const SHOW_EMAIL = "tim@thedionnes.cc";
const SHOW_COVER_URL = `${SITE_URL}cover.jpg`;

function getAudioBaseUrl() {
  const src = fs.readFileSync(CONFIG_JS, "utf8");
  const match = src.match(/AUDIO_BASE_URL\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("Couldn't find AUDIO_BASE_URL in config.js");
  return match[1];
}

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc2822(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  // mixes.json only carries a date, not a time — anchor at noon UTC so
  // the day doesn't shift backwards for readers west of UTC.
  return new Date(Date.UTC(year, month - 1, day, 12)).toUTCString();
}

function durationHMS(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function headContentLength(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "HEAD" }, (res) => {
      res.resume();
      const length = res.headers["content-length"];
      resolve(length ? parseInt(length, 10) : 0);
    });
    req.on("error", reject);
    req.end();
  });
}

async function buildItem(mix, audioBaseUrl) {
  const audioUrl = new URL(mix.audio, audioBaseUrl).href;
  const length = await headContentLength(audioUrl);
  return `
  <item>
    <title>${xmlEscape(mix.title)}</title>
    <guid isPermaLink="false">${xmlEscape(mix.slug)}</guid>
    <pubDate>${rfc2822(mix.date)}</pubDate>
    <description>${xmlEscape(mix.description || mix.title)}</description>
    <enclosure url="${xmlEscape(audioUrl)}" length="${length}" type="audio/mpeg" />
    <itunes:duration>${durationHMS(mix.durationSeconds || 0)}</itunes:duration>
    <itunes:explicit>false</itunes:explicit>
  </item>`;
}

async function main() {
  const audioBaseUrl = getAudioBaseUrl();
  const mixes = JSON.parse(fs.readFileSync(MIXES_JSON, "utf8"));
  const sorted = mixes.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  const items = await Promise.all(sorted.map((mix) => buildItem(mix, audioBaseUrl)));

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${xmlEscape(SHOW_TITLE)}</title>
  <link>${xmlEscape(SITE_URL)}</link>
  <atom:link href="${xmlEscape(SITE_URL)}feed.xml" rel="self" type="application/rss+xml" />
  <description>${xmlEscape(SHOW_DESCRIPTION)}</description>
  <language>en-us</language>
  <itunes:author>${xmlEscape(SHOW_AUTHOR)}</itunes:author>
  <itunes:owner>
    <itunes:name>${xmlEscape(SHOW_AUTHOR)}</itunes:name>
    <itunes:email>${xmlEscape(SHOW_EMAIL)}</itunes:email>
  </itunes:owner>
  <itunes:image href="${xmlEscape(SHOW_COVER_URL)}" />
  <itunes:category text="Music" />
  <itunes:explicit>false</itunes:explicit>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items.join("")}
</channel>
</rss>
`;

  fs.writeFileSync(FEED_XML, feed);
  console.log(`Wrote ${FEED_XML} (${sorted.length} episodes).`);

  if (!fs.existsSync(path.join(PUBLIC_DIR, "cover.jpg"))) {
    console.warn(
      "Warning: public/cover.jpg is missing. itunes:image points at a URL " +
        "that won't resolve yet — add a square 1400-3000px jpg before " +
        "sharing the feed."
    );
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
