#!/usr/bin/env node
// Local helper for the chrome-extension/ popup's "Launch remux" button.
// Binds to 127.0.0.1 only, and only answers requests whose Origin is a
// chrome-extension:// page — a regular webpage's fetch() can't spoof
// that header, so this can't be triggered by arbitrary sites you visit
// while the server happens to be running.
const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const REPO_ROOT = path.resolve(__dirname, "..");
const MIXES_JSON = path.join(REPO_ROOT, "public", "mixes.json");
const PORT = 8787;

const SLUG_RE = /^[a-z0-9-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https:\/\/[a-z0-9.-]+\.mixcloud\.stream\//i;

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let stderr = "";
    child.stdout.on("data", () => {});
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`));
    });
    child.on("error", reject);
  });
}

async function getDurationSeconds(mp3Path) {
  let stdout = "";
  await new Promise((resolve, reject) => {
    const child = spawn("afinfo", [mp3Path]);
    child.stdout.on("data", (d) => (stdout += d));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error("afinfo failed"))));
    child.on("error", reject);
  });
  const match = stdout.match(/estimated duration:\s*([\d.]+)/);
  return match ? Math.round(parseFloat(match[1])) : null;
}

async function recoverMix({ slug, title, date, url }) {
  if (!slug || !title || !date || !url) {
    throw new Error("slug, title, date, and url are all required");
  }
  if (!SLUG_RE.test(slug)) {
    throw new Error("slug must be lowercase letters, numbers, and hyphens only");
  }
  if (!DATE_RE.test(date)) {
    throw new Error("date must be YYYY-MM-DD");
  }
  if (!URL_RE.test(url)) {
    throw new Error("url must be an https://*.mixcloud.stream/ URL");
  }

  const outPath = path.join(os.homedir(), "Downloads", `${slug}.mp3`);
  await run("ffmpeg", ["-y", "-i", url, "-c:a", "libmp3lame", "-q:a", "2", outPath]);

  const durationSeconds = await getDurationSeconds(outPath);

  await run(
    "npx",
    ["wrangler", "r2", "object", "put", `music/${slug}.mp3`, `--file=${outPath}`, "--content-type=audio/mpeg", "--remote"],
    { cwd: REPO_ROOT }
  );

  const mixes = JSON.parse(fs.readFileSync(MIXES_JSON, "utf8"));
  mixes.push({ slug, title, date, description: "", audio: `${slug}.mp3`, durationSeconds });
  fs.writeFileSync(MIXES_JSON, JSON.stringify(mixes, null, 2) + "\n");

  return { outPath, durationSeconds };
}

function isTrustedOrigin(origin) {
  return typeof origin === "string" && origin.startsWith("chrome-extension://");
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  const trusted = isTrustedOrigin(origin);

  if (trusted) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    res.writeHead(trusted ? 204 : 403);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (!trusted) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "untrusted origin" }));
    return;
  }

  if (req.method === "POST" && req.url === "/recover") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const params = JSON.parse(body);
        console.log(`Recovering "${params.title}" (${params.date}) from ${params.url}`);
        const result = await recoverMix(params);
        console.log(`Done: ${result.outPath} (${result.durationSeconds}s)`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, ...result }));
      } catch (err) {
        console.error(err.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mixhoster recovery helper listening on http://127.0.0.1:${PORT}`);
  console.log("Leave this running, then use the extension's \"Launch remux\" button. Ctrl+C to stop.");
});
