import { ObjectId } from "mongodb";
import { getDb, withDbRetry } from "./db";
import { razorpayConfigured } from "./razorpay";
import { microCache } from "./micro-cache";
import type { BillingSettings, UserBilling } from "./access";

import { resolveAccess } from "./access";
import { planFeatureMap } from "./plans";
import type { Access } from "./access";

export { TRIAL_DAYS, resolveAccess, can } from "./access";
export type { Access, BillingSettings, SubStatus, UserBilling } from "./access";

const SETTINGS_ID = "billing";

/**
 * `resolveAccess` with the plans fetched for you.
 *
 * The rules stay pure and this does the I/O, so there is still exactly one
 * place that decides what an account may use — and no call site can forget to
 * pass the plans and silently grant everything.
 */
export async function accessFor(input: {
  createdAt?: Date | null;
  billing?: UserBilling | null;
  settings?: BillingSettings;
  now?: number;
}): Promise<Access> {
  const [settings, planFeatures] = await Promise.all([
    input.settings ? Promise.resolve(input.settings) : getBillingSettings(),
    planFeatureMap(),
  ]);
  return resolveAccess({ ...input, settings, planFeatures });
}

/**
 * One tiny document, read by every page and gated API. Cached for 30 seconds —
 * shorter than the plans, because this is the emergency lever: flipping
 * payments off must reach every instance fast. The instance that flips it sees
 * the change immediately via the bust below.
 */
const settingsCache = microCache<BillingSettings>("billing-settings", 30_000, () =>
  withDbRetry(async () => {
    const db = await getDb();
    const doc = await db.collection("settings").findOne({ _id: SETTINGS_ID as never });
    return { paymentsEnabled: Boolean(doc?.paymentsEnabled), updatedAt: doc?.updatedAt, updatedBy: doc?.updatedBy };
  })
);

