import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { scheduledCollection, ensureTicker, processDuePushes, wakeAt } from "@/lib/push";

const MAX_AHEAD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Schedules a push for a future moment (e.g. a focus timer's end).
 * Same-tag scheduling replaces the previous one — pause/extend just reschedules.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { fireAt?: unknown; title?: unknown; body?: unknown; tag?: unknown; url?: unknown; taskId?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (typeof body.fireAt !== "number" || !Number.isFinite(body.fireAt)) {
    return badRequest("fireAt (epoch ms) required");
  }
  const now = Date.now();
  if (body.fireAt < now - 60_000 || body.fireAt > now + MAX_AHEAD_MS) {
    return badRequest("fireAt out of range");
  }
  if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 200) {
    return badRequest("title required");
  }
  const tag = typeof body.tag === "string" && body.tag.length <= 100 ? body.tag : null;

  const taskId =
    typeof body.taskId === "string" && ObjectId.isValid(body.taskId)
      ? new ObjectId(body.taskId)
      : null;

  const scheduled = await scheduledCollection();
  const userId = new ObjectId(session.userId);
  if (tag) await scheduled.deleteMany({ userId, tag });
  // a timer and a handful of reminders is normal; hundreds is a loop, or abuse
  if ((await scheduled.countDocuments({ userId })) >= 300) {
    return NextResponse.json({ error: "Too many pending notifications." }, { status: 429 });
  }
  await scheduled.insertOne({
    userId,
    fireAt: body.fireAt,
    title: body.title.trim(),
    body: typeof body.body === "string" ? body.body.slice(0, 500) : null,
    tag,
    taskId,
    // a path on this site, never "//elsewhere": the notification opens it
    url: typeof body.url === "string" && /^\/(?![/\\])/.test(body.url) && body.url.length <= 300 ? body.url : "/today",
    createdAt: new Date(),
  });

  ensureTicker();
  await wakeAt(body.fireAt); // an outside clock calls at this exact moment, even if every server of ours is asleep by then
  processDuePushes().catch(() => {}); // catch up anything overdue right away
  return NextResponse.json({ ok: true });
}

/** Cancels pending scheduled pushes by tag (e.g. when a timer is paused). */
export async function DELETE(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { tag?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.tag !== "string" || !body.tag) return badRequest("tag required");

  const scheduled = await scheduledCollection();
  await scheduled.deleteMany({ userId: new ObjectId(session.userId), tag: body.tag });
  return NextResponse.json({ ok: true });
}
