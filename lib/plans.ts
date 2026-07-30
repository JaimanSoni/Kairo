import { ObjectId, type Document } from "mongodb";
import { getDb, withDbRetry } from "./db";
import { FEATURE_KEYS, sanitiseFeatures, type FeatureKey } from "./features";

/**
 * Sellable plans, editable from the admin.
 *
 * A plan's `key` is what gets written onto a user when they pay, so it is
 * immutable once created and a plan that has ever been sold is retired rather
 * than deleted — otherwise the accounts pointing at it lose the record of what
 * they bought.
 */

export type Plan = {
  id: string;
  /** Stable slug stored on the user. Never changes. */
  key: string;
  name: string;
  tagline: string;
  priceMinor: number;
  currency: string;
  features: FeatureKey[];
  /** Off means it can't be bought; existing holders keep it. */
  active: boolean;
  order: number;
};

export type PlanInput = {
  key?: string;
  name: string;
  tagline?: string;
  priceMinor: number;
  currency?: string;
  features: unknown;
  active?: boolean;
  order?: number;
};

/**
 * What the site ships with. Seeded once, then owned by whoever edits them in
 * the admin — this is a starting point, not a source of truth.
 */
const DEFAULTS: Omit<Plan, "id">[] = [
  {
    key: "lite",
    name: "Lite",
    tagline: "One account, everything you plan with.",
    priceMinor: 19900,
    currency: "INR",
    features: [],
    active: true,
    order: 0,
  },
  {
    key: "full",
    name: "Full",
    tagline: "Everything Kairo does.",
    priceMinor: 29900,
    currency: "INR",
    features: [...FEATURE_KEYS],
    active: true,
    order: 1,
  },
];

export { FALLBACK_PAID_PLAN } from "./plan-constants";

function toPlan(d: Document): Plan {
  return {
    id: (d._id as ObjectId).toHexString(),
    key: String(d.key),
    name: String(d.name ?? d.key),
    tagline: String(d.tagline ?? ""),
    priceMinor: Number(d.priceMinor ?? 0),
    currency: String(d.currency ?? "INR"),
    features: sanitiseFeatures(d.features),
    active: d.active !== false,
    order: Number(d.order ?? 0),
  };
}

let seeded: Promise<void> | null = null;

/**
 * Creates the default plans the first time anything asks, and the unique index
 * that makes `key` safe to store on a user. Cached per process; a failure
 * clears the cache so the next call tries again.
 */
function ensureSeeded(): Promise<void> {
  seeded ??= (async () => {
    const db = await getDb();
    await db.collection("plans").createIndex({ key: 1 }, { unique: true, name: "plan_key_unique" });
    for (const plan of DEFAULTS) {
      // $setOnInsert only — never overwrite prices someone has since edited
      await db
        .collection("plans")
        .updateOne({ key: plan.key }, { $setOnInsert: { ...plan, createdAt: new Date() } }, { upsert: true });
    }
  })().catch((err: unknown) => {
    seeded = null;
    throw err;
  });
  return seeded;
}

export async function listPlans(): Promise<Plan[]> {
  return withDbRetry(async () => {
    await ensureSeeded();
    const db = await getDb();
    const docs = await db.collection("plans").find({}).sort({ order: 1, priceMinor: 1 }).toArray();
    return docs.map(toPlan);
  });
}

/** Only what a visitor may actually buy. */
export async function listSellablePlans(): Promise<Plan[]> {
  return (await listPlans()).filter((p) => p.active);
}

export async function getPlan(key: string): Promise<Plan | null> {
  return (await listPlans()).find((p) => p.key === key) ?? null;
}

/** key → features, the shape the pure access rules take. */
export async function planFeatureMap(): Promise<Record<string, FeatureKey[]>> {
  const out: Record<string, FeatureKey[]> = {};
  for (const p of await listPlans()) out[p.key] = p.features;
  return out;
}

/** Turns a name into a slug that won't collide with an existing plan. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "plan"
  );
}

export async function createPlan(input: PlanInput): Promise<Plan> {
  return withDbRetry(async () => {
    await ensureSeeded();
    const db = await getDb();
    const base = slugify(input.key || input.name);
    let key = base;
    for (let n = 2; await db.collection("plans").findOne({ key }); n++) key = `${base}-${n}`;

    const doc = {
      key,
      name: input.name.trim().slice(0, 60) || key,
      tagline: (input.tagline ?? "").trim().slice(0, 140),
      priceMinor: Math.max(100, Math.round(input.priceMinor)),
      currency: (input.currency ?? "INR").toUpperCase().slice(0, 3),
      features: sanitiseFeatures(input.features),
      active: input.active !== false,
      order: Number.isFinite(input.order) ? Number(input.order) : 99,
      createdAt: new Date(),
    };
    const { insertedId } = await db.collection("plans").insertOne(doc);
    return toPlan({ ...doc, _id: insertedId });
  });
}

export async function updatePlan(id: string, patch: Partial<PlanInput>): Promise<void> {
  await withDbRetry(async () => {
    const db = await getDb();
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name.trim().slice(0, 60);
    if (patch.tagline !== undefined) set.tagline = patch.tagline.trim().slice(0, 140);
    if (patch.priceMinor !== undefined) set.priceMinor = Math.max(100, Math.round(patch.priceMinor));
    if (patch.currency !== undefined) set.currency = patch.currency.toUpperCase().slice(0, 3);
    if (patch.features !== undefined) set.features = sanitiseFeatures(patch.features);
    if (patch.active !== undefined) set.active = Boolean(patch.active);
    if (patch.order !== undefined) set.order = Number(patch.order);
    // `key` is deliberately absent: users point at it.
    await db.collection("plans").updateOne({ _id: new ObjectId(id) }, { $set: set });
  });
}

/**
 * Removes a plan nobody holds. A plan that has been sold is retired instead,
 * so the accounts on it keep a name for what they bought.
 */
export async function deletePlan(id: string): Promise<{ deleted: boolean; holders: number }> {
  return withDbRetry(async () => {
    const db = await getDb();
    const plan = await db.collection("plans").findOne({ _id: new ObjectId(id) });
    if (!plan) return { deleted: false, holders: 0 };

    const holders = await db.collection("users").countDocuments({ "billing.planKey": plan.key });
    if (holders > 0) {
      await db
        .collection("plans")
        .updateOne({ _id: new ObjectId(id) }, { $set: { active: false, updatedAt: new Date() } });
      return { deleted: false, holders };
    }
    await db.collection("plans").deleteOne({ _id: new ObjectId(id) });
    return { deleted: true, holders: 0 };
  });
}
