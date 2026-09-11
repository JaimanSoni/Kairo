import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getDb } from "./db";
import { getUserById, type DbUser } from "./users";
import { hashPin, makeSalt, verifyPin, PIN_RE } from "./pin";

/**
 * The journal's own PIN.
 *
 * Unlike the list locks, this one is enforced by the server, not just drawn
 * over the screen. A list lock hides tasks that are already in the page; the
 * journal holds the most private thing anyone will put in Kairo, so its pages
 * are not sent to a browser at all until that browser has proved it knows the
 * PIN. Someone with an unlocked laptop and the network tab open gets a 423.
 *
 * Proof is a short-lived signed cookie, bound to both the account and the PIN
 * it was earned with — change the PIN and every unlocked browser locks again.
 */

const COOKIE = "kairo_journal";
const UNLOCK_HOURS = 12;
const FAIL_DELAY_MS = 400;

/** Tries allowed before the first cool-down. */
const FREE_ATTEMPTS = 5;
const MAX_COOLDOWN_MS = 15 * 60_000;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export function hasJournalLock(user: Pick<DbUser, "journalLockHash" | "journalLockSalt"> | null): boolean {
  return Boolean(user?.journalLockHash && user?.journalLockSalt);
}

/** A fragment of the PIN's hash — enough to notice it changed, not enough to attack it. */
const stampOf = (hash: string) => hash.slice(0, 16);

async function grantUnlock(userIdHex: string, hash: string): Promise<void> {
  const token = await new SignJWT({ stamp: stampOf(hash) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userIdHex)
    .setAudience("kairo:journal")
    .setIssuedAt()
    .setExpirationTime(`${UNLOCK_HOURS}h`)
    .sign(secret());
  const jar = await cookies();
  // no `expires`: the cookie dies with the browser, and the token inside
  // dies after twelve hours even if the browser never closes
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

export async function relockJournal(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

async function isUnlocked(userIdHex: string, hash: string): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      audience: "kairo:journal",
      subject: userIdHex,
    });
    return payload.stamp === stampOf(hash);
  } catch {
    return false;
  }
}

/**
 * The gate every journal-content route passes through. Answers with the user
 * when the journal is open to this browser, or the response to send instead.
 */
export async function journalGate(
  userIdHex: string
): Promise<{ ok: true; user: DbUser } | { ok: false; response: NextResponse }> {
  const user = await getUserById(userIdHex);
  if (!user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasJournalLock(user) || (await isUnlocked(userIdHex, user.journalLockHash!))) {
    return { ok: true, user };
  }
  return {
    ok: false,
    response: NextResponse.json({ error: "Your journal is locked.", locked: true }, { status: 423 }),
  };
}

export type JournalLockStatus = {
  hasPin: boolean;
  /** True when a PIN is set and this browser has not entered it. */
  locked: boolean;
  /** Seconds until another attempt is allowed, after too many wrong ones. */
  retryAfter: number;
};

export async function journalLockStatus(userIdHex: string): Promise<JournalLockStatus | null> {
  const user = await getUserById(userIdHex);
  if (!user) return null;
  const hasPin = hasJournalLock(user);
  const locked = hasPin && !(await isUnlocked(userIdHex, user.journalLockHash!));
  return { hasPin, locked, retryAfter: retryAfterOf(user) };
}

