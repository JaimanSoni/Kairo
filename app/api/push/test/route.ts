import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { sendToUser, subscriptionsCollection, ensureTicker } from "@/lib/push";

/** Sends an immediate test notification to all of the user's devices. */
export async function POST() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const userId = new ObjectId(session.userId);
  const subs = await subscriptionsCollection();
  const count = await subs.countDocuments({ userId });
  if (count === 0) {
    return NextResponse.json({ error: "No subscription — enable notifications first" }, { status: 409 });
  }

  ensureTicker();
  await sendToUser(userId, {
    title: "✅ Notifications are working",
    body: "This is your Kairo test ping.",
    tag: "kairo-test",
    url: "/today",
  });
  return NextResponse.json({ ok: true, devices: count });
}
