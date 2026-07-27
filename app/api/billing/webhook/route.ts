import { NextResponse } from "next/server";
import { findUserBySubscriptionId, updateUserBilling, type SubStatus } from "@/lib/billing";
import { verifyWebhookSignature, webhookConfigured } from "@/lib/razorpay";

/**
 * Razorpay's subscription webhook — the authority on what someone has paid for.
 *
 * Nothing here trusts the payload until the HMAC over the *raw* body matches,
 * so the body is read as text and never re-serialised (re-encoding parsed JSON
 * changes the bytes and would break the signature). An unsigned or wrongly
 * signed request is rejected before anything is read out of it.
 *
 * The subscription id is looked up against our own records rather than taken
 * from `notes`, so a forged note can't move someone else's account.
 */

export const dynamic = "force-dynamic";

/** Events that change whether the app should be usable. */
const HANDLED = new Set([
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.pending",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.completed",
  "subscription.expired",
  "subscription.updated",
]);

type Payload = {
  event?: string;
  payload?: {
    subscription?: {
      entity?: {
        id?: string;
        status?: SubStatus;
        current_end?: number | null;
      };
    };
  };
};

export async function POST(request: Request) {
  if (!webhookConfigured()) {
    console.error("[billing] webhook hit but RAZORPAY_WEBHOOK_SECRET is unset");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    console.warn("[billing] webhook signature rejected");
    // 400, not 401 — Razorpay retries on 5xx, and a bad signature won't fix itself
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  let body: Payload;
  try {
    body = JSON.parse(raw) as Payload;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const event = body.event ?? "";
  const entity = body.payload?.subscription?.entity;
  if (!HANDLED.has(event) || !entity?.id) {
    // acknowledge anything else so Razorpay stops retrying it
    return NextResponse.json({ ok: true, ignored: event });
  }

  const owner = await findUserBySubscriptionId(entity.id);
  if (!owner) {
    console.warn("[billing] webhook for an unknown subscription", entity.id);
    return NextResponse.json({ ok: true, unknown: true });
  }

  try {
    await updateUserBilling(owner.id, {
      status: entity.status,
      currentPeriodEnd: entity.current_end ? entity.current_end * 1000 : undefined,
    });
    console.info("[billing] %s -> user %s now %s", event, owner.id, entity.status);
  } catch (err) {
    // 500 so Razorpay retries — losing this would leave billing state stale
    console.error("[billing] webhook write failed", err);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
