/**
 * Seeds batch 2 GTM leads into MongoDB.
 * Usage: node scripts/seed-leads-batch2.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const leadsPath = resolve(__dirname, "..", "lib", "data", "leads-batch2.json");

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
    // ok
  }
}

async function main() {
  loadEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  const dbName = process.env.MONGODB_DB || "todo";

  const leads = JSON.parse(readFileSync(leadsPath, "utf-8"));
  console.log(`Loaded ${leads.length} leads from batch 2`);

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection("leads");

  let inserted = 0, skipped = 0;
  for (const lead of leads) {
    const exists = await col.findOne({
      $or: [
        { username: lead.username, platform: lead.platform },
        { post_url: lead.post_url },
      ],
    });
    if (exists) { skipped++; continue; }
    await col.insertOne({
      ...lead,
      status: "new",
      contacted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    inserted++;
  }

  console.log(`Inserted: ${inserted}, Skipped: ${skipped}`);
  console.log(`Total leads: ${await col.countDocuments()}`);
  await client.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