function retryAfterOf(user: DbUser): number {
  const until = user.journalLockUntil ? new Date(user.journalLockUntil).getTime() : 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

/**
 * Wrong PINs are counted in the database, not in memory.
 *
 * Four digits is ten thousand guesses; the 400ms delay alone lets a script get
 * through them in about an hour, and an in-memory counter resets every time a
 * serverless instance does. After five misses each further one doubles a
 * cool-down, capped at fifteen minutes — nothing a person mistyping will ever
 * meet, and a wall to anyone guessing.
 */
async function checkPin(user: DbUser, pin: unknown): Promise<{ ok: true } | { ok: false; status: 403 | 429; retryAfter: number }> {
  const wait = retryAfterOf(user);
  if (wait > 0) return { ok: false, status: 429, retryAfter: wait };

  const users = (await getDb()).collection<DbUser>("users");
  if (typeof pin === "string" && verifyPin(pin, user.journalLockSalt!, user.journalLockHash!)) {
    if (user.journalLockFails) {
      await users.updateOne({ _id: user._id }, { $unset: { journalLockFails: "", journalLockUntil: "" } });
    }
    return { ok: true };
  }

  const fails = (user.journalLockFails ?? 0) + 1;
  const over = fails - FREE_ATTEMPTS;
  const cooldown = over >= 0 ? Math.min(MAX_COOLDOWN_MS, 30_000 * 2 ** over) : 0;
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        journalLockFails: fails,
        ...(cooldown > 0 ? { journalLockUntil: new Date(Date.now() + cooldown) } : {}),
      },
    }
  );
  await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
  return cooldown > 0
    ? { ok: false, status: 429, retryAfter: Math.ceil(cooldown / 1000) }
    : { ok: false, status: 403, retryAfter: 0 };
}

export type LockOutcome =
  | { ok: true }
  | { ok: false; status: 400 | 401 | 403 | 429; error: string; retryAfter?: number };

const wrong = (r: { status: 403 | 429; retryAfter: number }): LockOutcome =>
  r.status === 429
    ? { ok: false, status: 429, error: "Too many tries. Take a breath and try again shortly.", retryAfter: r.retryAfter }
    : { ok: false, status: 403, error: "Wrong PIN" };

export async function unlockJournal(userIdHex: string, pin: unknown): Promise<LockOutcome> {
  const user = await getUserById(userIdHex);
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  if (!hasJournalLock(user)) return { ok: false, status: 400, error: "Your journal has no PIN." };
  const checked = await checkPin(user, pin);
  if (!checked.ok) return wrong(checked);
  await grantUnlock(userIdHex, user.journalLockHash!);
  return { ok: true };
}

/** Sets or changes the PIN. Changing one requires the current one. */
export async function setJournalPin(userIdHex: string, pin: unknown, currentPin: unknown): Promise<LockOutcome> {
  if (typeof pin !== "string" || !PIN_RE.test(pin)) {
    return { ok: false, status: 400, error: "PIN must be 4–8 digits" };
  }
  const user = await getUserById(userIdHex);
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  if (hasJournalLock(user)) {
    const checked = await checkPin(user, currentPin);
    if (!checked.ok) return wrong(checked);
  }

  const salt = makeSalt();
  const hash = hashPin(pin, salt);
  const users = (await getDb()).collection<DbUser>("users");
  await users.updateOne(
    { _id: new ObjectId(userIdHex) },
    {
      $set: { journalLockSalt: salt, journalLockHash: hash },
      $unset: { journalLockFails: "", journalLockUntil: "" },
    }
  );
  // the browser that set the PIN stays open; every other one locks, because
  // their unlock was earned with a PIN that no longer exists
  await grantUnlock(userIdHex, hash);
  return { ok: true };
}

export async function removeJournalPin(userIdHex: string, pin: unknown): Promise<LockOutcome> {
  const user = await getUserById(userIdHex);
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  if (!hasJournalLock(user)) return { ok: false, status: 400, error: "Your journal has no PIN." };
  const checked = await checkPin(user, pin);
  if (!checked.ok) return wrong(checked);

  const users = (await getDb()).collection<DbUser>("users");
  await users.updateOne(
    { _id: user._id },
    { $unset: { journalLockHash: "", journalLockSalt: "", journalLockFails: "", journalLockUntil: "" } }
  );
  await relockJournal();
  return { ok: true };
}

export function lockOutcomeResponse(outcome: Exclude<LockOutcome, { ok: true }>): NextResponse {
  return NextResponse.json(
    { error: outcome.error, ...(outcome.retryAfter ? { retryAfter: outcome.retryAfter } : {}) },
    { status: outcome.status, headers: outcome.retryAfter ? { "Retry-After": String(outcome.retryAfter) } : undefined }
  );
}
