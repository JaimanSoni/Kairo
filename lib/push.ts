import webpush from "web-push";
import { ObjectId } from "mongodb";
import { getDb } from "./db";
import { tasksCollection } from "./tasks";

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

/* One ticker per server process. globalThis keeps it single across reloads. */
declare global {
  var _kairoPushTicker: ReturnType<typeof setInterval> | undefined;
}

export function ensureTicker(): void {
  if (global._kairoPushTicker) return;
  global._kairoPushTicker = setInterval(() => {
    processDuePushes().catch(() => {});
  }, 5_000);
  global._kairoPushTicker.unref?.();
  // catch up anything stranded the moment the process starts
  processDuePushes().catch(() => {});
}

/**
 * Precision timer: fires the sweep at the exact moment a push is due, so
 * delivery is on the second instead of waiting for the next sweep. The
 * interval sweep stays as the safety net (restarts, far-future pushes).
 */
export function armPrecise(fireAt: number): void {
  const delay = fireAt - Date.now();
  if (delay > 60 * 60 * 1000) return; // far future — the sweep will handle it
  const t = setTimeout(() => {
    processDuePushes().catch(() => {});
  }, Math.max(0, delay) + 200);
  t.unref?.();
}
