import { NextResponse } from "next/server";
import { requireSession, badRequest, unauthorized } from "@/lib/api-auth";
import { creditOneMonth } from "@/lib/billing";
import { PRICE_CURRENCY, PRICE_MINOR, fetchPayment, verifyOrderSignature } from "@/lib/razorpay";

/**
 * Confirms a one-off payment and extends access by a month.
 *
 * Three checks, because the signature alone only proves Razorpay sent these
 * fields — not that money moved:
 *   1. HMAC over `order_id|payment_id` with the key secret.
 *   2. The payment is re-read from Razorpay and must be authorized or
 *      captured, and must belong to the order we were given.
 *   3. The amount and currency must match what we charge, so a payment made
 *      for some other, cheaper order can't be replayed here.
 *
 * The credit itself is keyed on the payment id, so re-posting the same signed
 * fields — which stay valid indefinitely — grants nothing the second time.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: {
    razorpay_order_id?: unknown;
    razorpay_payment_id?: unknown;
    razorpay_signature?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;
  if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string") {
    return badRequest("Missing payment fields");
  }

  if (!verifyOrderSignature({ orderId, paymentId, signature })) {
    console.warn("[billing] bad order signature", { userId: session.userId, orderId });
    return NextResponse.json({ error: "Signature check failed" }, { status: 400 });
  }

  try {
    const payment = await fetchPayment(paymentId);
    if (payment.order_id !== orderId) {
      return NextResponse.json({ error: "Payment does not match the order" }, { status: 400 });
    }
    if (payment.status !== "captured" && payment.status !== "authorized") {
      return NextResponse.json({ error: `Payment is ${payment.status}` }, { status: 400 });
    }
    if (payment.amount !== PRICE_MINOR || payment.currency !== PRICE_CURRENCY) {
      console.warn("[billing] amount mismatch", { paid: payment.amount, expected: PRICE_MINOR });
      return NextResponse.json({ error: "Unexpected amount" }, { status: 400 });
    }

    const { coversUntil, credited } = await creditOneMonth(session.userId, {
      paymentId: payment.id,
      orderId: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
    });
    if (credited) {
      console.info("[billing] %s paid %s %s, access to %s", session.email, payment.amount, payment.currency, new Date(coversUntil).toISOString());
    } else {
      // A webhook beat us to it, or this is a replay. Either way the answer is
      // the same and no second month is granted.
      console.info("[billing] %s re-confirmed %s, already covered to %s", session.email, payment.id, new Date(coversUntil).toISOString());
    }
    return NextResponse.json({ ok: true, currentPeriodEnd: coversUntil });
  } catch (err) {
    console.error("[billing] verify order failed", err);
    return NextResponse.json({ error: "Could not confirm the payment" }, { status: 502 });
  }
}
