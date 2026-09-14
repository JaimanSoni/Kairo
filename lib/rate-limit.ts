import { MongoServerError } from "mongodb";
import { getDb } from "./db";

/**
 * Limits that hold across serverless instances, because they live in the
 * database. An in-memory counter resets whenever an instance does, which is
 * exactly when someone guessing is most patient.
 */

type Counter = { _id: string; count: number; until?: Date | null; expiresAt: Date };

let indexReady: Promise<unknown> | null = null;
async function collection(name: "rate_limits" | "pin_attempts") {
  const col = (await getDb()).collection<Counter>(name);
  indexReady ??= Promise.all(
    (["rate_limits", "pin_attempts"] as const).map(async (n) =>
      (await getDb()).collection(n).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: `${n}_ttl` })
    )
  ).catch((err: unknown) => {
    indexReady = null;
    throw err;
  });
  await indexReady;
  return col;
}

/**
 * A fixed-window counter: at most `max` hits per `windowMs` for `key`.
 * One atomic upsert per hit, so a burst of parallel requests can't slip through together.
 */
export async function hitLimit(key: string, max: number, windowMs: number): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const col = await collection("rate_limits");
  const doc = await col.findOneAndUpdate(
    { _id: `${key}:${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowMs * 2) } },
    { upsert: true, returnDocument: "after" }
  );
  if ((doc?.count ?? 1) <= max) return { ok: true };
  return { ok: false, retryAfter: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)) };
}

/**
 * Sharing reaches other people's inboxes and phones, so one account gets a
 * generous hourly and daily allowance of it: plenty for a team, nothing like
 * enough to turn Kairo's own address into someone's mailing list.
 */
export async function shareAllowance(userIdHex: string): Promise<{ ok: true } | { ok: false; error: string; retryAfter: number }> {
  const hour = await hitLimit(`share-h:${userIdHex}`, 40, 3600_000);
  if (!hour.ok) return { ok: false, error: "You've shared a lot in the last hour. Try again in a little while.", retryAfter: hour.retryAfter };
  const day = await hitLimit(`share-d:${userIdHex}`, 150, 86_400_000);
  if (!day.ok) return { ok: false, error: "That's today's sharing used up. It resets tomorrow.", retryAfter: day.retryAfter };
  return { ok: true };
}

/* ----------------------------------------------------------- PIN guesses */

/** Tries allowed before the first cool-down; after that each miss doubles it, up to fifteen minutes. */
const FREE_ATTEMPTS = 5;
const FIRST_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 15 * 60_000;

/**
 * Claims one PIN attempt before the PIN is checked.
 *
 * The claim and the cool-down are one atomic write: a hundred guesses fired at
 * once each have to win this update, and once the free attempts are gone the
 * cool-down is already on the record, so every other request in the burst is
 * turned away. Four digits is ten thousand guesses; this makes it weeks.
 */
export async function claimPinAttempt(key: string): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const col = await collection("pin_attempts");
  const now = new Date();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await col.findOneAndUpdate(
        { _id: key, $or: [{ until: null }, { until: { $lte: now } }] },
        [
          { $set: { count: { $add: [{ $ifNull: ["$count", 0] }, 1] }, expiresAt: new Date(now.getTime() + 24 * 3600_000) } },
          {
            $set: {
              until: {
                $cond: [
                  { $gte: ["$count", FREE_ATTEMPTS] },
                  {
                    $add: [
                      now,
                      { $min: [MAX_COOLDOWN_MS, { $multiply: [FIRST_COOLDOWN_MS, { $pow: [2, { $subtract: ["$count", FREE_ATTEMPTS] }] }] }] },
                    ],
                  },
                  null,
                ],
              },
            },
          },
        ],
        { upsert: true }
      );
      return { ok: true };
    } catch (err) {
      if (!(err instanceof MongoServerError) || err.code !== 11000) throw err;
      // a live cool-down (the filter didn't match, so the upsert collided), or
      // two first attempts racing to create the record: look, then decide
      const doc = await col.findOne({ _id: key });
      const wait = doc?.until ? doc.until.getTime() - Date.now() : 0;
      if (wait > 0) return { ok: false, retryAfter: Math.ceil(wait / 1000) };
    }
  }
  return { ok: false, retryAfter: 1 };
}

/** A right PIN wipes the slate. */
export async function clearPinAttempts(key: string): Promise<void> {
  await (await collection("pin_attempts")).deleteOne({ _id: key });
}

/** Seconds until another attempt is allowed. */
export async function pinRetryAfter(key: string): Promise<number> {
  const doc = await (await collection("pin_attempts")).findOne({ _id: key });
  const wait = doc?.until ? doc.until.getTime() - Date.now() : 0;
  return Math.max(0, Math.ceil(wait / 1000));
}

/** The pause after a wrong PIN, so even the free attempts can't be fired off in a tight loop. */
export const wrongPinPause = () => new Promise((r) => setTimeout(r, 400));
