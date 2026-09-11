import { createHash, randomBytes } from "crypto";
import { ObjectId } from "mongodb";
import { getDb, withDbRetry } from "./db";
import { safeTimeZone } from "./tz";

/**
 * Connection keys — the credential an outside assistant uses to act as you.
 *
 * A key is shown once, at creation, and never again: only its SHA-256 lives
 * in the database, so a dump of the collection hands nobody an account. Plain
 * SHA-256 rather than a slow KDF is deliberate and sufficient here — these are
 * 256 random bits, not a password someone might also use elsewhere, and there
 * is nothing to brute-force. Lookup is by hash equality on a unique index,
 * which is also what makes the check constant-time in the way that matters.
 */

export const KEY_PREFIX = "kairo_sk_";
/** Enough rope for a phone, a laptop and a few assistants, not enough to farm. */
export const MAX_KEYS_PER_USER = 10;

export type ApiKeyScope = "read" | "write";

export type ApiKeyDoc = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  /** SHA-256 of the whole key string, hex. The key itself is never stored. */
  hash: string;
  /** Last four characters, so a key can be recognised in a list. */
  last4: string;
  scope: ApiKeyScope;
  /** Whether PIN-locked lists are visible through this connection. */
  includeLocked: boolean;
  /** Whether the journal is reachable through this connection. Absent on older keys: no. */
  includeJournal?: boolean;
  /** IANA zone captured from the browser that created the key. */
  timezone: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

/** What the settings screen is allowed to know. Never includes the key. */
export type ApiKeyInfo = {
  id: string;
  name: string;
  last4: string;
  scope: ApiKeyScope;
  includeLocked: boolean;
  includeJournal: boolean;
  timezone: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export async function apiKeysCollection() {
  const db = await getDb();
  return db.collection<ApiKeyDoc>("api_keys");
}

/**
 * The unique index is the thing that makes "one key, one account" true under
 * concurrency rather than by luck — same reasoning as the users email index.
 */
let indexReady: Promise<unknown> | null = null;
export async function ensureApiKeyIndexes(): Promise<void> {
  const keys = await apiKeysCollection();
  indexReady ??= Promise.all([
    keys.createIndex({ hash: 1 }, { unique: true, name: "api_key_hash_unique" }),
    keys.createIndex({ userId: 1, createdAt: -1 }, { name: "api_key_by_user" }),
  ]).catch((err: unknown) => {
    indexReady = null;
    throw err;
  });
  await indexReady;
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function toKeyInfo(doc: ApiKeyDoc): ApiKeyInfo {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    last4: doc.last4,
    scope: doc.scope,
    includeLocked: Boolean(doc.includeLocked),
    includeJournal: Boolean(doc.includeJournal),
    timezone: doc.timezone,
    createdAt: doc.createdAt.toISOString(),
    lastUsedAt: doc.lastUsedAt ? doc.lastUsedAt.toISOString() : null,
  };
}

export async function listApiKeys(userIdHex: string): Promise<ApiKeyInfo[]> {
  const keys = await apiKeysCollection();
  const docs = await keys
    .find({ userId: new ObjectId(userIdHex), revokedAt: null })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toKeyInfo);
}

export type CreateKeyResult =
  | { ok: true; key: string; info: ApiKeyInfo }
  | { ok: false; error: string };

export async function createApiKey(input: {
  userIdHex: string;
  name: string;
  scope: ApiKeyScope;
  includeLocked: boolean;
  includeJournal?: boolean;
  timezone: string;
}): Promise<CreateKeyResult> {
  const name = input.name.trim().slice(0, 60) || "Untitled connection";
  const userId = new ObjectId(input.userIdHex);

  await ensureApiKeyIndexes();
  const keys = await apiKeysCollection();

  const live = await keys.countDocuments({ userId, revokedAt: null });
  if (live >= MAX_KEYS_PER_USER) {
    return { ok: false, error: `You already have ${MAX_KEYS_PER_USER} keys. Revoke one first.` };
  }

  // 256 bits of randomness, url-safe so it survives a query string
  const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const now = new Date();
  const doc: ApiKeyDoc = {
    _id: new ObjectId(),
    userId,
    name,
    hash: hashKey(key),
    last4: key.slice(-4),
    scope: input.scope,
    includeLocked: input.includeLocked,
    includeJournal: input.includeJournal === true,
    timezone: safeTimeZone(input.timezone),
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null,
  };
  await keys.insertOne(doc);
  return { ok: true, key, info: toKeyInfo(doc) };
}

