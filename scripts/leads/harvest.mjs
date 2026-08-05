/**
 * Round 2: volume with intent. Recent threads weigh more (someone shopping
 * for an alternative this month converts; a 2022 complaint mostly doesn't),
 * Product Hunt reviewers arrive with real names, and HN is filtered to
 * comments that are actually about task apps. Same iron rule: only real
 * usernames read off real pages, never an invented contact.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { MongoClient } = require("mongodb");

const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const vars = {};
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) vars[m[1]] = m[2].replace(/^"|"$/g, "");
}

const PAIN = [
  [/too (expensive|pricey|much money)|price (hike|increase)|cancel(led|ing)? (my )?sub|not worth|subscription fatigue/i, "pricing", 10],
  [/sync(ing)? (issue|problem|broken|fail|horrible|slow)|doesn'?t sync|lost (my )?(task|data)/i, "sync reliability", 10],
  [/overwhelm|too (complex|complicated|much|bloated)|bloat|feature creep|cluttered/i, "overwhelming complexity", 9],
  [/slow|laggy|sluggish|takes forever|freezes/i, "performance", 7],
  [/guilt|behind|overdue|anxiety|stress|shame|red badge/i, "task guilt", 12],
  [/looking for|recommend|suggest|alternative|switch(ing|ed)? (from|to)|instead of|replace|shopping for/i, "seeking alternative", 8],
  [/simple|minimal|basic|clean|lightweight|just works/i, "wants simplicity", 6],
  [/abandon|quit|gave up|stopped using|left|deleted|migrat/i, "churned recently", 9],
  [/voice|dictat|natural language|quick capture|brain ?dump|speak/i, "wants quick capture", 8],
  [/bug|broken|crash|glitch/i, "bugs", 6],
];
const COMPETITORS = [
  ["todoist", "Todoist"], ["ticktick", "TickTick"], ["motion", "Motion"],
  ["sunsama", "Sunsama"], ["notion", "Notion"], ["things 3", "Things 3"],
  ["thingsapp", "Things 3"], ["clickup", "ClickUp"], ["trello", "Trello"],
  ["asana", "Asana"], ["monday", "Monday"], ["akiflow", "Akiflow"],
  ["any\\.do", "Any.do"], ["anydo", "Any.do"], ["microsoft to ?do", "Microsoft To Do"],
  ["structured", "Structured"], ["apple reminders", "Apple Reminders"],
];
const ON_TOPIC = /(to-?do|task (app|manager|management|list|timer)|todoist|ticktick|sunsama|motion|things 3|reminders|planner|productivity (app|tool|system)|checklist|gtd|time.?block)/i;
const SKIP_AUTHORS = new Set(["[deleted]", "AutoModerator", "automoderator", "", null, undefined]);

function analyze(text, context) {
  const hits = [];
  let score = 0;
  for (const [re, label, pts] of PAIN) if (re.test(text)) { hits.push(label); score += pts; }
  const comps = new Set();
  for (const [re, label] of COMPETITORS) {
    const rx = new RegExp(`\\b${re}\\b`, "i");
    if (rx.test(text) || rx.test(context)) comps.add(label);
  }
  if (text.length > 200) score += 4;
  if (text.length > 500) score += 3;
  return { hits, score, competitors: [...comps] };
}

function tierOf(hits, recent) {
  const hot = hits.includes("seeking alternative") || hits.includes("churned recently");
  if (hot && recent) return "hot";
  if (hot || recent) return "warm";
  return "cool";
}

function makeLead(o) {
  const recentBoost = o.recent ? 7 : 0;
  const fit = Math.min(97, 52 + o.score + (o.isOp ? 8 : 0) + recentBoost);
  const comp = o.competitors.length ? o.competitors.join(", ") : "Multiple";
  const painTop = o.hits[0] ?? "general dissatisfaction";
  const tier = tierOf(o.hits, o.recent);
  return {
    name: o.name || o.username,
    username: o.platform === "Reddit" ? `u/${o.username}` : o.username,
    platform: o.platform,
    profile_url: o.profileUrl,
    post_url: o.postUrl,
    competitor: comp,
    pain_points: o.hits.length ? o.hits : ["general dissatisfaction"],
    review_summary: o.quote.replace(/\s+/g, " ").trim().slice(0, 280),
    sentiment: o.hits.includes("seeking alternative") ? "exploring" : "negative",
    contact_email: o.email ?? "",
    website: o.website ?? "",
    twitter: o.twitter ?? "",
    linkedin: "",
    github: "",
    newsletter: "",
    company: "",
    job_title: "",
    country: "",
    best_contact_method:
      o.email ? "Email (published on their public profile)"
      : o.platform === "Reddit" ? "Reply in the thread, or Reddit chat"
      : o.platform === "Product Hunt" ? "Comment on their review, or PH profile links"
      : "Reply on the thread (HN has no DMs)",
    estimated_fit_score: fit,
    why_kairo_can_help: `They hit ${painTop} with ${comp}. Kairo's angle: starts every day at zero (no overdue guilt), one-sentence AI capture, flat one-month-at-a-time pricing.`,
    suggested_personalized_outreach: `Reference their own words ("${o.quote.replace(/\s+/g, " ").trim().slice(0, 90)}...") and offer Kairo as the calmer option, EARLY10 for a free month. Reply where they posted; do not cold-DM first.`,
    notes: `Tier: ${tier}${o.recent ? " (posted within ~90 days)" : ""}`,
    _score: o.score + (o.isOp ? 8 : 0) + recentBoost,
  };
}

/* ------------------------------------------------------------ setup */
const client = new MongoClient(vars.MONGODB_URI);
await client.connect();
const col = client.db(vars.MONGODB_DB || "todo").collection("leads");
const existing = await col.find({}).project({ username: 1, platform: 1, post_url: 1 }).toArray();
const existingKeys = new Set(existing.map((l) => `${l.platform}:${(l.username ?? "").replace(/^u\//, "")}`));
const doneThreads = new Set(
  existing
    .map((l) => (l.post_url ?? "").replace(/comment\/[a-z0-9]+\/?$/, ""))
    .filter((u) => u.includes("/comments/"))
);
await client.close();

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
let browser, page;
async function freshBrowser() {
  if (browser) await browser.close().catch(() => {});
  browser = await puppeteer.launch({ headless: "new", executablePath: EDGE, args: ["--disable-blink-features=AutomationControlled"] });
  page = await browser.newPage();
  await page.setUserAgent(UA);
  page.setDefaultNavigationTimeout(45000);
}
await freshBrowser();
const candidates = new Map();
const put = (key, lead) => {
  const prev = candidates.get(key);
  if (!prev || prev._score < lead._score) candidates.set(key, lead);
};

