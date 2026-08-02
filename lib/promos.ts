import { ObjectId, type Document } from "mongodb";
import { getDb, withDbRetry } from "./db";

/**
 * Promo codes.
 *
 * Security model, in one paragraph: the client only ever names a code. The
 * discount is computed server-side against the plan's server-side price, the
 * discounted amount is frozen onto the order record at creation, and both
 * payment confirmers validate against that frozen row — so no request can
 * name a price, replay a cheaper order, or stretch a discount. Redemptions
 * are counted at credit time (when money actually moved), with a unique
 * (code, user) index making per-user-once atomic. The usage cap is enforced
 * at checkout-open; the tiny race between two last-slot checkouts resolves
 * in the customer's favour, never by charging a discount and refusing it.
 */

export type Promo = {
  id: string;
  code: string;
  percentOff: number;
  /** null = unlimited */
  maxUses: number | null;
  usedCount: number;
  /** null = every plan */
  planKeys: string[] | null;
  expiresAt: Date | null;
  active: boolean;
  note: string;
  createdAt: Date;
};

const CODE_RE = /^[A-Z0-9-]{3,24}$/;

export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** Unambiguous alphabet: no O/0/I/1/L lookalikes to read out over a call. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function generateCode(len = 8): string {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

function toPromo(d: Document): Promo {
  return {
    id: (d._id as ObjectId).toHexString(),
    code: String(d.code),
    percentOff: Number(d.percentOff),
    maxUses: typeof d.maxUses === "number" ? d.maxUses : null,
    usedCount: Number(d.usedCount ?? 0),
    planKeys: Array.isArray(d.planKeys) && d.planKeys.length > 0 ? d.planKeys.map(String) : null,
    expiresAt: d.expiresAt instanceof Date ? d.expiresAt : null,
    active: d.active !== false,
    note: String(d.note ?? ""),
    createdAt: d.createdAt instanceof Date ? d.createdAt : new Date(0),
  };
}

let indexReady: Promise<unknown> | null = null;
function ensureIndexes(db: Awaited<ReturnType<typeof getDb>>): Promise<unknown> {
  indexReady ??= Promise.all([
    db.collection("promo_codes").createIndex({ code: 1 }, { unique: true, name: "promo_code_unique" }),
    db
      .collection("promo_redemptions")
      .createIndex({ code: 1, userId: 1 }, { unique: true, name: "promo_once_per_user" }),
  ]).catch((err: unknown) => {
    indexReady = null;
    throw err;
  });
  return indexReady;
}

/* ------------------------------------------------------------------ admin */

export async function listPromos(): Promise<Promo[]> {
  return withDbRetry(async () => {
    const db = await getDb();
    await ensureIndexes(db);
    const docs = await db.collection("promo_codes").find({}).sort({ createdAt: -1 }).toArray();
    return docs.map(toPromo);
  });
}

export async function createPromo(input: {
  code?: string;
  percentOff: number;
  maxUses?: number | null;
  planKeys?: string[] | null;
  expiresAt?: Date | null;
  note?: string;
}): Promise<Promo> {
  const code = input.code ? normalizeCode(input.code) : generateCode();
  if (!code) throw new Error("Codes are 3-24 letters, digits and dashes");
  const percentOff = Math.round(input.percentOff);
  if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100) {
    throw new Error("Percent off must be between 1 and 100");
  }
  return withDbRetry(async () => {
    const db = await getDb();
    await ensureIndexes(db);
    const doc = {
      code,
      percentOff,
      maxUses:
        typeof input.maxUses === "number" && input.maxUses > 0 ? Math.round(input.maxUses) : null,
      usedCount: 0,
      planKeys:
        Array.isArray(input.planKeys) && input.planKeys.length > 0
          ? input.planKeys.map(String)
          : null,
      expiresAt: input.expiresAt ?? null,
      active: true,
      note: (input.note ?? "").slice(0, 140),
      createdAt: new Date(),
    };
    const { insertedId } = await db.collection("promo_codes").insertOne(doc);
    return toPromo({ ...doc, _id: insertedId });
  });
}

