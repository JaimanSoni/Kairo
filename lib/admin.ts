import { notFound } from "next/navigation";
import { getSession } from "./session";
import { getUserById, type DbUser } from "./users";

/**
 * Who can reach /admin. Comma-separated in ADMIN_EMAILS, with a default so a
 * fresh deploy needs no configuration to keep working.
 *
 * This is an allow-list, never a claim carried in a request — see requireAdmin.
 */
const ADMINS = new Set(
  (process.env.ADMIN_EMAILS ?? "jaimansoni@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function isAdminEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && ADMINS.has(email.trim().toLowerCase());
}

/**
 * Server-side gate for every admin surface. Call it first in any admin page or
 * route handler — never rely on a hidden link, and never trust an `isAdmin`
 * flag that arrived from the client.
 *
 * The email is re-read from the database rather than taken from the session
 * cookie. The cookie is signed and can't be forged, but it is long-lived: it
 * would keep asserting an old address after an account changed hands.
 *
 * Non-admins get a 404, not a 403 — there's no reason to confirm the route
 * exists to someone who can't use it.
 */
export async function requireAdmin(): Promise<DbUser> {
  const session = await getSession();
  if (!session) notFound();

  const user = await getUserById(session.userId);
  if (!user || !isAdminEmail(user.email)) notFound();

  return user;
}
