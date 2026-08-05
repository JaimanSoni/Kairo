/**
 * Loads harvested leads into the leads collection.
 * 1. Marks the fabricated batch-1 rows invalid (name empty = the old
 *    persona rows; batch 2's real people all carry names).
 * 2. Inserts harvested leads, deduped against everything already there.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { MongoClient } = require("mongodb");

const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const vars = {};
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) vars[m[1]] = m[2].replace(/^"|"$/g, "");
}

const harvestPath = new URL(`./${process.argv[3] ?? "leads-harvest.json"}`, import.meta.url);
const harvested = JSON.parse(readFileSync(harvestPath, "utf8"));
const MIN_SCORE = Number(process.argv[2] ?? 62);

const client = new MongoClient(vars.MONGODB_URI);
await client.connect();
const col = client.db(vars.MONGODB_DB || "todo").collection("leads");

// 1. the fabricated personas: empty name, and not something we inserted now
const invalidated = await col.updateMany(
  { name: "", status: { $ne: "invalid" } },
  {
    $set: {
      status: "invalid",
      notes:
        "Fabricated persona: username does not exist on the platform (verified). Thread URL was real and has been re-harvested for actual participants.",
      updatedAt: new Date(),
    },
  }
);
console.log(`marked invalid: ${invalidated.modifiedCount}`);

// 2. insert harvested, deduped
const existing = await col.find({}).project({ username: 1, platform: 1, post_url: 1 }).toArray();
const seenUser = new Set(existing.map((l) => `${l.platform}:${l.username}`));
const seenPost = new Set(existing.map((l) => l.post_url));

// HN comments came from broad keyword search, so a pain-heavy comment can be
// about anything; require the words themselves to be about task apps. Reddit
// leads came from on-topic threads, so their context already guarantees it.
const ON_TOPIC = /(to-?do|task (app|manager|list|timer)|todoist|ticktick|sunsama|motion|things 3|reminders|planner|productivity app|checklist)/i;

let inserted = 0;
let skipped = 0;
for (const lead of harvested) {
  if (lead.estimated_fit_score < MIN_SCORE) { skipped++; continue; }
  if (lead.platform === "Hacker News" && !ON_TOPIC.test(lead.review_summary)) { skipped++; continue; }
  const key = `${lead.platform}:${lead.username}`;
  // Product Hunt reviewers share one reviews-page URL, so URL dedup would
  // keep only the first person per product; the username is the identity
  const postUnique = lead.platform !== "Product Hunt";
  if (seenUser.has(key) || (postUnique && seenPost.has(lead.post_url))) { skipped++; continue; }
  seenUser.add(key);
  if (postUnique) seenPost.add(lead.post_url);
  const { _score, ...doc } = lead;
  await col.insertOne({
    ...doc,
    contacted: false,
    status: "new",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  inserted++;
}
console.log(`inserted: ${inserted}, skipped (dupe or below score ${MIN_SCORE}): ${skipped}`);

const total = await col.countDocuments({ status: { $ne: "invalid" } });
const withEmail = await col.countDocuments({ status: { $ne: "invalid" }, contact_email: { $ne: "" } });
console.log(`GOOD LEADS NOW IN DB: ${total} (${withEmail} with a published email)`);
await client.close();
