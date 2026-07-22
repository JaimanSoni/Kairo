import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode } from "@/lib/google";
import { upsertGoogleUser } from "@/lib/users";
import { createSession } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("kairo_oauth_state")?.value;
  cookieStore.delete("kairo_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth_error=state_mismatch", request.url));
  }

  try {
    const profile = await exchangeCode(code);
    const user = await upsertGoogleUser(profile);
    await createSession({
      userId: user._id.toHexString(),
      email: user.email,
      name: user.name,
      picture: user.picture,
    });
    return NextResponse.redirect(new URL("/today", request.url));
  } catch (err) {
    console.error("Google auth callback failed:", err);
    return NextResponse.redirect(new URL("/?auth_error=auth_failed", request.url));
  }
}
