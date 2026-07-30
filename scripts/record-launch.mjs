/**
 * Records the /launch film to an MP4.
 *
 * Not a screen capture: the page is a pure function of time, so this sets a
 * time, waits for the paint, photographs it, and moves on. Frames therefore
 * cost whatever they cost — a slow one can't drop, stutter or desync the
 * animations, which is the failure mode of recording in real time.
 *
 * PNG frames are piped straight into ffmpeg rather than written to disk; a
 * 75-second render is ~2,300 frames and there's no reason to touch the disk
 * twice.
 *
 *   node scripts/record-launch.mjs --aspect 16:9 --out kairo-launch-16x9.mp4
 *   node scripts/record-launch.mjs --aspect 9:16 --fps 30 --to 4000   # preview
 */

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = process.env.LAUNCH_URL ?? "http://localhost:3010/launch";

const SIZES = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const aspect = arg("aspect", "16:9");
const fps = Number(arg("fps", 30));
const outDir = arg("dir", "out");
const out = path.resolve(outDir, arg("out", `kairo-launch-${aspect.replace(":", "x")}.mp4`));
const from = Number(arg("from", 0));
const size = SIZES[aspect];
if (!size) throw new Error(`Unknown aspect ${aspect}. Try one of: ${Object.keys(SIZES).join(", ")}`);

mkdirSync(path.dirname(out), { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: [
    "--force-color-profile=srgb",
    "--font-render-hinting=none",
    "--disable-lcd-text", // subpixel AA fringes on a video look like chroma noise
    "--hide-scrollbars",
  ],
});

const page = await browser.newPage();
await page.setViewport({ ...size, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
page.on("pageerror", (e) => console.error("  page error:", String(e).split("\n")[0]));

// domcontentloaded, not networkidle: the page signals its own readiness with
// __ready once the film has mounted, which is the condition that actually
// matters. Waiting on network quiet just adds a way for this to time out.
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForFunction(() => window.__ready === true, { timeout: 30_000 });
await page.evaluate(() => document.fonts.ready);

const duration = Number(arg("to", await page.evaluate(() => window.__duration)));
const total = Math.ceil(((duration - from) / 1000) * fps);

console.log(`${aspect}  ${size.width}×${size.height}  ${fps}fps  ${(duration / 1000).toFixed(1)}s  ${total} frames`);
console.log(`→ ${out}`);

const ff = spawn(
  "ffmpeg",
  [
    "-y",
    "-f", "image2pipe",
    "-framerate", String(fps),
    "-i", "-",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "17",
    // yuv420p is the only chroma format every player and social platform
    // reliably decodes; without it Safari and Twitter show a black rectangle
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    out,
  ],
  { stdio: ["pipe", "ignore", "pipe"] }
);

let ffErr = "";
ff.stderr.on("data", (d) => (ffErr += d.toString()));
const done = new Promise((resolve, reject) => {
  ff.on("close", (code) =>
    code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${ffErr.slice(-2000)}`))
  );
});

const started = Date.now();
for (let i = 0; i < total; i++) {
  const t = from + (i * 1000) / fps;
  await page.evaluate(async (ms) => { await window.__seek(ms); }, t);
  const buf = await page.screenshot({ type: "png", optimizeForSpeed: true });

  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));

  if (i % 60 === 0 || i === total - 1) {
    const pct = ((i + 1) / total) * 100;
    const rate = (i + 1) / ((Date.now() - started) / 1000);
    const left = (total - i - 1) / Math.max(rate, 0.01);
    process.stdout.write(
      `\r  ${pct.toFixed(1)}%  frame ${i + 1}/${total}  ${rate.toFixed(1)} fps  ~${Math.ceil(left / 60)}m left   `
    );
  }
}

ff.stdin.end();
await done;
await browser.close();
console.log(`\n✓ ${out}  (${((Date.now() - started) / 1000 / 60).toFixed(1)} min)`);
