/**
 * Photographs a film page at chosen moments — the review loop for retiming a
 * cut without paying for a full render.
 *
 *   node scripts/stills-launch.mjs --url http://localhost:3010/video-launch \
 *        --dir out/stills --aspect 16:9 --times 2600,13200,23400
 */
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const URL = arg("url", "http://localhost:3010/video-launch");
const OUT = arg("dir", "out/stills");
const aspect = arg("aspect", "16:9");
const times = arg("times", "2600,6000,10600,13200,17800,23400,29000,34600,40000,43000,48800,54000")
  .split(",")
  .map(Number);

const size = aspect === "9:16" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ ...size, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
page.on("pageerror", (e) => console.error("page error:", String(e).split("\n")[0]));
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => window.__ready === true, { timeout: 30000 });
await page.evaluate(() => document.fonts.ready);

for (const t of times) {
  await page.evaluate(async (ms) => {
    await window.__seek(ms);
  }, t);
  const name = `${OUT}/${aspect.replace(":", "x")}-${String(t).padStart(5, "0")}.png`;
  await page.screenshot({ path: name });
  console.log(name);
}
await browser.close();