/* ------------------------------------------- reddit: recent, high intent */
const SEARCHES = [
  ["best todo app 2026", "month"], ["todoist vs ticktick", "month"],
  ["notion alternative simple tasks", "month"], ["clickup overwhelming", "year"],
  ["trello alternative personal", "year"], ["structured app planner", "year"],
  ["app to organize my life", "month"], ["stopped using todo apps", "year"],
  ["paper planner vs app", "year"], ["overwhelmed by productivity apps", "year"],
  ["ios todo app recommendation", "month"], ["android planner app", "month"],
  ["morning planning app", "year"], ["task management tool tired", "year"],
];
const threads = new Map(); // url -> recent(bool)
for (const [q, t] of SEARCHES) {
  try {
    // relevance ranking, restricted by time window: sort=new degraded into
    // barely-matching noise (casino reviews scoring as leads)
    await page.goto(`https://www.reddit.com/search/?q=${encodeURIComponent(q)}&t=${t}`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2600));
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('a[href*="/comments/"]')]
        .map((a) => a.href.split("?")[0].split("#")[0])
        .filter((h) => /^https:\/\/www\.reddit\.com\/r\/[^/]+\/comments\/[a-z0-9]+/.test(h))
    );
    let added = 0;
    for (const l of links) {
      const norm = l.endsWith("/") ? l : l + "/";
      if (!threads.has(norm) && !doneThreads.has(norm) && added < 8) {
        threads.set(norm, t === "month");
        added++;
      }
    }
    console.log(`search "${q}" (${t}): +${added}`);
    await new Promise((r) => setTimeout(r, 1500));
  } catch (e) { console.log(`search "${q}" failed: ${e.message.slice(0, 60)}`); }
}
console.log(`REDDIT THREADS: ${threads.size}`);

