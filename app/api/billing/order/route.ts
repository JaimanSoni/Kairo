import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { getUserById } from "@/lib/users";
import { updateUserBilling } from "@/lib/billing";
import {
  PRICE_CURRENCY,
  PRICE_MINOR,
  RAZORPAY_KEY_ID,
  createOrder,
  razorpayConfigured,
} from "@/lib/razorpay";

/**
 * One month of access, charged now.
 *
 * Used when the account can't create subscriptions. The amount and currency
 * are fixed server-side and never read from the request — a client that could
 * name its own price would name zero.
 */
export async function POST() {
  const session = await requireSession();
  if (!session) return unauthorized();
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }

  const user = await getUserById(session.userId);
  if (!user) return unauthorized();

  try {
    const order = await createOrder({
      // receipts are capped at 40 chars by Razorpay
      receipt: `kairo_${session.userId}`.slice(0, 40),
      notes: { userId: session.userId, email: user.email },
    });
    // recorded so the webhook can find the payer if the browser never comes
    // back to confirm — a closed laptop must not cost someone their month
    await updateUserBilling(session.userId, { pendingOrderId: order.id });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("[billing] create order failed", err);
    const message = err instanceof Error ? err.message : "Could not start the payment";
    // an auth failure is ours to fix, not the user's
    const status = /401|Unauthorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message, amount: PRICE_MINOR, currency: PRICE_CURRENCY }, { status });
  }
}
