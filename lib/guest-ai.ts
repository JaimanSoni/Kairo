import { getDb, withDbRetry } from "./db";

/**
 * The guest lane's bouncer for AI capture.
 *
 * Guests get 3 real Gemma parses before signing in, and the count lives HERE,
 * per IP per day in Mongo — never in the browser, where a cleared localStorage
 * would mint fresh runs forever. The client only displays what this reports.
 */
const FREE_RUNS = 3;

let indexReady: Promise<unknown> | null = null;

async function usageCol() {
  const db = await getDb();
  const col = db.collection("guest_ai_usage");
  indexReady ??= Promise.all([
    col.createIndex({ ip: 1, day: 1 }, { unique: true, name: "guest_ai_ip_day" }),
    col.createIndex({ at: 1 }, { expireAfterSeconds: 2 * 86400, name: "guest_ai_ttl" }),
  ]).catch((err: unknown) => {
    indexReady = null;
    throw err;
  });
  await indexReady;
  return col;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Claims one run. `left` is what remains after this claim. */
export async function allowGuestParse(ip: string): Promise<{ allowed: boolean; left: number }> {
  return withDbRetry(async () => {
    const col = await usageCol();
    const doc = await col.findOneAndUpdate(
      { ip, day: todayKey() },
      { $inc: { count: 1 }, $setOnInsert: { at: new Date() } },
      { upsert: true, returnDocument: "after" }
    );
    const count = Number(doc?.count ?? 1);
    return { allowed: count <= FREE_RUNS, left: Math.max(0, FREE_RUNS - count) };
  });
}

/** A run that produced nothing costs nothing — hand it back. */
export async function refundGuestParse(ip: string): Promise<void> {
  await withDbRetry(async () => {
    const col = await usageCol();
    await col.updateOne({ ip, day: todayKey(), count: { $gt: 0 } }, { $inc: { count: -1 } });
  });
}