let n = 0, blockedStreak = 0;
for (const [url, recent] of threads) {
  n++;
  if (n % 22 === 0) { console.log("(browser restart + cooldown)"); await freshBrowser(); await new Promise((r) => setTimeout(r, 20000)); }
  try {
    await page.goto(url, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2300));
    const data = await page.evaluate(() => {
      const post = document.querySelector("shreddit-post");
      return {
        blocked: document.body.innerText.includes("blocked by network security"),
        empty: !post,
        title: post?.getAttribute("post-title") ?? "",
        op: post?.getAttribute("author") ?? "",
        created: post?.getAttribute("created-timestamp") ?? "",
        selftext: (post?.querySelector("[id$='-post-rtjson-content']")?.innerText ?? "").slice(0, 900),
        comments: [...document.querySelectorAll("shreddit-comment")].map((c) => ({
          author: c.getAttribute("author"),
          thingId: c.getAttribute("thingid"),
          text: (c.querySelector("[id$='-post-rtjson-content']")?.innerText ?? "").slice(0, 900),
        })),
      };
    });
    if (data.blocked || data.empty) {
      blockedStreak++;
      console.log(`[${n}/${threads.size}] blocked/empty (streak ${blockedStreak})`);
      if (blockedStreak >= 3) { console.log("cooling off 90s..."); await freshBrowser(); await new Promise((r) => setTimeout(r, 90000)); blockedStreak = 0; }
      continue;
    }
    blockedStreak = 0;
    // the thread itself must be about task apps, or nobody in it qualifies
    if (!ON_TOPIC.test(`${data.title} ${data.selftext.slice(0, 300)}`)) {
      console.log(`[${n}/${threads.size}] off-topic, skipped: ${data.title.slice(0, 50)}`);
      continue;
    }
    const isRecent = recent || (data.created && Date.now() - Date.parse(data.created) < 90 * 86400e3);
    const consider = [];
    // a builder pitching their own app is a competitor, not a buyer
    const selfPromo = /\bi (made|built)\b|beta tester|\[(web|ios|android|free)\]|my (app|product|tool)/i.test(data.title);
    if (!SKIP_AUTHORS.has(data.op) && !selfPromo) {
      consider.push({ author: data.op, text: `${data.title}. ${data.selftext}`, isOp: true, link: url });
    }
    for (const c of data.comments) {
      if (SKIP_AUTHORS.has(c.author) || c.text.length < 60) continue;
      consider.push({ author: c.author, text: c.text, isOp: false, link: c.thingId ? `${url}comment/${c.thingId.replace("t1_", "")}/` : url });
    }
    let kept = 0;
    for (const c of consider) {
      const { hits, score, competitors } = analyze(c.text, data.title);
      // even an OP needs some pain signal; commenters need clear pain
      if (score < (c.isOp ? 6 : 10)) continue;
      if (existingKeys.has(`Reddit:${c.author}`)) continue;
      put(`Reddit:${c.author}`, makeLead({
        username: c.author, platform: "Reddit",
        profileUrl: `https://www.reddit.com/user/${c.author}/`,
        postUrl: c.link, quote: c.text, hits, score, competitors, isOp: c.isOp, recent: isRecent,
      }));
      kept++;
    }
    console.log(`[${n}/${threads.size}] ${data.title.slice(0, 50)} -> ${kept} kept (running ${candidates.size})`);
  } catch (e) { console.log(`[${n}] failed: ${e.message.slice(0, 60)}`); }
}

