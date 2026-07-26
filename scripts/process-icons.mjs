/**
 * Icon pipeline for the 3D pack.
 *
 *   node scripts/process-icons.mjs           # reprocess every icon
 *   node scripts/process-icons.mjs coffee    # just this one (or several)
 *
 * Generated icons arrive at 1024px with wildly different amounts of empty
 * margin — one subject fills 55% of its frame, another 95%. Rendered at the
 * same `size` they'd look nothing alike, and a `size={18}` icon would show an
 * ~11px subject. So we trim each to its actual content and re-pad to a uniform
 * FILL ratio: after this, `size` means what it says and every icon carries the
 * same optical weight.
 *
 * The 1024px master is archived to assets-src/ (gitignored) and public/ gets
 * the 256px version — a full-size master per icon would be ~1.4 MB in git
 * history forever.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const PUBLIC = "public/img";
const MASTERS = "assets-src/img-original";
const CANVAS = 256;
const FILL = 0.92;
/** Alpha above this counts as content — ignores near-invisible shadow fringes. */
const ALPHA_FLOOR = 8;

/** Tight bounding box of everything that isn't effectively transparent. */
async function contentBox(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * c + 3] > ALPHA_FLOOR) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("image is entirely transparent");
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

async function processIcon(name) {
  const shipped = path.join(PUBLIC, `${name}.png`);
  const master = path.join(MASTERS, `${name}.png`);

  // A freshly-dropped 1024px file lands in public/ first; archive it once.
  if (!fs.existsSync(master)) {
    if (!fs.existsSync(shipped)) throw new Error(`no ${shipped} and no master`);
    fs.mkdirSync(MASTERS, { recursive: true });
    fs.copyFileSync(shipped, master);
  }

  const meta = await sharp(master).metadata();
  if (!meta.hasAlpha) throw new Error("no alpha channel — needs a transparent background");

  const box = await contentBox(master);
  const inner = await sharp(master)
    .extract(box)
    .resize(Math.round(CANVAS * FILL), Math.round(CANVAS * FILL), { fit: "inside" })
    .toBuffer();

  const { width, height } = await sharp(inner).metadata();
  const left = Math.floor((CANVAS - width) / 2);
  const top = Math.floor((CANVAS - height) / 2);
  const out = await sharp(inner)
    .extend({
      left,
      top,
      right: CANVAS - width - left,
      bottom: CANVAS - height - top,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  fs.writeFileSync(shipped, out);
  return { name, source: `${meta.width}x${meta.height}`, kb: Math.round(out.length / 1024) };
}

const requested = process.argv.slice(2).map((n) => n.replace(/\.png$/, ""));
const names = requested.length
  ? requested
  : fs.readdirSync(PUBLIC).filter((f) => f.endsWith(".png")).map((f) => f.replace(/\.png$/, ""));

let failed = 0;
for (const name of names) {
  try {
    const r = await processIcon(name);
    console.log(`  ${r.name.padEnd(14)} ${r.source.padEnd(10)} -> ${CANVAS}px, ${r.kb}KB`);
  } catch (err) {
    failed++;
    console.error(`  ${name.padEnd(14)} FAILED: ${err.message}`);
  }
}
console.log(`\n${names.length - failed}/${names.length} processed at ${FILL * 100}% fill.`);
if (failed) process.exitCode = 1;
