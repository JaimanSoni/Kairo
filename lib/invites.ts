import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { getDb, withDbRetry } from "./db";
import { sendEmail } from "./email";
import { inviteEmail } from "./email-templates";
import { SITE_URL } from "./site";
import type { DbUser } from "./users";

/**
 * Sharing with an address that has no Kairo account.
 *
 * The order is deliberate and matches what was promised to the sharer: the
 * invite email goes out FIRST, and only a send that Resend accepted creates
 * anything — a typo'd address leaves no ghost account behind. The email
 * carries a magic sign-in link, so by the time the recipient clicks, the
 * account (and the share attached to it) is already waiting for them.
 *
 * The magic link is a bearer credential scoped to sign-in, so the raw token
 * is never stored — only its SHA-256. It stays valid for 14 days and may be
 * used more than once within that window, on purpose: mail scanners follow
 * GET links, and a single-use link would arrive already burned. Expired
 * tokens are swept by a TTL index, so the collection never accumulates.
 */

const MAGIC_TTL_DAYS = 14;
export const MAGIC_TTL_LABEL = "14 days";

/** Deliberately stricter than the routes' `includes("@")` — an invite's only
 *  proof of intent is a deliverable address, so garbage stops here. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

let indexReady: Promise<unknown> | null = null;
function ensureIndexes(db: Awaited<ReturnType<typeof getDb>>): Promise<unknown> {
  indexReady ??= Promise.all([
    db.collection("magic_links").createIndex({ tokenHash: 1 }, { unique: true, name: "magic_token_unique" }),
    db.collection("magic_links").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "magic_ttl" }),
  ]).catch((err: unknown) => {
    indexReady = null;
    throw err;
  });
  return indexReady;
}

/** Mints a sign-in link for an address. The account may not exist yet — the
 *  link is resolved to a user by email only when it is clicked. */
async function mintMagicLink(email: string): Promise<{ url: string; tokenHash: string }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const db = await getDb();
  try {
    await ensureIndexes(db);
  } catch (err) {
    console.error("[invites] could not create magic_links indexes", err);
  }
  await db.collection("magic_links").insertOne({
    tokenHash,
    email,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + MAGIC_TTL_DAYS * 86_400_000),
    uses: 0,
  });
  return { url: `${SITE_URL}/api/auth/magic?token=${token}`, tokenHash };
}

/** The email a valid token signs in, or null. Valid tokens stay valid until
 *  they expire (see the module comment for why they are not single-use). */
export async function resolveMagicToken(token: string): Promise<string | null> {
  if (!token || token.length > 200) return null;
  return withDbRetry(async () => {
    const db = await getDb();
    const link = await db
      .collection("magic_links")
      .findOneAndUpdate(
        { tokenHash: hashToken(token), expiresAt: { $gt: new Date() } },
        { $inc: { uses: 1 }, $set: { lastUsedAt: new Date() } }
      );
    return link ? String(link.email) : null;
  });
}

export type InviteResult =
  | { ok: true; user: DbUser }
  | { ok: false; error: string };

/**
 * Invites an address that has no account: sends the invite email (synchronous,
 * because everything else depends on it landing), then creates the pending
 * account the share can attach to. Returns the user, or the error the sharer
 * should see.
 */
export async function inviteUserByEmail(input: {
  email: string;
  inviterId: string;
  inviterName: string;
  /** One send per item+address — re-sharing the same thing never spams. */
  emailKey: string;
  invite: { kind: "task" | "list"; itemName: string; when?: string | null };
}): Promise<InviteResult> {
  const email = input.email.trim().toLowerCase();
  if (!looksLikeEmail(email)) {
    return { ok: false, error: "That doesn't look like a full email address" };
  }

  const { url, tokenHash } = await mintMagicLink(email);
  const mail = inviteEmail({
    inviterName: input.inviterName,
    kind: input.invite.kind,
    itemName: input.invite.itemName,
    when: input.invite.when ?? null,
    email,
    magicUrl: url,
  });

  const result = await sendEmail({ key: input.emailKey, to: email, ...mail });

  // A refused send creates nothing — and its unused token has no business
  // outliving it. A duplicate claim means an earlier invite for this exact
  // item already went out; fall through and make sure the account exists,
  // which heals the rare case where the send landed but creation failed.
  if (!result.sent && result.skipped !== "duplicate") {
    const db = await getDb();
    await db.collection("magic_links").deleteOne({ tokenHash }).catch(() => {});
    return {
      ok: false,
      error:
        result.skipped === "unconfigured"
          ? "Email isn't configured on this server"
          : "That address didn't accept the invite — worth checking for a typo",
    };
  }

  const user = await withDbRetry(async () => {
    const db = await getDb();
    const now = new Date();
    // upsert by email: two racing invites to the same address make one account
    return db.collection<DbUser>("users").findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          email,
          name: nameFromEmail(email),
          createdAt: now,
          lastLoginAt: now,
          pending: true,
          invitedAt: now,
          invitedBy: new ObjectId(input.inviterId),
        },
      },
      { upsert: true, returnDocument: "after" }
    );
  });
  if (!user) return { ok: false, error: "Couldn't set up the invite, try again" };
  return { ok: true, user };
}

/** "priya.n-sharma@…" → "Priya N Sharma". A guess they can change later. */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local
    .split(/[._\-+]+/)
    .filter((w) => w.length > 0)
    .map((w) => (/^\d+$/.test(w) ? "" : w[0].toUpperCase() + w.slice(1)))
    .filter(Boolean);
  return words.join(" ") || local || email;
}
