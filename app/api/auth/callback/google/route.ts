import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, isSafeNext, originFromRequest } from "@/lib/google";
import { upsertGoogleUser } from "@/lib/users";
import { addAccountSession, getSessionData } from "@/lib/session";
import { hasFeature } from "@/lib/entitlements";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // stay on whatever domain the flow started on (matches the redirect_uri)
  const origin = originFromRequest(request);

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("kairo_oauth_state")?.value;
  cookieStore.delete("kairo_oauth_state");
  const next = cookieStore.get("kairo_oauth_next")?.value;
  cookieStore.delete("kairo_oauth_next");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/?auth_error=state_mismatch`);
  }

  try {
    const profile = await exchangeCode(code, origin);
    const user = await upsertGoogleUser(profile);
    const userId = user._id.toHexString();

    if (user.disabled) {
      return NextResponse.redirect(`${origin}/?auth_error=deactivated`);
    }

    // Adding a *second* account is the gated part; signing in, switching back
    // to one already on the roster, and signing in fresh are all untouched.
    // The account currently in use is the one whose plan has to allow it —
    // otherwise signing in with a Full account first would unlock the roster
    // for everyone else on the device.
    const existing = await getSessionData();
    const isNewToRoster = existing && !existing.accounts.some((a) => a.userId === userId);
    if (isNewToRoster) {
      const current = existing.accounts[existing.active];
      if (current && !(await hasFeature(current.userId, "multi-account"))) {
        return NextResponse.redirect(`${origin}/upgrade?feature=multi-account`);
      }
    }

    await addAccountSession({
      userId,
      email: user.email,
      name: user.name,
      picture: user.picture,
    });
    return NextResponse.redirect(`${origin}${next && isSafeNext(next) ? next : "/today"}`);
  } catch (err) {
    console.error("Google auth callback failed:", err);
    return NextResponse.redirect(`${origin}/?auth_error=auth_failed`);
  }
}
