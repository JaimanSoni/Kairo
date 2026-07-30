/**
 * Lays the music bed under a silent render from record-launch.mjs.
 *
 * Kept separate from recording because the two change at different rates: the
 * cut gets retimed often, the track almost never. Re-muxing is seconds, while
 * re-rendering is minutes.
 *
 *   node scripts/mux-launch.mjs --video out/kairo-launch-16x9-silent.mp4 \
 *                               --audio out/music.mp3 \
 *                               --out   out/kairo-launch-16x9.mp4
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const video = path.resolve(arg("video"));
const audio = path.resolve(arg("audio"));
const out = path.resolve(arg("out"));
const fadeIn = Number(arg("fade-in", 1.2));
const fadeOut = Number(arg("fade-out", 2.2));

for (const [label, f] of [["video", video], ["audio", audio]]) {
  if (!existsSync(f)) throw new Error(`No ${label} at ${f}`);
}

/** ffprobe a duration in seconds. */
async function duration(file) {
  const p = spawn("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  let outText = "";
  p.stdout.on("data", (d) => (outText += d));
  await new Promise((r) => p.on("close", r));
  return Number(outText.trim());
}

const vDur = await duration(video);
const fadeStart = Math.max(0, vDur - fadeOut);

console.log(`video ${vDur.toFixed(2)}s  ·  fade in ${fadeIn}s, out from ${fadeStart.toFixed(2)}s`);

const ff = spawn(
  "ffmpeg",
  [
    "-y",
    "-i", video,
    "-i", audio,
    "-filter_complex",
    // The bed is generated slightly long on purpose; trim to the picture and
    // fade both ends so it never clips in or cuts off mid-note.
    `[1:a]atrim=0:${vDur},asetpts=N/SR/TB,` +
      `afade=t=in:st=0:d=${fadeIn},` +
      `afade=t=out:st=${fadeStart.toFixed(3)}:d=${fadeOut}[a]`,
    "-map", "0:v:0",
    "-map", "[a]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-movflags", "+faststart",
    "-shortest",
    out,
  ],
  { stdio: ["ignore", "ignore", "pipe"] }
);

let err = "";
ff.stderr.on("data", (d) => (err += d.toString()));
const code = await new Promise((r) => ff.on("close", r));
if (code !== 0) {
  console.error(err.slice(-2000));
  process.exit(1);
}
console.log(`✓ ${out}`);
