import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildAuthUrl, googleConfigured, isSafeNext, originFromRequest } from "@/lib/google";

export async function GET(request: Request) {
  if (!googleConfigured()) {
    const url = new URL("/?auth_error=not_configured", request.url);
    return NextResponse.redirect(url);
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("kairo_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  // where to land after signing in, when it's one of our own pages (an invite to claim, the city)
  const next = new URL(request.url).searchParams.get("next");
  if (next && isSafeNext(next)) {
    cookieStore.set("kairo_oauth_next", next, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  } else {
    cookieStore.delete("kairo_oauth_next");
  }

  return NextResponse.redirect(buildAuthUrl(state, originFromRequest(request)));
}
