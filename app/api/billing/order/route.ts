import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { getUserById } from "@/lib/users";
import { updateUserBilling } from "@/lib/billing";
import { listSellablePlans } from "@/lib/plans";
import { RAZORPAY_KEY_ID, createOrder, razorpayConfigured } from "@/lib/razorpay";

/**
 * One month of access, charged now.
 *
 * Used when the account can't create subscriptions. The amount and currency
 * are fixed server-side and never read from the request — a client that could
 * name its own price would name zero.
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
  try {
    const body = (await request.json()) as { plan?: unknown };
    if (typeof body.plan === "string") wanted = body.plan;
  } catch {
    /* no body — fall through to the default plan below */
  }

  const sellable = await listSellablePlans();
  if (sellable.length === 0) {
    return NextResponse.json({ error: "No plans are available" }, { status: 503 });
  }
  const plan = sellable.find((p) => p.key === wanted) ?? sellable[sellable.length - 1];

  try {
    const order = await createOrder({
      // receipts are capped at 40 chars by Razorpay
      receipt: `kairo_${session.userId}`.slice(0, 40),
      amountMinor: plan.priceMinor,
      currency: plan.currency,
      notes: { userId: session.userId, email: user.email, plan: plan.key },
    });
    // Both recorded so the webhook can finish the job if the browser never comes
    // back to confirm — a closed laptop must not cost someone their month, and
    // it has to know which plan was being bought.
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
