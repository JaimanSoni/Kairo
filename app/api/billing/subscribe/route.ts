import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { getUserById } from "@/lib/users";
import {
  TRIAL_DAYS,
  getBillingSettings,
  accessFor,
  updateUserBilling,
  type UserBilling,
} from "@/lib/billing";
import {
  RAZORPAY_KEY_ID,
  createCustomer,
  createSubscription,
  fetchSubscription,
  razorpayConfigured,
} from "@/lib/razorpay";

/**
 * Starts (or resumes) a subscription and hands Checkout what it needs.
 *
 * The first charge is set to the end of the trial, so the mandate is taken now
 * and no money moves until the free days are used up. Someone who subscribes
 * mid-trial keeps the rest of it.
 */
export async function POST() {
  const session = await requireSession({ expired: "allow" });
  if (!session) return unauthorized();
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }

  const user = await getUserById(session.userId);
  if (!user) return unauthorized();

  const billing = (user as { billing?: UserBilling }).billing ?? {};

  // Reuse a subscription that's still awaiting authorisation rather than
  // stacking a second mandate on the same account.
  if (billing.subscriptionId && (!billing.status || billing.status === "created")) {
    try {
      const existing = await fetchSubscription(billing.subscriptionId);
      if (existing.status === "created") {
        return NextResponse.json({ subscriptionId: existing.id, keyId: RAZORPAY_KEY_ID });
      }
    } catch {
      /* gone or unreadable — fall through and make a new one */
    }
  }

  const settings = await getBillingSettings();
  const access = await accessFor({ createdAt: user.createdAt, billing, settings });

  try {
    const customerId =
      billing.customerId ??
      (await createCustomer({ name: user.name || user.email, email: user.email })).id;

    // charge when the trial runs out; if it already has, charge on the next cycle
    const startAt =
      access.trialEndsAt > Date.now() ? Math.floor(access.trialEndsAt / 1000) : undefined;

    const sub = await createSubscription({
      customerId,
      startAt,
      notes: { userId: session.userId, email: user.email, trialDays: String(TRIAL_DAYS) },
    });

    await updateUserBilling(session.userId, {
      subscriptionId: sub.id,
      customerId,
      status: sub.status,
    });

    return NextResponse.json({ subscriptionId: sub.id, keyId: RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("[billing] subscribe failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start the subscription" },
      { status: 502 }
    );
  }
}
