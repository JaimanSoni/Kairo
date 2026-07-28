import { ObjectId } from "mongodb";
import { getDb, withDbRetry } from "./db";
import { razorpayConfigured } from "./razorpay";
import type { BillingSettings, UserBilling } from "./access";

import { resolveAccess } from "./access";

export { TRIAL_DAYS, resolveAccess } from "./access";
export type { Access, BillingSettings, SubStatus, UserBilling } from "./access";

const SETTINGS_ID = "billing";

export async function getBillingSettings(): Promise<BillingSettings> {
  return withDbRetry(async () => {
    const db = await getDb();
    const doc = await db.collection("settings").findOne({ _id: SETTINGS_ID as never });
    return { paymentsEnabled: Boolean(doc?.paymentsEnabled), updatedAt: doc?.updatedAt, updatedBy: doc?.updatedBy };
  });
}

export async function setPaymentsEnabled(enabled: boolean, by: string): Promise<BillingSettings> {
  // Refuse to arm the paywall without keys — it would lock every user out of
  // an app they can't pay for.
  if (enabled && !razorpayConfigured()) {
    throw new Error("Razorpay is not configured — set the keys and plan id first");
  }
  return withDbRetry(async () => {
    const db = await getDb();
    const updatedAt = new Date();
    await db.collection("settings").updateOne(
      { _id: SETTINGS_ID as never },
      { $set: { paymentsEnabled: enabled, updatedAt, updatedBy: by } },
      { upsert: true }
    );
    return { paymentsEnabled: enabled, updatedAt, updatedBy: by };
  });
}

export async function updateUserBilling(userId: string, patch: UserBilling): Promise<void> {
  await withDbRetry(async () => {
    const db = await getDb();
    const set: Record<string, unknown> = { "billing.updatedAt": new Date() };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) set[`billing.${k}`] = v;
    }
    await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: set });
  });
}

/** Finds the account a webhook refers to, without trusting the payload's notes. */
export async function findUserBySubscriptionId(
  subscriptionId: string
): Promise<{ id: string } | null> {
  return withDbRetry(async () => {
    const db = await getDb();
    const doc = await db
      .collection("users")
      .findOne({ "billing.subscriptionId": subscriptionId }, { projection: { _id: 1 } });
    return doc ? { id: doc._id.toHexString() } : null;
  });
}

/**
 * Extends paid access by a month. Stacks from whichever is later — the end of
 * the period already bought, or now — so paying twice never loses a month.
 */
export async function extendPaidPeriod(userId: string, from = Date.now()): Promise<number> {
  return withDbRetry(async () => {
    const db = await getDb();
    const doc = await db
      .collection("users")
      .findOne({ _id: new ObjectId(userId) }, { projection: { billing: 1 } });
    const current = (doc?.billing?.currentPeriodEnd as number | undefined) ?? 0;
    const base = Math.max(current, from);
    const next = new Date(base);
    next.setMonth(next.getMonth() + 1);
    const currentPeriodEnd = next.getTime();
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { "billing.currentPeriodEnd": currentPeriodEnd, "billing.status": "active", "billing.updatedAt": new Date() } }
    );
    return currentPeriodEnd;
  });
}

/** Finds who a one-off order belongs to, from our own record of it. */
export async function findUserByOrderId(orderId: string): Promise<{ id: string } | null> {
  return withDbRetry(async () => {
    const db = await getDb();
    const doc = await db
      .collection("users")
      .findOne({ "billing.pendingOrderId": orderId }, { projection: { _id: 1 } });
    return doc ? { id: doc._id.toHexString() } : null;
  });
}

export type PaymentRecord = {
  paymentId: string;
  orderId: string | null;
  amount: number;
  currency: string;
  paidAt: string;
  coversUntil: number | null;
};

/**
 * Records a successful payment, keyed on Razorpay's payment id.
 *
 * Both the browser callback and the webhook report the same payment, so this
 * upserts rather than inserts — whichever arrives first writes it, the other
 * is a no-op, and the receipt is never duplicated.
 */
export async function recordPayment(
  userId: string,
  p: { paymentId: string; orderId?: string | null; amount: number; currency: string; coversUntil?: number | null }
): Promise<void> {
  await withDbRetry(async () => {
    const db = await getDb();
    await db.collection("payments").updateOne(
      { paymentId: p.paymentId },
      {
        $set: { coversUntil: p.coversUntil ?? null },
        $setOnInsert: {
          paymentId: p.paymentId,
          userId: new ObjectId(userId),
          orderId: p.orderId ?? null,
          amount: p.amount,
          currency: p.currency,
          paidAt: new Date(),
        },
      },
      { upsert: true }
    );
  });
}

/** This account's receipts, newest first. */
export async function listPayments(userId: string, limit = 24): Promise<PaymentRecord[]> {
  return withDbRetry(async () => {
    const db = await getDb();
    const docs = await db
      .collection("payments")
      .find({ userId: new ObjectId(userId) })
      .sort({ paidAt: -1 })
      .limit(limit)
      .toArray();
    return docs.map((d) => ({
      paymentId: String(d.paymentId),
      orderId: d.orderId ? String(d.orderId) : null,
      amount: Number(d.amount ?? 0),
      currency: String(d.currency ?? "INR"),
      paidAt: (d.paidAt instanceof Date ? d.paidAt : new Date(0)).toISOString(),
      coversUntil: typeof d.coversUntil === "number" ? d.coversUntil : null,
    }));
  });
}

/**
 * Everything the billing page renders, including its own "now" — reading the
 * clock during render is impure, so the snapshot carries its own timestamp.
 */
export async function loadBillingView(userId: string, createdAt?: Date | null, billing?: UserBilling | null) {
  const [settings, payments] = await Promise.all([getBillingSettings(), listPayments(userId)]);
  const now = Date.now();
  return { settings, payments, now, access: resolveAccess({ createdAt, billing, settings, now }) };
}

export async function setComped(
  userId: string,
  comped: boolean,
  note?: string
): Promise<void> {
  await withDbRetry(async () => {
    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "billing.comped": comped,
          "billing.compedNote": comped ? (note ?? "") : "",
          "billing.updatedAt": new Date(),
        },
      }
    );
  });
}
