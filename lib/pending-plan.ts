import { getUserById } from "./users";
import { getPlan, listSellablePlans, FALLBACK_PAID_PLAN, type Plan } from "./plans";
import type { UserBilling } from "./access";

/**
 * The plan a payment is settling.
 *
 * Both confirmation paths — the browser and the webhook — need to know what was
 * bought, in order to check that the money matches. The answer is our own note
 * of the order (`pendingPlanKey`), never anything from the request: Razorpay's
 * `notes` come back to us intact, but they were also visible to whoever opened
 * the checkout.
 *
 * Falls back to the plan the account already holds, then to full access, so a
 * payment is never rejected for want of bookkeeping.
 */
export async function planForPendingPayment(userId: string): Promise<Plan | null> {
  const user = await getUserById(userId);
  const billing = (user as { billing?: UserBilling } | null)?.billing ?? {};

  for (const key of [billing.pendingPlanKey, billing.planKey, FALLBACK_PAID_PLAN]) {
    if (!key) continue;
    const plan = await getPlan(key);
    if (plan) return plan;
  }
  // Nothing recognisable: the cheapest sellable plan is the safest guess, since
  // it can only under-credit, never over-charge.
  const sellable = await listSellablePlans();
  return sellable.length > 0 ? sellable[0] : null;
}
