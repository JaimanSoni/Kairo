import { ObjectId } from "mongodb";
import { getDb, withDbRetry } from "./db";
import { razorpayConfigured } from "./razorpay";
import type { BillingSettings, UserBilling } from "./access";

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