/**
 * Revoking marks rather than deletes: the row is the only record that a key
 * ever existed, and "when did I turn that off" is a question worth answering.
 * A revoked key is dead for auth — findLiveApiKey filters on revokedAt.
 */
export async function revokeApiKey(userIdHex: string, keyIdHex: string): Promise<boolean> {
  if (!ObjectId.isValid(keyIdHex)) return false;
  const keys = await apiKeysCollection();
  const result = await keys.updateOne(
    { _id: new ObjectId(keyIdHex), userId: new ObjectId(userIdHex), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return result.matchedCount > 0;
}

export async function updateApiKey(
  userIdHex: string,
  keyIdHex: string,
  patch: { name?: string; scope?: ApiKeyScope; includeLocked?: boolean; includeJournal?: boolean; timezone?: string }
): Promise<ApiKeyInfo | null> {
  if (!ObjectId.isValid(keyIdHex)) return null;
  const set: Partial<ApiKeyDoc> = {};
  if (patch.name !== undefined) set.name = patch.name.trim().slice(0, 60) || "Untitled connection";
  if (patch.scope !== undefined) set.scope = patch.scope;
  if (patch.includeLocked !== undefined) set.includeLocked = patch.includeLocked;
  if (patch.includeJournal !== undefined) set.includeJournal = patch.includeJournal;
  if (patch.timezone !== undefined) set.timezone = safeTimeZone(patch.timezone);
  if (Object.keys(set).length === 0) return null;

  const keys = await apiKeysCollection();
  const updated = await keys.findOneAndUpdate(
    { _id: new ObjectId(keyIdHex), userId: new ObjectId(userIdHex), revokedAt: null },
    { $set: set },
    { returnDocument: "after" }
  );
  return updated ? toKeyInfo(updated) : null;
}

export function looksLikeKey(token: unknown): token is string {
  return typeof token === "string" && token.startsWith(KEY_PREFIX) && token.length <= 128;
}

export async function findLiveApiKey(token: string): Promise<ApiKeyDoc | null> {
  if (!looksLikeKey(token)) return null;
  return withDbRetry(async () => {
    const keys = await apiKeysCollection();
    return keys.findOne({ hash: hashKey(token), revokedAt: null });
  });
}

/**
 * "Last used" is a comfort, not a ledger — so it is written at most once a
 * minute per key. Stamping it on every call would turn a read-only tool into
 * a write on an Atlas tier that charges for exactly that.
 */
declare global {
  var _kairoKeyTouch: Map<string, number> | undefined;
}
const TOUCH_INTERVAL_MS = 60_000;
/** Bounded so a long-lived instance seeing many keys cannot grow it forever. */
const TOUCH_MAX_TRACKED = 2000;

export function touchApiKey(doc: ApiKeyDoc): void {
  global._kairoKeyTouch ??= new Map();
  const id = doc._id.toHexString();
  const now = Date.now();
  if (global._kairoKeyTouch.size > TOUCH_MAX_TRACKED) {
    for (const [key, at] of global._kairoKeyTouch) {
      if (now - at >= TOUCH_INTERVAL_MS) global._kairoKeyTouch.delete(key);
    }
  }
  const last = global._kairoKeyTouch.get(id) ?? 0;
  if (now - last < TOUCH_INTERVAL_MS) return;
  global._kairoKeyTouch.set(id, now);
  void apiKeysCollection()
    .then((keys) => keys.updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date(now) } }))
    .catch((err: unknown) => console.error("[api-keys] lastUsedAt failed", err));
}
