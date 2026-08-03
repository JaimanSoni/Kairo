import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { recordTip } from "@/lib/tips";
import { RAZORPAY_KEY_ID, createOrder, razorpayConfigured } from "@/lib/razorpay";

/**
 * A coffee, charged through Razorpay Checkout.
 *
 * Open to signed-out visitors on purpose — the coffee button lives on the
 * landing page and in support, where there is no session to require. The
 * amount IS read from the request here, which is the opposite of the billing
 * rule, and it is fine for exactly one reason: paying it unlocks nothing.
 * A client that names its own price is only naming its own tip.
 */

/** Mirrors the modal's cap: a typo like 99999 is a typo, not a tip. */
const MAX_RUPEES = 20000;

/**
 * Per-instance brake so an anonymous endpoint that creates gateway orders
 * can't be looped into filling the Razorpay dashboard with junk. One warm
 * serverless instance sees a hot loop; honest tippers never get near this.
 */
const RATE_LIMIT = 8;
const buckets = new Map<string, { n: number; at: number }>();
function overLimit(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.at > 60_000) {
    if (buckets.size > 5_000) buckets.clear();
    buckets.set(key, { n: 1, at: now });
    return false;
  }
  b.n++;
  return b.n > RATE_LIMIT;
}

export async function POST(request: Request) {
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }

  let rupees = 0;
  try {
    const body = (await request.json()) as { amount?: unknown };
    if (typeof body.amount === "number") rupees = body.amount;
  } catch {
    /* falls through to the range check below */
  }
  if (!Number.isInteger(rupees) || rupees < 1 || rupees > MAX_RUPEES) {
    return NextResponse.json({ error: "That amount doesn't look right" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (overLimit(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  const session = await getSession().catch(() => null);

  try {
    const order = await createOrder({
      // 4 + 36 chars: exactly Razorpay's 40-char receipt cap
      receipt: `tip_${crypto.randomUUID()}`,
      amountMinor: rupees * 100,
      currency: "INR",
      notes: { purpose: "coffee", ...(session ? { userId: session.userId } : {}) },
    });
    // Recorded BEFORE responding so the webhook can never see a paid tip it
    // has no record of and go looking for a subscription to credit.
    await recordTip({
      orderId: order.id,
      userId: session?.userId ?? null,
      amountMinor: rupees * 100,
      currency: "INR",
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("[coffee] create tip order failed", err);
    return NextResponse.json({ error: "Couldn't start the payment. Try again in a moment." }, { status: 500 });
  }
}
