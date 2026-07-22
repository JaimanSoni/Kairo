import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildAuthUrl, googleConfigured } from "@/lib/google";

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

  return NextResponse.redirect(buildAuthUrl(state));
}
