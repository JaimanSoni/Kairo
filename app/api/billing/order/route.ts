import { NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { getUserById } from "@/lib/users";
import { creditOneMonth, recordOrder, updateUserBilling } from "@/lib/billing";
import { listSellablePlans } from "@/lib/plans";
import { discountedMinor, redeemPromo, validatePromo } from "@/lib/promos";
import { RAZORPAY_KEY_ID, createOrder, razorpayConfigured } from "@/lib/razorpay";

/**
 * One month of access, charged now.
 *
 * Used when the account can't create subscriptions. The amount and currency
 * are fixed server-side and never read from the request — a client that could
 * name its own price would name zero. A promo code arrives as a code only;
 * the discount it earns is computed here and frozen onto the order record,
 * which is exactly what the payment will later be validated against.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }

  const user = await getUserById(session.userId);
  if (!user) return unauthorized();

  // The request names a plan; the *price* is then read from that plan on the
  // server. A client can choose what to buy, never what it costs.
  let wanted = "";
  let promoRaw = "";
  try {
    const body = (await request.json()) as { plan?: unknown; promo?: unknown };
    if (typeof body.plan === "string") wanted = body.plan;
    if (typeof body.promo === "string") promoRaw = body.promo;
  } catch {
    /* no body — fall through to the default plan below */
  }

  const sellable = await listSellablePlans();
  if (sellable.length === 0) {
    return NextResponse.json({ error: "No plans are available" }, { status: 503 });
  }
  // An unnamed plan falls back to the CHEAPEST: this used to pick the dearest
  // while the trial banner displayed the cheapest price, and the difference
  // was charged without ever being shown.
  const plan = sellable.find((p) => p.key === wanted) ?? sellable[0];

  let promoCode: string | null = null;
  let amountMinor = plan.priceMinor;
  if (promoRaw) {
    const check = await validatePromo(promoRaw, plan.key, session.userId);
    if (!check.ok) return badRequest(check.error);
    promoCode = check.promo.code;
    amountMinor = discountedMinor(plan.priceMinor, check.promo.percentOff);
  }

  try {
    // A 100% code needs no checkout at all: the month is credited directly,
    // keyed so the same code+account can never credit twice.
    if (amountMinor === 0 && promoCode) {
      const paymentId = `promo_${promoCode}_${session.userId}`;
      const { coversUntil } = await creditOneMonth(session.userId, {
        paymentId,
        orderId: null,
        amount: 0,
        currency: plan.currency,
        planKey: plan.key,
      });
      await redeemPromo(promoCode, session.userId, {
        paymentId,
        planKey: plan.key,
        amountMinor: 0,
      });
      return NextResponse.json({ free: true, currentPeriodEnd: coversUntil });
    }

    const order = await createOrder({
      // receipts are capped at 40 chars by Razorpay
      receipt: `kairo_${session.userId}`.slice(0, 40),
      amountMinor,
      currency: plan.currency,
      notes: { userId: session.userId, email: user.email, plan: plan.key },
    });
    // The frozen row both confirmers validate against: whose order, which
    // plan, and exactly what it should cost — immune to admin price edits,
    // cache skew and second tabs repointing the pending slot.
    await recordOrder({
      orderId: order.id,
      userId: session.userId,
      planKey: plan.key,
      amountMinor,
      currency: plan.currency,
      promoCode,
    });
    // Kept as well so the webhook can still resolve legacy in-flight orders
    // and the settings sheet can show what is pending.
    await updateUserBilling(session.userId, { pendingOrderId: order.id, pendingPlanKey: plan.key });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
      plan: plan.key,
      planName: plan.name,
    });
  } catch (err) {
    console.error("[billing] create order failed", err);
    const message = err instanceof Error ? err.message : "Could not start the payment";
    // an auth failure is ours to fix, not the user's
    const status = /401|Unauthorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
