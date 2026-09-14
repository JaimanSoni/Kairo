import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Proof that this browser knows a PIN: the app lock's, or a list's.
 *
 * Locks used to be drawn over the screen while everything they protected was
 * already in the page, so anyone with devtools and an unlocked laptop could
 * read straight past them. Now the server is the one keeping the secret: a
 * locked app sends nothing, and a locked list's tasks are never sent, until
 * this browser holds a grant earned with the PIN.
 *
 * A grant is a signed, short-lived cookie bound to the account and to a stamp
 * of the PIN it was earned with — change the PIN and every grant for it stops
 * working. The cookies carry no expiry of their own, so they die with the
 * browser, and the token inside dies after twelve hours regardless.
 */

const GRANT_HOURS = 12;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

/** A fragment of the PIN's hash: enough to notice it changed, not enough to attack it. */
export const pinStamp = (hash: string) => hash.slice(0, 16);

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});

const appCookie = (userIdHex: string) => `kairo_app_${userIdHex}`;
const listsCookie = (userIdHex: string) => `kairo_lists_${userIdHex}`;

async function sign(userIdHex: string, audience: string, claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userIdHex)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${GRANT_HOURS}h`)
    .sign(secret());
}

async function read(name: string, userIdHex: string, audience: string): Promise<Record<string, unknown> | null> {
  let token: string | undefined;
  try {
    token = (await cookies()).get(name)?.value;
  } catch {
    // outside a request (a push firing, a script): nobody has proven anything
    return null;
  }
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"], audience, subject: userIdHex });
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- app lock */

export async function grantApp(userIdHex: string, hash: string): Promise<void> {
  (await cookies()).set(appCookie(userIdHex), await sign(userIdHex, "kairo:app", { stamp: pinStamp(hash) }), cookieOptions());
}

export async function isAppOpen(userIdHex: string, hash: string): Promise<boolean> {
  const payload = await read(appCookie(userIdHex), userIdHex, "kairo:app");
  return payload?.stamp === pinStamp(hash);
}

export async function clearApp(userIdHex: string): Promise<void> {
  (await cookies()).delete(appCookie(userIdHex));
}

/* ------------------------------------------------------------ list locks */

/** listId → stamp of the PIN it was opened with. */
export async function listGrants(userIdHex: string): Promise<Record<string, string>> {
  const payload = await read(listsCookie(userIdHex), userIdHex, "kairo:lists");
  const g = payload?.g;
  if (!g || typeof g !== "object") return {};
  const out: Record<string, string> = {};
  for (const [id, stamp] of Object.entries(g as Record<string, unknown>)) {
    if (/^[a-f0-9]{24}$/.test(id) && typeof stamp === "string") out[id] = stamp;
  }
  return out;
}

export function isListOpen(grants: Record<string, string>, listIdHex: string, pinHash: unknown): boolean {
  return typeof pinHash !== "string" || !pinHash || grants[listIdHex] === pinStamp(pinHash);
}

async function writeLists(userIdHex: string, grants: Record<string, string>): Promise<void> {
  const jar = await cookies();
  const entries = Object.entries(grants).slice(-40);
  if (entries.length === 0) {
    jar.delete(listsCookie(userIdHex));
    return;
  }
  jar.set(listsCookie(userIdHex), await sign(userIdHex, "kairo:lists", { g: Object.fromEntries(entries) }), cookieOptions());
}

export async function grantList(userIdHex: string, listIdHex: string, hash: string): Promise<void> {
  const grants = await listGrants(userIdHex);
  delete grants[listIdHex];
  grants[listIdHex] = pinStamp(hash);
  await writeLists(userIdHex, grants);
}

export async function revokeList(userIdHex: string, listIdHex: string): Promise<void> {
  const grants = await listGrants(userIdHex);
  if (!(listIdHex in grants)) return;
  delete grants[listIdHex];
  await writeLists(userIdHex, grants);
}

/** Leaving an account behind — switching away, or signing out — locks everything it had opened. */
export async function clearAllGrants(userIdHex: string): Promise<void> {
  const jar = await cookies();
  jar.delete(appCookie(userIdHex));
  jar.delete(listsCookie(userIdHex));
  // the journal's grant is bound to its account by subject; an account left
  // behind shouldn't leave its diary open for whoever switches back
  jar.delete("kairo_journal");
}
