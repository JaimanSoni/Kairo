import { NextResponse } from "next/server";
import { getSession } from "./session";
import { getUserById, type DbUser } from "./users";
import { isAdminEmail } from "./admin";

/**
 * The admin gate for route handlers.
 *
 * `requireAdmin` in lib/admin.ts calls notFound(), which is right for a page
 * and wrong for an API — it renders HTML. This returns the 404 as JSON instead.
 * Still a 404 rather than a 403: there is no reason to confirm the route exists
 * to someone who can't use it.
 *
 * The email is re-read from the database, never taken from the cookie, which is
 * signed but long-lived.
 */
export async function requireAdminApi(): Promise<
  { ok: true; admin: DbUser } | { ok: false; response: NextResponse }
> {
  const notThere = NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getSession();
  if (!session) return { ok: false, response: notThere };
  const admin = await getUserById(session.userId);
  if (!admin || !isAdminEmail(admin.email)) return { ok: false, response: notThere };
  return { ok: true, admin };
}
