import { NextResponse } from "next/server";
import { processDuePushes } from "@/lib/push";
import { armPendingWakes, verifyWakeSignature } from "@/lib/push-wake";

/**
 * The scheduler's call, at the second a push is due: send whatever is due,
 * and book the moments that aren't booked yet. Only for a caller that can
 * prove it is the scheduler; to anyone else this address doesn't exist.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWakeSignature(request.headers.get("upstash-signature"), raw)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await processDuePushes();
  const armed = await armPendingWakes();
  return NextResponse.json({ ok: true, armed });
}
