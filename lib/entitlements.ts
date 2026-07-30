import { NextResponse } from "next/server";
import { getUserById } from "./users";
import { accessFor, type UserBilling } from "./billing";
import { can } from "./access";
import type { FeatureKey } from "./features";

/**
 * The server-side half of a paid feature.
 *
 * Hiding a button is a courtesy, not a control: the request it would have sent
 * can still be typed by hand. Every gated route calls this, so the plan is
 * enforced where the work happens rather than where it is offered.
 */
export async function requireFeature(
  userId: string,
  feature: FeatureKey
): Promise<NextResponse | null> {
  const user = await getUserById(userId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await accessFor({
    createdAt: user.createdAt,
    billing: (user as { billing?: UserBilling }).billing,
  });

  if (!access.allowed) {
    return NextResponse.json(
      { error: "Your access has ended.", upgrade: true },
      { status: 402 }
    );
  }
  if (!can(access, feature)) {
    // 402 rather than 403: this isn't "you may never", it's "not on this plan"
    return NextResponse.json(
      { error: "That's not part of your plan.", upgrade: true, feature },
      { status: 402 }
    );
  }
  return null;
}

/** The same question, as a boolean, for places that redirect instead of erroring. */
export async function hasFeature(userId: string, feature: FeatureKey): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  const access = await accessFor({
    createdAt: user.createdAt,
    billing: (user as { billing?: UserBilling }).billing,
  });
  return can(access, feature);
}
