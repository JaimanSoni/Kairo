/**
 * Finds horizontal overflow — the bug that makes a page "not responsive".
 *
 *   npm start                                  # in another terminal, on :3010
 *   node scripts/responsive-audit.mjs          # default routes, phone widths
 *   node scripts/responsive-audit.mjs /support /log
 *
 * Exits non-zero if anything overflows, so it can gate a release.
 *
 * The usual culprit is a non-wrapping child (`truncate`, a long code span, a
 * fixed-width element) inside a grid or flex item. Those items default to
 * `min-width: auto`, so their min-content width becomes the track's minimum
 * and the track grows past the viewport instead of the child truncating.
 * The fix is almost always `min-w-0` on the item — not a media query.
 */
import puppeteer from "puppeteer-core";

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const ORIGIN = process.env.AUDIT_ORIGIN ?? "http://localhost:3010";
const WIDTHS = [320, 390, 430];
const routes = process.argv.slice(2);
const ROUTES = routes.length ? routes : ["/", "/support", "/support/getting-started"];

const fs = await import("node:fs");
const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error("No Chrome or Edge found — set one of:", CHROME_CANDIDATES.join(", "));
  process.exit(2);
}

const browser = await puppeteer.launch({ executablePath, headless: "new" });
let problems = 0;

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    try {
      await page.goto(ORIGIN + route, { waitUntil: "networkidle0", timeout: 30000 });
    } catch {
      console.log(`  ${route} @ ${width}  —  could not load`);
      await page.close();
      continue;
    }

    const r = await page.evaluate((vw) => {
      const offenders = [];
      for (const el of document.querySelectorAll("*")) {
        const box = el.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        if (box.right > vw + 1 || box.width > vw + 1) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className?.baseVal ?? el.className ?? "").toString().slice(0, 80),
            w: Math.round(box.width),
            text: (el.textContent ?? "").trim().slice(0, 40),
          });
        }
      }
      return {
        scrollWidth: document.documentElement.scrollWidth,
        // widest first: the outermost offender is the one worth fixing
        worst: offenders.sort((a, b) => b.w - a.w).slice(0, 3),
        count: offenders.length,
      };
    }, width);

    if (r.scrollWidth > width) {
      problems++;
      console.log(`FAIL ${route} @ ${width}px — scrollWidth ${r.scrollWidth}, ${r.count} elements overflow`);
      for (const o of r.worst) {
        console.log(`       <${o.tag}> w=${o.w}  "${o.text}"`);
        console.log(`         class="${o.cls}"`);
      }
    } else {
      console.log(`ok   ${route} @ ${width}px`);
    }
    await page.close();
  }
}

await browser.close();
console.log(problems ? `\n${problems} viewport(s) overflow.` : "\nNo horizontal overflow anywhere.");
process.exitCode = problems ? 1 : 0;
