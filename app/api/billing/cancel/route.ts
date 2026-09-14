import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { getUserById } from "@/lib/users";
import { updateUserBilling, type UserBilling } from "@/lib/billing";
import { cancelSubscription } from "@/lib/razorpay";

/** Cancels at the end of the paid period — never mid-period. */
export async function POST() {
  const session = await requireSession({ expired: "allow" });
  if (!session) return unauthorized();

  const user = await getUserById(session.userId);
  const billing = (user as { billing?: UserBilling } | null)?.billing ?? {};
  if (!billing.subscriptionId) {
    return NextResponse.json({ error: "Nothing to cancel" }, { status: 400 });
  }

  try {
    const sub = await cancelSubscription(billing.subscriptionId, true);
    await updateUserBilling(session.userId, {
      status: sub.status,
      currentPeriodEnd: sub.current_end ? sub.current_end * 1000 : billing.currentPeriodEnd,
    });
    return NextResponse.json({ status: sub.status });
  } catch (err) {
    console.error("[billing] cancel failed", err);
    return NextResponse.json({ error: "Could not cancel" }, { status: 502 });
  }
}
