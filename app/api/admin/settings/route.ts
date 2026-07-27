import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/users";
import { isAdminEmail } from "@/lib/admin";
import { getBillingSettings, setPaymentsEnabled } from "@/lib/billing";
import { razorpayConfigured, webhookConfigured } from "@/lib/razorpay";

/** Same rule as the admin pages: identity from the database, 404 otherwise. */
async function admin() {
  const session = await getSession();
  if (!session) return null;
  const user = await getUserById(session.userId);
  return user && isAdminEmail(user.email) ? user : null;
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...(await getBillingSettings()),
    razorpayConfigured: razorpayConfigured(),
    webhookConfigured: webhookConfigured(),
  });
}

export async function POST(request: Request) {
  const me = await admin();
  if (!me) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { paymentsEnabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.paymentsEnabled !== "boolean") {
    return NextResponse.json({ error: "paymentsEnabled must be a boolean" }, { status: 400 });
  }

  try {
    const settings = await setPaymentsEnabled(body.paymentsEnabled, me.email);
    console.info("[billing] payments %s by %s", body.paymentsEnabled ? "ON" : "OFF", me.email);
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save" },
      { status: 400 }
    );
  }
}
