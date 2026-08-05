/**
 * Seeds the GTM leads database from lib/data/leads.json into MongoDB.
 *
 * Usage:
 *   node scripts/seed-leads.mjs
 *
 * Requires MONGODB_URI in .env.local or environment.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const leadsPath = resolve(__dirname, "..", "lib", "data", "leads.json");

// Load env vars from .env.local (simple parser, no dotenv dependency)
function loadEnv() {
  try {
    const envPath = resolve(__dirname, "..", ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local not found, use existing env vars
  }
}

async function main() {
  loadEnv();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }

  const dbName = process.env.MONGODB_DB || "todo";

  const leads = JSON.parse(readFileSync(leadsPath, "utf-8"));
  console.log(`Loaded ${leads.length} leads from JSON`);

  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(dbName);
  const col = db.collection("leads");

  let inserted = 0;
  let skipped = 0;

  for (const lead of leads) {
    const exists = await col.findOne({
      $or: [
        { username: lead.username, platform: lead.platform },
        { post_url: lead.post_url },
      ],
    });

    if (exists) {
      skipped++;
      continue;
    }

    await col.insertOne({
      ...lead,
      status: "new",
      contacted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    inserted++;
  }

  console.log(`Done: ${inserted} inserted, ${skipped} skipped (duplicates)`);

  // Print stats
  const total = await col.countDocuments();
  const highScore = await col.countDocuments({ estimated_fit_score: { $gte: 80 } });
  console.log(`\nTotal leads: ${total}`);
  console.log(`High-fit (80+): ${highScore}`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
