import { NextResponse } from "next/server";
import { requireSession, badRequest, unauthorized } from "@/lib/api-auth";
import { creditOneMonth, getOrderRecord } from "@/lib/billing";
import { redeemPromo } from "@/lib/promos";
import { fetchPayment, verifyOrderSignature } from "@/lib/razorpay";
import { planForPendingPayment } from "@/lib/pending-plan";

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
  const session = await requireSession({ expired: "allow" });
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
    // Validated against our own frozen record of the order: whose it is,
    // which plan, and exactly what it should cost. Immune to admin price
    // edits mid-checkout, cache skew across instances, and a second tab
    // repointing the pending slot. Orders opened before this record existed
    // fall back to the old pending-plan bookkeeping.
    const rec = await getOrderRecord(orderId);
    if (rec && rec.userId !== session.userId) {
      // a signed confirmation for someone else's order credits nobody here
      console.warn("[billing] order ownership mismatch", { orderId, userId: session.userId });
      return NextResponse.json({ error: "This payment belongs to another account" }, { status: 403 });
    }
    let expectedMinor: number;
    let expectedCurrency: string;
    let planKey: string;
    if (rec) {
      expectedMinor = rec.amountMinor;
      expectedCurrency = rec.currency;
      planKey = rec.planKey;
    } else {
      const plan = await planForPendingPayment(session.userId);
      if (!plan) {
        return NextResponse.json({ error: "No plan to credit this against" }, { status: 500 });
      }
      expectedMinor = plan.priceMinor;
      expectedCurrency = plan.currency;
      planKey = plan.key;
    }
    if (payment.amount !== expectedMinor || payment.currency !== expectedCurrency) {
      console.warn("[billing] amount mismatch", {
        paid: payment.amount,
        expected: expectedMinor,
        plan: planKey,
      });
      return NextResponse.json({ error: "Unexpected amount" }, { status: 400 });
    }

    const { coversUntil, credited } = await creditOneMonth(session.userId, {
      paymentId: payment.id,
      orderId: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      planKey,
    });
    if (rec?.promoCode) {
      void redeemPromo(rec.promoCode, session.userId, {
        paymentId: payment.id,
        planKey,
        amountMinor: payment.amount,
      }).catch((err) => console.error("[billing] promo redemption failed", err));
    }
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
