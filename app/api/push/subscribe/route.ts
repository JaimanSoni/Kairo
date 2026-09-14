import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { subscriptionsCollection, ensureTicker, isPushServiceEndpoint, rememberPushDevice } from "@/lib/push";

/** Registers this browser's push subscription for the signed-in user. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const sub = body.subscription;
  if (
    !sub ||
    typeof sub.endpoint !== "string" ||
    // only the browsers' own push services: this server POSTs to whatever is
    // stored here, so an arbitrary URL would make it a messenger for anyone
    !isPushServiceEndpoint(sub.endpoint) ||
    typeof sub.keys?.p256dh !== "string" ||
    typeof sub.keys?.auth !== "string"
  ) {
    return badRequest("Invalid subscription");
  }

  // keyed by endpoint+user: multiple accounts in one browser each get their pushes
  const subs = await subscriptionsCollection();
  await subs.updateOne(
    { endpoint: sub.endpoint, userId: new ObjectId(session.userId) },
    {
      $set: {
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  await rememberPushDevice(sub.endpoint);
  ensureTicker();
  return NextResponse.json({ ok: true });
}

/** Removes this browser's subscription. */
export async function DELETE(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { endpoint?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.endpoint !== "string") return badRequest("endpoint required");

  const subs = await subscriptionsCollection();
  await subs.deleteOne({ endpoint: body.endpoint, userId: new ObjectId(session.userId) });
  return NextResponse.json({ ok: true });
}
