import { ObjectId } from "mongodb";
import { getDb, withDbRetry } from "./db";

/**
 * Coffee tips paid through Razorpay Checkout.
 *
 * Kept apart from the `orders` ledger on purpose: a row in that collection
 * means "credit a month of access when this is paid", and a thank-you must
 * never be able to mean that. The webhook checks here FIRST, so a tip's
 * payment.captured event is marked and swallowed before any of the
 * subscription machinery can see it.
 */

export type TipRecord = {
  orderId: string;
  /** Signed-in tipper, when there was one. Tips from the landing page have none. */
  userId: string | null;
  amountMinor: number;
  currency: string;
};

let indexReady: Promise<unknown> | null = null;
function ensureTipIndex(db: Awaited<ReturnType<typeof getDb>>): Promise<unknown> {
  indexReady ??= db
    .collection("tips")
    .createIndex({ orderId: 1 }, { unique: true, name: "orderId_unique" })
    .catch((err: unknown) => {
      indexReady = null;
      throw err;
    });
  return indexReady;
}

export async function recordTip(t: TipRecord): Promise<void> {
  await withDbRetry(async () => {
    const db = await getDb();
    await ensureTipIndex(db);
    await db.collection("tips").insertOne({
      ...t,
      userId: t.userId ? new ObjectId(t.userId) : null,
      status: "created",
      createdAt: new Date(),
    });
  });
}

/**
 * Marks a tip paid and answers whether this order was a tip at all — the
 * webhook's question. Idempotent: Razorpay sends payment.captured and
 * order.paid for the same rupees, and both may land.
 */
export async function markTipPaid(orderId: string, paymentId: string | null): Promise<boolean> {
  return withDbRetry(async () => {
    const db = await getDb();
    const res = await db.collection("tips").updateOne(
      { orderId },
      { $set: { status: "paid", paymentId, paidAt: new Date() } }
    );
    return res.matchedCount > 0;
  });
}