export async function updatePromo(
  id: string,
  patch: { active?: boolean; maxUses?: number | null; expiresAt?: Date | null; note?: string }
): Promise<void> {
  await withDbRetry(async () => {
    const db = await getDb();
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.active !== undefined) set.active = Boolean(patch.active);
    if (patch.maxUses !== undefined) {
      set.maxUses =
        typeof patch.maxUses === "number" && patch.maxUses > 0 ? Math.round(patch.maxUses) : null;
    }
    if (patch.expiresAt !== undefined) set.expiresAt = patch.expiresAt;
    if (patch.note !== undefined) set.note = patch.note.slice(0, 140);
    await db.collection("promo_codes").updateOne({ _id: new ObjectId(id) }, { $set: set });
  });
}

/** A code nobody has used is deleted; one with redemptions is deactivated. */
export async function deletePromo(id: string): Promise<{ deleted: boolean }> {
  return withDbRetry(async () => {
    const db = await getDb();
    const doc = await db.collection("promo_codes").findOne({ _id: new ObjectId(id) });
    if (!doc) return { deleted: false };
    if (Number(doc.usedCount ?? 0) > 0) {
      await db
        .collection("promo_codes")
        .updateOne({ _id: new ObjectId(id) }, { $set: { active: false, updatedAt: new Date() } });
      return { deleted: false };
    }
    await db.collection("promo_codes").deleteOne({ _id: new ObjectId(id) });
    return { deleted: true };
  });
}

/* --------------------------------------------------------------- checkout */

export type PromoCheck =
  | { ok: true; promo: Promo }
  | { ok: false; error: string };

/** One deliberately vague message: a prober learns nothing from the reason. */
const INVALID = "That code isn't valid right now";

export async function validatePromo(
  rawCode: string,
  planKey: string,
  userId: string
): Promise<PromoCheck> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: INVALID };

  return withDbRetry(async () => {
    const db = await getDb();
    await ensureIndexes(db);
    const doc = await db.collection("promo_codes").findOne({ code });
    if (!doc || doc.active === false) return { ok: false, error: INVALID };
    const promo = toPromo(doc);
    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
      return { ok: false, error: INVALID };
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return { ok: false, error: INVALID };
    }
    if (promo.planKeys && !promo.planKeys.includes(planKey)) {
      return { ok: false, error: "That code doesn't apply to this plan" };
    }
    const used = await db
      .collection("promo_redemptions")
      .findOne({ code, userId: new ObjectId(userId) });
    if (used) return { ok: false, error: "You've already used that code" };
    return { ok: true, promo };
  });
}

/**
 * What a plan costs with the code applied. Never lands between 0 and ₹1:
 * Razorpay's minimum order is 100 minor units, so a deep discount clamps up
 * to it — only a true 100% reaches zero, and zero skips checkout entirely.
 */
export function discountedMinor(priceMinor: number, percentOff: number): number {
  const cut = Math.round((priceMinor * (100 - percentOff)) / 100);
  if (cut <= 0) return 0;
  return Math.max(100, cut);
}

/**
 * Counts a redemption, once per (code, user) no matter how many confirmers
 * race: the unique index arbitrates, and the cap counter only moves when a
 * redemption row is actually inserted.
 */
export async function redeemPromo(
  code: string,
  userId: string,
  detail: { paymentId: string; planKey: string; amountMinor: number }
): Promise<void> {
  await withDbRetry(async () => {
    const db = await getDb();
    await ensureIndexes(db);
    try {
      await db.collection("promo_redemptions").insertOne({
        code,
        userId: new ObjectId(userId),
        paymentId: detail.paymentId,
        planKey: detail.planKey,
        amountMinor: detail.amountMinor,
        at: new Date(),
      });
    } catch (err) {
      const dup = typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
      if (dup) return; // a racing confirmer already counted it
      throw err;
    }
    await db.collection("promo_codes").updateOne({ code }, { $inc: { usedCount: 1 } });
  });
}
