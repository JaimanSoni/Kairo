import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { getUserById } from "@/lib/users";
import { accessFor, getBillingSettings, type UserBilling } from "@/lib/billing";

/** This account's billing state, for the settings sheet. */
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const [user, settings] = await Promise.all([getUserById(session.userId), getBillingSettings()]);
  if (!user) return unauthorized();

  const billing = (user as { billing?: UserBilling }).billing ?? {};
  const access = await accessFor({ createdAt: user.createdAt, billing, settings });
  return NextResponse.json({
    ...access,
    comped: Boolean(billing.comped),
    canCancel: Boolean(billing.subscriptionId) && (access.status === "active" || access.status === "authenticated"),
  });
}
