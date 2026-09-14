import webpush from "web-push";
import { ObjectId } from "mongodb";
import { getDb } from "./db";
import { tasksCollection } from "./tasks";
import { createHash } from "crypto";
import { cookies } from "next/headers";

export type PushPayload = {
  title: string;
  body?: string;
  tag?: string;
  url?: string;
};

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:kairo@localhost";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

/** The hosts browsers deliver web push through. Anything else is refused. */
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function isPushServiceEndpoint(endpoint: string): boolean {
  if (endpoint.length > 1000) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

const PUSH_DEVICE_COOKIE = "kairo_push";
const endpointHash = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 32);

/** Remembers which subscription belongs to this browser, so signing out here can stop its pushes. */
export async function rememberPushDevice(endpoint: string): Promise<void> {
  (await cookies()).set(PUSH_DEVICE_COOKIE, endpointHash(endpoint), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** An account signing out of this browser stops being notified on it. */
export async function forgetPushDevice(userId: ObjectId): Promise<void> {
  const hash = (await cookies()).get(PUSH_DEVICE_COOKIE)?.value;
  if (!hash) return;
  const subs = await subscriptionsCollection();
  const mine = await subs.find({ userId }, { projection: { endpoint: 1 } }).toArray();
  const here = mine.filter((s) => endpointHash(String(s.endpoint)) === hash).map((s) => s._id);
  if (here.length) await subs.deleteMany({ _id: { $in: here } });
}

export async function subscriptionsCollection() {
  const db = await getDb();
  return db.collection("push_subscriptions");
}

export async function scheduledCollection() {
  const db = await getDb();
  return db.collection("scheduled_pushes");
}

/** Sends a payload to every subscription of a user, pruning dead endpoints. */
export async function sendToUser(userId: ObjectId, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  const subs = await subscriptionsCollection();
  const list = await subs.find({ userId }).toArray();
  await Promise.all(
    list.map(async (doc) => {
      try {
        await webpush.sendNotification(
          { endpoint: doc.endpoint as string, keys: doc.keys as { p256dh: string; auth: string } },
          JSON.stringify(payload)
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await subs.deleteOne({ _id: doc._id }); // browser revoked this subscription
        } else {
          console.error(
            `Push send failed (${status ?? "?"}) for ${String(doc.endpoint).slice(0, 50)}:`,
            (err as { body?: string; message?: string }).body ?? (err as Error).message
          );
        }
      }
    })
  );
}

/** Delivers every due scheduled push exactly once (claim-by-delete). */
export async function processDuePushes(): Promise<void> {
  if (!ensureConfigured()) return;
  const scheduled = await scheduledCollection();
  // small grace window so slightly-early ticks don't miss by milliseconds
  const now = Date.now() + 2000;
  // claim one at a time so a concurrent tick can't double-send
  for (;;) {
    const doc = await scheduled.findOneAndDelete({ fireAt: { $lte: now } });
    if (!doc) break;

    // garden pushes decide for themselves whether they still matter, and plan the next one
    if (doc.kind === "habit" || doc.kind === "garden-evening") {
      try {
        const { fireGardenPush } = await import("./habit-reminders");
        await fireGardenPush(doc);
      } catch (err) {
        // one plant's trouble mustn't strand every push queued behind it
        console.error("[push] garden push failed", err);
      }
      continue;
    }

    // task-linked pushes (reminders): clear the marker, skip if already done/gone
    if (doc.taskId) {
      const tasks = await tasksCollection();
      const task = await tasks.findOne({ _id: doc.taskId as ObjectId, userId: doc.userId as ObjectId });
      if (task) {
        await tasks.updateOne({ _id: task._id }, { $set: { reminderAt: null } });
      }
      if (!task || task.status === "done") continue;
    }

    await sendToUser(doc.userId as ObjectId, {
      title: String(doc.title ?? "Kairo"),
      body: typeof doc.body === "string" ? doc.body : undefined,
      tag: typeof doc.tag === "string" ? doc.tag : undefined,
      url: typeof doc.url === "string" ? doc.url : undefined,
    });
  }
}

/* One ticker per server process. globalThis keeps it single across reloads,
   and keeps the watermark shared even if Next duplicates this module per
   route bundle. */
declare global {
  var _kairoPushTicker: ReturnType<typeof setInterval> | undefined;
  var _kairoPushWatch: { nextFireAt: number; lastScanAt: number } | undefined;
}

function watch(): { nextFireAt: number; lastScanAt: number } {
  global._kairoPushWatch ??= { nextFireAt: 0, lastScanAt: 0 };
  return global._kairoPushWatch;
}

/** How long a quiet instance may go between looks at the schedule. */
const QUIET_SCAN_MS = 60_000;
/** Inside this window before a known push, ticks check every time. */
const DUE_WINDOW_MS = 90_000;

/**
 * The ticker's beat. The old version opened with findOneAndDelete — a write —
 * every five seconds, due or not: ~17,000 operations a day per warm instance
 * spent discovering there was nothing to do, most of this database's free-tier
 * budget. Now a tick is free until either a known push is imminent or a
 * minute has passed since the schedule was last looked at; the look itself is
 * one projected read, and the claim loop only runs when it saw something due.
 *
 * On-the-second delivery never depended on this sweep — armPrecise sets an
 * exact timer when a push is scheduled. The sweep is the safety net for
 * pushes stranded by a died instance, and the price of the cheap tick is
 * that this rescue can now lag up to a minute. A timer that survives a
 * server crash and arrives sixty seconds late is the right trade against
 * burning the operation budget around the clock.
 */
async function tick(): Promise<void> {
  const w = watch();
  const now = Date.now();
  const dueSoon = w.nextFireAt > 0 && w.nextFireAt - now < DUE_WINDOW_MS;
  if (!dueSoon && now - w.lastScanAt < QUIET_SCAN_MS) return;

  w.lastScanAt = now;
  const scheduled = await scheduledCollection();
  const soonest = await scheduled
    .find({}, { projection: { fireAt: 1 }, sort: { fireAt: 1 }, limit: 1 })
    .toArray();
  if (soonest.length === 0) {
    w.nextFireAt = 0;
    return;
  }
  w.nextFireAt = Number(soonest[0].fireAt);
  if (w.nextFireAt <= now + 2000) {
    await processDuePushes();
    // the claim loop drained everything due; find out what's next
    const next = await scheduled
      .find({}, { projection: { fireAt: 1 }, sort: { fireAt: 1 }, limit: 1 })
      .toArray();
    w.nextFireAt = next.length > 0 ? Number(next[0].fireAt) : 0;
  }
}

export function ensureTicker(): void {
  if (global._kairoPushTicker) return;
  global._kairoPushTicker = setInterval(() => {
    tick().catch(() => {});
  }, 5_000);
  global._kairoPushTicker.unref?.();
  // catch up anything stranded the moment the process starts
  tick().catch(() => {});
}

/**
 * Precision timer: fires the sweep at the exact moment a push is due, so
 * delivery is on the second instead of waiting for the next sweep. The
 * interval sweep stays as the safety net (restarts, far-future pushes).
 */
export function armPrecise(fireAt: number): void {
  // the sweep's watermark learns about this push either way, so a lost
  // timeout degrades to at-most-a-minute-late instead of never
  const w = watch();
  if (w.nextFireAt === 0 || fireAt < w.nextFireAt) w.nextFireAt = fireAt;

  const delay = fireAt - Date.now();
  if (delay > 60 * 60 * 1000) return; // far future — the sweep will handle it
  const t = setTimeout(() => {
    processDuePushes().catch(() => {});
  }, Math.max(0, delay) + 200);
  t.unref?.();
}
