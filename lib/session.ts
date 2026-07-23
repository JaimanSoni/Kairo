import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "kairo_session";
const SESSION_DAYS = 30;
const MAX_ACCOUNTS = 5;

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  picture?: string;
};

type SessionData = {
  accounts: SessionPayload[];
  active: number;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

function normalizeAccount(raw: unknown): SessionPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.userId !== "string" || typeof a.email !== "string" || typeof a.name !== "string") {
    return null;
  }
  return {
    userId: a.userId,
    email: a.email,
    name: a.name,
    picture: typeof a.picture === "string" ? a.picture : undefined,
  };
}

async function readData(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });

    // multi-account shape
    if (Array.isArray((payload as { accounts?: unknown }).accounts)) {
      const accounts = ((payload as { accounts: unknown[] }).accounts)
        .map(normalizeAccount)
        .filter((a): a is SessionPayload => a !== null);
      if (accounts.length === 0) return null;
      const rawActive = (payload as { active?: unknown }).active;
      const active =
        typeof rawActive === "number" && rawActive >= 0 && rawActive < accounts.length
          ? rawActive
          : 0;
      return { accounts, active };
    }

    // legacy single-account cookie — upgrade in place
    const single = normalizeAccount(payload);
    if (single) return { accounts: [single], active: 0 };
    return null;
  } catch {
    return null;
  }
}

async function writeData(data: SessionData): Promise<void> {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ accounts: data.accounts, active: data.active })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** The active account — the identity every API route acts as. */
export async function getSession(): Promise<SessionPayload | null> {
  const data = await readData();
  return data ? data.accounts[data.active] : null;
}

/** Full roster for the account switcher. */
export async function getSessionAccounts(): Promise<{
  accounts: SessionPayload[];
  activeUserId: string;
} | null> {
  const data = await readData();
  if (!data) return null;
  return { accounts: data.accounts, activeUserId: data.accounts[data.active].userId };
}

/** Signs in an account: added to the roster (or refreshed) and made active. */
export async function addAccountSession(account: SessionPayload): Promise<void> {
  const data = (await readData()) ?? { accounts: [], active: 0 };
  const idx = data.accounts.findIndex((a) => a.userId === account.userId);
  if (idx >= 0) {
    data.accounts[idx] = account;
    data.active = idx;
  } else {
    data.accounts.push(account);
    if (data.accounts.length > MAX_ACCOUNTS) data.accounts.shift();
    data.active = data.accounts.length - 1;
  }
  await writeData(data);
}

/** Makes another roster account active. Returns false if it isn't signed in. */
export async function switchAccountSession(userId: string): Promise<boolean> {
  const data = await readData();
  if (!data) return false;
  const idx = data.accounts.findIndex((a) => a.userId === userId);
  if (idx === -1) return false;
  data.active = idx;
  await writeData(data);
  return true;
}

/** Signs one account out. Returns how many remain (0 = fully signed out). */
export async function removeAccountSession(userId: string): Promise<number> {
  const data = await readData();
  if (!data) return 0;
  const remaining = data.accounts.filter((a) => a.userId !== userId);
  if (remaining.length === 0) {
    await destroySession();
    return 0;
  }
  await writeData({ accounts: remaining, active: 0 });
  return remaining.length;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };
