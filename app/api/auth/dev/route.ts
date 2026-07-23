import { NextResponse } from "next/server";
import { addAccountSession } from "@/lib/session";
import { upsertGoogleUser } from "@/lib/users";

// Local-only escape hatch to try the app before Google OAuth is configured.
// Requires NODE_ENV=development AND DEV_LOGIN=1; never active in production.
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_LOGIN !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await upsertGoogleUser({
    sub: "dev-local-user",
    email: "dev@local.test",
    name: "Dev User",
  });
  await addAccountSession({
    userId: user._id.toHexString(),
    email: user.email,
    name: user.name,
  });
  return NextResponse.redirect(new URL("/today", request.url));
}
