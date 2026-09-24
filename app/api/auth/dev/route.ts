import { NextResponse } from "next/server";
import { addAccountSession } from "@/lib/session";
import { upsertGoogleUser } from "@/lib/users";

// Local-only escape hatch to try the app before Google OAuth is configured.
// Requires NODE_ENV=development AND DEV_LOGIN=1; never active in production.
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_LOGIN !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  /*
   * `?as=someone@example.com` signs in as that address instead.
   *
   * Some things only appear for certain addresses -- the AllEvents standup,
   * for one -- and the session carries the email, so there is otherwise no
   * way to see them locally at all. It cannot reach production: this whole
   * route is off unless NODE_ENV is development and DEV_LOGIN is set.
   */
  const asked = new URL(request.url).searchParams.get("as");
  const email = asked && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(asked) ? asked.toLowerCase() : "dev@local.test";

  const user = await upsertGoogleUser({
    sub: "dev-local-user",
    email,
    name: "Dev User",
  });
  await addAccountSession({
    userId: user._id.toHexString(),
    email: user.email,
    name: user.name,
  });
  return NextResponse.redirect(new URL("/today", request.url));
}
