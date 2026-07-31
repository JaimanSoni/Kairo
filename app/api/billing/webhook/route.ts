import { NextResponse } from "next/server";
import {
  creditOneMonth,
  findUserByOrderId,
  findUserBySubscriptionId,
  updateUserBilling,
  type SubStatus,
} from "@/lib/billing";
import { verifyWebhookSignature, webhookConfigured } from "@/lib/razorpay";
import { planForPendingPayment } from "@/lib/pending-plan";
import { sendEmail } from "@/lib/email";
import { ADMIN_EMAIL, adminMismatchEmail } from "@/lib/email-templates";

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

/** One-off payments: the safety net when the browser never confirms. */
const PAID = new Set(["order.paid", "payment.captured"]);

type Payload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: { id?: string; order_id?: string | null; amount?: number; currency?: string; status?: string };
    };
    order?: { entity?: { id?: string; amount?: number; currency?: string } };
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

  if (PAID.has(event)) {
    const pay = body.payload?.payment?.entity;
    const orderId = pay?.order_id ?? body.payload?.order?.entity?.id;
    if (!orderId) return NextResponse.json({ ok: true, ignored: event });

    const payer = await findUserByOrderId(orderId);
    if (!payer) return NextResponse.json({ ok: true, unknown: true });

    // The signature proves Razorpay sent this; this proves it is the price of
    // the plan the payer actually opened checkout for.
    const amount = pay?.amount ?? body.payload?.order?.entity?.amount;
    const currency = pay?.currency ?? body.payload?.order?.entity?.currency;
    const plan = await planForPendingPayment(payer.id);
    if (!plan) {
      console.error("[billing] webhook with no plan to credit", { event, orderId });
      return NextResponse.json({ error: "No plan" }, { status: 500 });
    }
    if (amount !== plan.priceMinor || currency !== plan.currency) {
      console.warn("[billing] webhook amount mismatch", { amount, currency, plan: plan.key });
      // this is the paid-but-not-credited case. A console.warn on a
      // serverless function is invisible; an email to the admin is not.
      if (pay?.id) {
        const mail = adminMismatchEmail({
          paymentId: pay.id,
          orderId,
          amount,
          currency,
          expectedMinor: plan.priceMinor,
          expectedCurrency: plan.currency,
        });
        void sendEmail({ key: `mismatch:${pay.id}`, to: ADMIN_EMAIL, ...mail }).catch(() => {});
      }
      return NextResponse.json({ ok: true, mismatch: true });
    }

    // Razorpay sends both `payment.captured` and `order.paid` for one payment,
    // and the browser confirms it too — so the credit must be keyed on the
    // payment id rather than simply applied.
    if (!pay?.id) return NextResponse.json({ ok: true, ignored: event });

    try {
      const { coversUntil, credited } = await creditOneMonth(payer.id, {
        paymentId: pay.id,
        orderId,
        amount: amount ?? 0,
        currency: currency ?? plan.currency,
        planKey: plan.key,
      });
      console.info(
        "[billing] %s -> user %s %s through %s",
        event,
        payer.id,
        credited ? "paid" : "already covered",
        new Date(coversUntil).toISOString()
      );
    } catch (err) {
      console.error("[billing] webhook payment write failed", err);
      return NextResponse.json({ error: "Write failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

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
