import { ObjectId } from "mongodb";
import { getDb, withDbRetry } from "./db";

/**
 * The focus session, kept with the account rather than in one browser, so a
 * timer started at the desk is the same timer on the phone.
 *
 * One session per account at most. The server is the only clock that counts:
 * a device says how much time is left and whether it's running, and the
 * server stamps when that ends by its own clock. Every device then measures
 * against the server's time (each response carries `now`), so two devices
 * whose clocks disagree still show the same countdown.
 *
 * `rev` goes up with every change. A device holding an older rev than the
 * server's takes the server's; that is the whole of the sync.
 */

export type FocusSession = {
  taskId: string;
  /** The length this session was set to, with any minutes added or taken off. */
  totalMs: number;
  running: boolean;
  /** Server epoch ms the countdown reaches zero. Meaningful while running. */
  endAt: number;
  /** What was left when it was paused. Meaningful while paused. */
  remainingMs: number;
  rev: number;
  updatedAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** A session as a device sent it, or null if it isn't one. */
export function sanitizeFocus(body: unknown): { taskId: string; totalMs: number; running: boolean; remainingMs: number } | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.taskId !== "string" || !ObjectId.isValid(b.taskId)) return null;
  if (typeof b.totalMs !== "number" || !Number.isFinite(b.totalMs) || b.totalMs < 60_000 || b.totalMs > DAY_MS) return null;
  if (typeof b.remainingMs !== "number" || !Number.isFinite(b.remainingMs) || Math.abs(b.remainingMs) > DAY_MS) return null;
  if (typeof b.running !== "boolean") return null;
  return { taskId: b.taskId, totalMs: Math.round(b.totalMs), running: b.running, remainingMs: Math.round(b.remainingMs) };
}

function read(doc: Record<string, unknown> | null): FocusSession | null {
  const f = doc?.focus as Partial<FocusSession> | undefined;
  if (!f || typeof f.taskId !== "string" || typeof f.totalMs !== "number") return null;
  return { taskId: f.taskId, totalMs: f.totalMs, running: Boolean(f.running), endAt: Number(f.endAt ?? 0), remainingMs: Number(f.remainingMs ?? 0), rev: Number(f.rev ?? 1), updatedAt: Number(f.updatedAt ?? 0) };
}

export async function getFocus(userId: string): Promise<FocusSession | null> {
  return withDbRetry(async () => {
    const db = await getDb();
    const doc = await db.collection("users").findOne({ _id: new ObjectId(userId) }, { projection: { focus: 1 } });
    const session = read(doc);
    // a session nobody ended, a day past its time, is not a session any more
    if (session && Date.now() - session.updatedAt > 2 * DAY_MS) return null;
    return session;
  });
}

export async function setFocus(userId: string, input: { taskId: string; totalMs: number; running: boolean; remainingMs: number }): Promise<FocusSession> {
  return withDbRetry(async () => {
    const db = await getDb();
    const now = Date.now();
    const _id = new ObjectId(userId);
    const prev = read(await db.collection("users").findOne({ _id }, { projection: { focus: 1 } }));
    const session: FocusSession = {
      taskId: input.taskId,
      totalMs: input.totalMs,
      running: input.running,
      endAt: input.running ? now + input.remainingMs : 0,
      remainingMs: input.remainingMs,
      rev: (prev?.rev ?? 0) + 1,
      updatedAt: now,
    };
    await db.collection("users").updateOne({ _id }, { $set: { focus: session } });
    return session;
  });
}

export async function clearFocus(userId: string): Promise<void> {
  await withDbRetry(async () => {
    const db = await getDb();
    await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $unset: { focus: "" } });
  });
}
