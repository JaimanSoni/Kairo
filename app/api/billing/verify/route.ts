import { NextResponse } from "next/server";
import { requireSession, badRequest, unauthorized } from "@/lib/api-auth";
import { getUserById } from "@/lib/users";
import { updateUserBilling, type UserBilling } from "@/lib/billing";
import { fetchSubscription, verifyCheckoutSignature } from "@/lib/razorpay";

/**
 * Called by the browser right after Checkout succeeds, so the UI can unlock
 * without waiting on a webhook.
 *
 * Two things stop this being a way to grant yourself a subscription: the
 * signature is verified against our key secret, and the subscription's real
 * state is then re-read from Razorpay rather than taken from the request. The
 * webhook remains the authority — this only shortens the wait.
 */
export async function POST(request: Request) {
  const session = await requireSession({ expired: "allow" });
  if (!session) return unauthorized();

  let body: { razorpay_payment_id?: unknown; razorpay_subscription_id?: unknown; razorpay_signature?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const paymentId = body.razorpay_payment_id;
  const subscriptionId = body.razorpay_subscription_id;
  const signature = body.razorpay_signature;
  if (typeof paymentId !== "string" || typeof subscriptionId !== "string" || typeof signature !== "string") {
    return badRequest("Missing payment fields");
  }

  if (!verifyCheckoutSignature({ paymentId, subscriptionId, signature })) {
    console.warn("[billing] bad checkout signature", { userId: session.userId, subscriptionId });
    return NextResponse.json({ error: "Signature check failed" }, { status: 400 });
  }

  const user = await getUserById(session.userId);
  const billing = (user as { billing?: UserBilling } | null)?.billing ?? {};
  // the signature proves Razorpay sent it; this proves it's *this* user's.
  // Strict equality on purpose: an account with no recorded subscription must
  // not be able to adopt someone else's id and inherit its "active" status.
  if (billing.subscriptionId !== subscriptionId) {
    return NextResponse.json({ error: "Subscription does not belong to this account" }, { status: 403 });
  }

  try {
    const sub = await fetchSubscription(subscriptionId);
    await updateUserBilling(session.userId, {
      subscriptionId: sub.id,
      status: sub.status,
      currentPeriodEnd: sub.current_end ? sub.current_end * 1000 : undefined,
    });
    return NextResponse.json({ status: sub.status });
  } catch (err) {
    console.error("[billing] verify failed", err);
    return NextResponse.json({ error: "Could not confirm the subscription" }, { status: 502 });
  }
}
