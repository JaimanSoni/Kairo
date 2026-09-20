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

export type SendResult = { devices: number; delivered: number; gone: number; failed: number };

/** How long the push service keeps trying a device that's offline. A reminder an hour late still helps; a day late is noise. */
const DEFAULT_TTL_S = 6 * 60 * 60;

/** A push service "topic": a newer push replaces an undelivered older one with the same topic. At most 32 URL-safe characters. */
const topicFor = (tag: string) => createHash("sha256").update(tag).digest("base64url").slice(0, 32);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends a payload to every device of a user, pruning dead endpoints.
 *
 * Urgency is "high" on purpose. At the default, Android's battery saver holds
 * a push until the phone next wakes on its own, which is how a 6:00 reminder
 * arrives at 6:10. High urgency is what the push services reserve for
 * time-sensitive, user-visible messages, which is exactly what a reminder is.
 *
 * A send that fails for a passing reason (the push service is busy, the
 * network hiccuped) is tried once more here; whatever still fails is counted,
 * so the caller can put the push back in the queue instead of losing it.
 */
export async function sendToUser(userId: ObjectId, payload: PushPayload, opts?: { ttlSeconds?: number }): Promise<SendResult> {
  const result: SendResult = { devices: 0, delivered: 0, gone: 0, failed: 0 };
  if (!ensureConfigured()) return result;
  const subs = await subscriptionsCollection();
  const list = await subs.find({ userId }).toArray();
  result.devices = list.length;
  const body = JSON.stringify(payload);
  const options = { TTL: opts?.ttlSeconds ?? DEFAULT_TTL_S, urgency: "high" as const, ...(payload.tag ? { topic: topicFor(payload.tag) } : {}) };
  await Promise.all(
    list.map(async (doc) => {
      const target = { endpoint: doc.endpoint as string, keys: doc.keys as { p256dh: string; auth: string } };
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await webpush.sendNotification(target, body, options);
          result.delivered++;
          subs.updateOne({ _id: doc._id }, { $set: { lastOkAt: new Date() }, $unset: { lastError: "" } }).catch(() => {});
          return;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await subs.deleteOne({ _id: doc._id }); // the browser revoked this subscription
            result.gone++;
            return;
          }
          // a bad request won't get better by asking again; a busy or unreachable service might
          const passing = status === undefined || status === 429 || status >= 500;
          if (passing && attempt === 0) {
            await sleep(900);
            continue;
          }
          result.failed++;
          const detail = String((err as { body?: string; message?: string }).body ?? (err as Error).message).slice(0, 200);
          console.error(`Push send failed (${status ?? "?"}) for ${String(doc.endpoint).slice(0, 50)}: ${detail}`);
          subs.updateOne({ _id: doc._id }, { $set: { lastError: `${status ?? "network"}: ${detail}`, lastErrorAt: new Date() } }).catch(() => {});
          return;
        }
      }
    })
  );
  return result;
}

/** Give up on a push after this many tries. */
const MAX_ATTEMPTS = 4;
/** Later than this, a push says nothing useful any more. */
const TOO_LATE_MS = 12 * 60 * 60 * 1000;

/**
 * Delivers every due scheduled push exactly once (claim-by-delete).
 *
 * Claiming by deleting is what keeps two servers from sending the same push,
 * but it used to mean a push that failed to send was simply gone. Now a push
 * that reaches no device for a passing reason goes back in the queue for a
 * minute later, a few times over, before it's given up on.
 */
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

    // found hours late (a long outage): a reminder for this morning is noise by tonight
    if (Date.now() - Number(doc.fireAt) > TOO_LATE_MS) continue;

    const sent = await sendToUser(doc.userId as ObjectId, {
      title: String(doc.title ?? "Kairo"),
      body: typeof doc.body === "string" ? doc.body : undefined,
      tag: typeof doc.tag === "string" ? doc.tag : undefined,
      url: typeof doc.url === "string" ? doc.url : undefined,
    });

    // reached nobody, and not because there's nobody to reach: try again shortly
    const attempts = Number(doc.attempts ?? 0) + 1;
    if (sent.delivered === 0 && sent.failed > 0 && attempts < MAX_ATTEMPTS) {
      const retryAt = Date.now() + attempts * 60_000;
      const { _id, ...rest } = doc;
      void _id;
      await scheduled.insertOne({ ...rest, fireAt: retryAt, firstFireAt: doc.firstFireAt ?? doc.fireAt, attempts });
      await wakeAt(retryAt);
    }
  }
}

/**
 * A cheap look for anything overdue, for requests that happen to be passing:
 * opening the app, loading habits. One small read, at most every 20 seconds
 * per server, and the claim loop only runs when that read finds something.
 * With the scheduler calling at the exact moment this rarely finds anything;
 * it's the net under the net.
 */
export async function catchUpPushes(): Promise<void> {
  const w = watch();
  const now = Date.now();
  if (now - w.lastCatchUpAt < 20_000) return;
  w.lastCatchUpAt = now;
  try {
    const scheduled = await scheduledCollection();
    const due = await scheduled.findOne({ fireAt: { $lte: now } }, { projection: { _id: 1 } });
    if (due) await processDuePushes();
  } catch (err) {
    console.error("[push] catch-up failed", err);
  }
}

/* One ticker per server process. globalThis keeps it single across reloads,
   and keeps the watermark shared even if Next duplicates this module per
   route bundle. */
declare global {
  var _kairoPushTicker: ReturnType<typeof setInterval> | undefined;
  var _kairoPushWatch: { nextFireAt: number; lastScanAt: number; lastCatchUpAt: number } | undefined;
}

function watch(): { nextFireAt: number; lastScanAt: number; lastCatchUpAt: number } {
  global._kairoPushWatch ??= { nextFireAt: 0, lastScanAt: 0, lastCatchUpAt: 0 };
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
 * Arranges for the queue to be looked at when `fireAt` comes.
 *
 * Two clocks, because neither is enough alone. The timer in this process is
 * exact, but on a serverless host the process is frozen or gone long before
 * most reminders are due: that is why pushes used to arrive late, or only
 * when someone next opened the app and woke a server. So the moment is also
 * handed to a scheduler outside (QStash), which calls /api/push/wake at that
 * second whether or not any server of ours is awake. Without its keys (local
 * development) only the timer runs, which is fine there: that process stays up.
 */
export async function wakeAt(fireAt: number): Promise<void> {
  armPrecise(fireAt);
  try {
    const { scheduleWake } = await import("./push-wake");
    await scheduleWake(fireAt);
  } catch (err) {
    console.error("[push] couldn't arrange the wake", err);
  }
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