export async function getBillingSettings(opts?: { fresh?: boolean }): Promise<BillingSettings> {
  return settingsCache.get(opts);
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
    settingsCache.bust();
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
 *
 * Deliberately not exported: on its own it has no idea whether the payment it
 * is being credited for has already been credited. Go through
 * {@link creditOneMonth}, which does.
 */
async function extendPaidPeriod(userId: string, from = Date.now()): Promise<number> {
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

/**
 * Finds who a one-off order belongs to, from our own record of it.
 *
 * Falls back to the receipt because the pending marker is cleared as soon as
 * any one confirmation lands: if the browser confirms first, a webhook arriving
 * afterwards would otherwise be unable to name the payer at all.
 */
export async function findUserByOrderId(orderId: string): Promise<{ id: string } | null> {
  return withDbRetry(async () => {
    const db = await getDb();
    const pending = await db
      .collection("users")
      .findOne({ "billing.pendingOrderId": orderId }, { projection: { _id: 1 } });
    if (pending) return { id: pending._id.toHexString() };
    const paid = await db
      .collection("payments")
      .findOne({ orderId }, { projection: { userId: 1 } });
    return paid?.userId ? { id: (paid.userId as ObjectId).toHexString() } : null;
  });
}

/**
 * The unique index is what makes a payment creditable exactly once, so it is
 * created on demand rather than left to a migration someone forgets to run.
 * Cached per process; a failure clears the cache so the next call retries.
 */
let paymentIndexReady: Promise<unknown> | null = null;
function ensurePaymentIndex(db: Awaited<ReturnType<typeof getDb>>): Promise<unknown> {
  paymentIndexReady ??= db
    .collection("payments")
    .createIndex({ paymentId: 1 }, { unique: true, name: "paymentId_unique" })
    .catch((err: unknown) => {
      paymentIndexReady = null;
      throw err;
    });
  return paymentIndexReady;
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Credits one month for one payment — once, no matter how many times we're told
 * about it.
 *
 * Three things race to confirm the same ₹299: the browser as soon as Checkout
 * returns, and Razorpay's `payment.captured` and `order.paid` webhooks, which
 * arrive within a second of each other. Each of them used to extend the period
 * on its own, so a single payment could buy three months — and since the
 * browser's call carries a signature that stays valid, replaying it bought a
 * month a time for free.
 *
 * The payment id is the idempotency key and inserting its receipt is the claim:
 * whoever wins the insert extends the period, and everyone else is told what
 * the winner granted. The unique index makes that insert the arbiter even when
 * the racers are running in different serverless instances.
 */
export async function creditOneMonth(
  userId: string,
  p: {
    paymentId: string;
    orderId?: string | null;
    amount: number;
    currency: string;
    /** Which plan this month bought. Recorded on the account and the receipt. */
    planKey: string;
  }
): Promise<{ coversUntil: number; credited: boolean }> {
  return withDbRetry(async () => {
    const db = await getDb();
    try {
      await ensurePaymentIndex(db);
    } catch (err) {
      // Losing the index costs us the guarantee, not the payment — carry on and
      // make it loud, because the duplicates it lets through are real money.
      console.error("[billing] could not create the payments unique index", err);
    }

    try {
      await db.collection("payments").insertOne({
        paymentId: p.paymentId,
        userId: new ObjectId(userId),
        orderId: p.orderId ?? null,
        amount: p.amount,
        currency: p.currency,
        planKey: p.planKey,
        paidAt: new Date(),
        coversUntil: null,
      });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      // Someone else already credited this payment. Report what they granted,
      // falling back to the account's own period if they're mid-write.
      const [receipt, user] = await Promise.all([
        db.collection("payments").findOne({ paymentId: p.paymentId }, { projection: { coversUntil: 1 } }),
        db.collection("users").findOne({ _id: new ObjectId(userId) }, { projection: { billing: 1 } }),
      ]);
      const covers =
        (receipt?.coversUntil as number | null) ??
        (user?.billing?.currentPeriodEnd as number | undefined) ??
        Date.now();
      return { coversUntil: covers, credited: false };
    }

    const coversUntil = await extendPaidPeriod(userId);
    await db
      .collection("payments")
      .updateOne({ paymentId: p.paymentId }, { $set: { coversUntil } });
    // planKey is set from the payment, so an upgrade takes effect on the same
    // write that extends the period — never one without the other.
    await updateUserBilling(userId, { pendingOrderId: "", pendingPlanKey: "", planKey: p.planKey });
    return { coversUntil, credited: true };
  });
}

export type PaymentRecord = {
  paymentId: string;
  planKey?: string;
  orderId: string | null;
  amount: number;
  currency: string;
  paidAt: string;
  coversUntil: number | null;
};

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
      planKey: d.planKey ? String(d.planKey) : undefined,
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
  return { settings, payments, now, access: await accessFor({ createdAt, billing, settings, now }) };
}

export type AdminPaymentRow = PaymentRecord & { email: string; name: string };

export type RevenueSnapshot = {
  payments: AdminPaymentRow[];
  /** Minor units, so no floating-point money. */
  totalMinor: number;
  monthMinor: number;
  currency: string;
  payingUsers: number;
  now: number;
};

/**
 * Revenue and recent transactions for the admin dashboard.
 *
 * Money is summed in minor units and only divided for display — adding up
 * rupees as floats is how totals end up a paisa out.
 */
export async function loadRevenue(limit = 50): Promise<RevenueSnapshot> {
  return withDbRetry(async () => {
    const db = await getDb();
    const docs = await db
      .collection("payments")
      .aggregate([
        { $sort: { paidAt: -1 } },
        { $limit: limit },
        { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "u" } },
        {
          $project: {
            paymentId: 1, orderId: 1, amount: 1, currency: 1, paidAt: 1, coversUntil: 1,
            email: { $ifNull: [{ $first: "$u.email" }, "(deleted account)"] },
            name: { $ifNull: [{ $first: "$u.name" }, ""] },
          },
        },
      ])
      .toArray();

    const now = Date.now();
    const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
    const [totals] = await db
      .collection("payments")
      .aggregate<{ total: number; currency: string }>([
        { $group: { _id: null, total: { $sum: "$amount" }, currency: { $first: "$currency" } } },
      ])
      .toArray();
    const [monthTotals] = await db
      .collection("payments")
      .aggregate<{ total: number }>([
        { $match: { paidAt: { $gte: new Date(monthStart) } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])
      .toArray();

    const payingUsers = (
      await db.collection("payments").distinct("userId")
    ).length;

    return {
      payments: docs.map((d) => ({
        paymentId: String(d.paymentId),
        orderId: d.orderId ? String(d.orderId) : null,
        amount: Number(d.amount ?? 0),
        currency: String(d.currency ?? "INR"),
        paidAt: (d.paidAt instanceof Date ? d.paidAt : new Date(0)).toISOString(),
        coversUntil: typeof d.coversUntil === "number" ? d.coversUntil : null,
        email: String(d.email ?? ""),
        name: String(d.name ?? ""),
      })),
      totalMinor: totals?.total ?? 0,
      monthMinor: monthTotals?.total ?? 0,
      currency: totals?.currency ?? "INR",
      payingUsers,
      now,
    };
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
