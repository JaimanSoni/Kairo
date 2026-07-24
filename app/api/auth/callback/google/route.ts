import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, originFromRequest } from "@/lib/google";
import { upsertGoogleUser } from "@/lib/users";
import { addAccountSession } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // stay on whatever domain the flow started on (matches the redirect_uri)
  const origin = originFromRequest(request);

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("kairo_oauth_state")?.value;
  cookieStore.delete("kairo_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/?auth_error=state_mismatch`);
  }

  try {
    const profile = await exchangeCode(code, origin);
    const user = await upsertGoogleUser(profile);
    await addAccountSession({
      userId: user._id.toHexString(),
      email: user.email,
      name: user.name,
      picture: user.picture,
    });
    return NextResponse.redirect(`${origin}/today`);
  } catch (err) {
    console.error("Google auth callback failed:", err);
    return NextResponse.redirect(`${origin}/?auth_error=auth_failed`);
  }
}
