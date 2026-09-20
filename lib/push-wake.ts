import { createHash, createHmac, timingSafeEqual } from "crypto";
import { scheduledCollection } from "./push";
import { SITE_URL } from "./site";

/**
 * The clock outside.
 *
 * Kairo runs on serverless functions: a server of ours exists while it is
 * answering someone, and is frozen or gone soon after. A timer set inside one
 * to fire a reminder three hours from now never fires. So each reminder's
 * moment is handed to QStash, a scheduler that holds a message until a given
 * second and then calls a URL of ours: /api/push/wake. That call is what wakes
 * a server at the right time, and the server then sends whatever is due.
 *
 *   - One message per moment (not per push): two reminders at 6:00:00 share
 *     a wake, through the deduplication id.
 *   - QStash holds a message for days, not months, so a far-off reminder gets
 *     a relay: a wake inside the limit, which arranges the real one when it
 *     fires. A push is marked `wakeArmed` once its own moment is booked.
 *   - The call is signed. /api/push/wake does nothing for anyone who can't
 *     prove they're QStash.
 *
 * Without the keys (local development) this does nothing and the in-process
 * timer carries on alone; there the process stays up, so it's enough.
 */

const QSTASH_URL = (process.env.QSTASH_URL || "https://qstash.upstash.io").replace(/\/+$/, "");
/** How far ahead a message may be held, kept under the free plan's seven days. */
const MAX_HOLD_MS = 6 * 24 * 60 * 60 * 1000;

const wakeUrl = () => `${SITE_URL}/api/push/wake`;

/** The scheduler can only call an address the internet can reach. */
export function wakeConfigured(): boolean {
  return Boolean(process.env.QSTASH_TOKEN) && /^https:\/\//.test(SITE_URL) && !/localhost|127\.0\.0\.1/.test(SITE_URL);
}

async function publish(notBeforeMs: number, dedupeId: string): Promise<boolean> {
  const res = await fetch(`${QSTASH_URL}/v2/publish/${wakeUrl()}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
      "Content-Type": "application/json",
      "Upstash-Not-Before": String(Math.floor(notBeforeMs / 1000)),
      "Upstash-Deduplication-Id": dedupeId,
      "Upstash-Retries": "3",
    },
    body: JSON.stringify({ at: notBeforeMs }),
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) {
    console.error(`[push] QStash refused the wake (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return false;
  }
  return true;
}

/** Books a call to /api/push/wake for `fireAt`, and marks the pushes of that moment as booked. */
export async function scheduleWake(fireAt: number): Promise<void> {
  if (!wakeConfigured()) return;
  const now = Date.now();
  const direct = fireAt - now <= MAX_HOLD_MS;
  // second precision is what the scheduler offers; a wake a moment early finds nothing, so aim just after
  const at = direct ? Math.max(now, fireAt) + 1000 : now + MAX_HOLD_MS;
  const ok = await publish(at, direct ? `wake-${Math.floor(fireAt / 1000)}` : `relay-${Math.floor(at / 3_600_000)}`);
  if (ok && direct) {
    const scheduled = await scheduledCollection();
    await scheduled.updateMany({ fireAt, wakeArmed: { $ne: true } }, { $set: { wakeArmed: true } });
  }
}

/**
 * Books the moments that aren't booked yet: far-off pushes that have come
 * within reach, and any whose booking failed when they were made. Run by
 * every wake and by the daily sweep.
 */
export async function armPendingWakes(): Promise<number> {
  if (!wakeConfigured()) return 0;
  const scheduled = await scheduledCollection();
  const now = Date.now();
  const pending = await scheduled
    .find({ wakeArmed: { $ne: true }, fireAt: { $gt: now } }, { projection: { fireAt: 1 }, sort: { fireAt: 1 }, limit: 100 })
    .toArray();
  const moments = [...new Set(pending.map((p) => Number(p.fireAt)))];
  let far = false;
  for (const fireAt of moments) {
    if (fireAt - now > MAX_HOLD_MS) {
      far = true;
      continue;
    }
    await scheduleWake(fireAt);
  }
  // something still lies beyond the horizon: one relay keeps the chain alive
  if (far) await scheduleWake(now + MAX_HOLD_MS + 60_000);
  return moments.length;
}

/* ------------------------------------------------------------- signature */

const b64url = (buf: Buffer) => buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

function verifyWith(key: string, token: string, rawBody: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, payload, signature] = parts;
  const expected = b64url(createHmac("sha256", key).update(`${header}.${payload}`).digest());
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  let claims: { iss?: string; sub?: string; exp?: number; nbf?: number; body?: string };
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== "Upstash") return false;
  if (typeof claims.exp !== "number" || claims.exp < now - 5) return false;
  if (typeof claims.nbf === "number" && claims.nbf > now + 5) return false;
  if (claims.sub !== wakeUrl()) return false;
  // the signature covers the body too: a replayed header can't carry a different one
  const bodyHash = b64url(createHash("sha256").update(rawBody).digest());
  return (claims.body ?? "").replace(/=+$/, "") === bodyHash;
}

/** True only for a call QStash signed, with either of its two rotating keys. */
export function verifyWakeSignature(token: string | null, rawBody: string): boolean {
  if (!token) return false;
  const keys = [process.env.QSTASH_CURRENT_SIGNING_KEY, process.env.QSTASH_NEXT_SIGNING_KEY].filter((k): k is string => Boolean(k));
  return keys.some((k) => verifyWith(k, token, rawBody));
}