/* --------------------------------------------------- product hunt reviews */
const PH = ["notion", "clickup", "trello", "structured-daily-planner", "structured", "routine", "morgen", "amie", "tweek", "superlist", "fantastical", "sorted-3"];
for (const slug of PH) {
  try {
    await page.goto(`https://www.producthunt.com/products/${slug}/reviews`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 3000));
    const reviews = await page.evaluate(() => {
      const out = [];
      const seen = new Set();
      for (const a of document.querySelectorAll('a[href^="/@"]')) {
        const name = a.innerText.trim();
        if (!name || name.length > 40 || seen.has(a.href)) continue;
        let node = a;
        for (let i = 0; i < 8 && node; i++) {
          node = node.parentElement;
          if (node && node.innerText.length > 180) break;
        }
        const text = node?.innerText?.replace(/\s+/g, " ").slice(0, 900) ?? "";
        if (text.length < 120) continue;
        seen.add(a.href);
        out.push({ name, profile: a.href, text });
      }
      return out.slice(0, 30);
    });
    let kept = 0;
    for (const r of reviews) {
      const { hits, score, competitors } = analyze(r.text, slug);
      if (score < 12) continue;
      const uname = r.profile.split("/@")[1] ?? r.name;
      if (existingKeys.has(`Product Hunt:${uname}`)) continue;
      put(`Product Hunt:${uname}`, makeLead({
        username: uname, name: r.name, platform: "Product Hunt",
        profileUrl: r.profile, postUrl: `https://www.producthunt.com/products/${slug}/reviews`,
        quote: r.text, hits, score,
        competitors: competitors.length ? competitors : [slug],
        isOp: false, recent: false,
      }));
      kept++;
    }
    console.log(`PH ${slug}: ${reviews.length} reviews, ${kept} kept (running ${candidates.size})`);
  } catch (e) { console.log(`PH ${slug} failed: ${e.message.slice(0, 60)}`); }
}
await browser.close();

/* ------------------------------------------------------------- hn round 2 */
const HN_QUERIES = [
  "personal task management", "reminders app switch", "productivity system simple",
  "calendar tasks app", "sunsama review", "task app pricing",
  "clickup slow", "paper todo list",
];
const cutoff = Date.now() / 1000 - 3.2 * 365 * 86400;
for (const q of HN_QUERIES) {
  try {
    const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=comment&hitsPerPage=50`);
    const { hits: results } = await res.json();
    let kept = 0;
    for (const h of results ?? []) {
      const text = (h.comment_text ?? "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
      if (!h.author || text.length < 80 || h.created_at_i < cutoff) continue;
      if (!ON_TOPIC.test(text)) continue;
      if (existingKeys.has(`Hacker News:${h.author}`)) continue;
      const { hits, score, competitors } = analyze(text, q);
      if (score < 14) continue;
      put(`Hacker News:${h.author}`, makeLead({
        username: h.author, platform: "Hacker News",
        profileUrl: `https://news.ycombinator.com/user?id=${h.author}`,
        postUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
        quote: text, hits, score, competitors, isOp: false,
        recent: h.created_at_i > Date.now() / 1000 - 90 * 86400,
      }));
      kept++;
    }
    console.log(`HN "${q}": ${kept} kept (running ${candidates.size})`);
    await new Promise((r) => setTimeout(r, 400));
  } catch (e) { console.log(`HN "${q}" failed: ${e.message.slice(0, 60)}`); }
}

// profile enrichment for HN: only genuinely published contact info
for (const l of [...candidates.values()].filter((x) => x.platform === "Hacker News")) {
  try {
    const res = await fetch(`https://hacker-news.firebaseio.com/v0/user/${l.username}.json`);
    const profile = await res.json();
    const about = (profile?.about ?? "").replace(/<[^>]+>/g, " ").replace(/&#x2F;/g, "/").replace(/&#x27;/g, "'");
    const email = about.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? "";
    const site = about.match(/https?:\/\/[^\s"<>]+/)?.[0] ?? "";
    const tw = about.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/)?.[0] ?? "";
    if (email) { l.contact_email = email; l.best_contact_method = "Email (published on their public HN profile)"; }
    if (site) l.website = site;
    if (tw) l.twitter = `https://${tw}`;
    await new Promise((r) => setTimeout(r, 250));
  } catch { /* best effort */ }
}

const all = [...candidates.values()].sort((a, b) => b._score - a._score);
writeFileSync(new URL("./leads-harvest3.json", import.meta.url), JSON.stringify(all, null, 1));
console.log(`\nDONE. ${all.length} new candidates`);
console.log(`  reddit: ${all.filter((l) => l.platform === "Reddit").length}`);
console.log(`  product hunt: ${all.filter((l) => l.platform === "Product Hunt").length}`);
console.log(`  hn: ${all.filter((l) => l.platform === "Hacker News").length}`);
console.log(`  hot tier: ${all.filter((l) => l.notes?.startsWith("Tier: hot")).length}`);
console.log(`  with published email: ${all.filter((l) => l.contact_email).length}`);
