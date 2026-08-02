import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { resolveMagicToken } from "@/lib/invites";
import { activatePendingUser, type DbUser } from "@/lib/users";
import { addAccountSession, getSessionData } from "@/lib/session";
import { originFromRequest } from "@/lib/google";

/**
 * Sign-in by magic link, from an invite email.
 *
 * The token resolves to an email address, never directly to an account: the
 * account is looked up fresh on every click, so deactivation and deletion
 * are honoured even for a link minted before either happened. First click on
 * a pending account is its real arrival — that is when the trial starts.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = originFromRequest(request);
  const token = url.searchParams.get("token") ?? "";

  try {
    const email = await resolveMagicToken(token);
    if (!email) {
      return NextResponse.redirect(`${origin}/?auth_error=link_expired`);
    }

    const db = await getDb();
    let user = await db.collection<DbUser>("users").findOne({ email });
    if (!user) {
      // the send succeeded but the account never got written — vanishingly
      // rare, and the honest answer is the same as an expired link
      return NextResponse.redirect(`${origin}/?auth_error=link_expired`);
    }
    if (user.disabled) {
      return NextResponse.redirect(`${origin}/?auth_error=deactivated`);
    }

    // A signed-in browser must never have a NEW account injected into it by
    // following a link: that is login CSRF — an attacker could mail out a
    // magic link for an account they control and quietly become the active
    // account of anyone who clicks it. A magic link signs in on a
    // signed-out browser, or re-selects an account already on the roster;
    // it never adds one.
    const userId = user._id.toHexString();
    const existing = await getSessionData();
    if (existing && !existing.accounts.some((a) => a.userId === userId)) {
      return NextResponse.redirect(`${origin}/?auth_error=signout_first`);
    }

    if (user.pending) {
      user = await activatePendingUser(user);
    } else {
      await db
        .collection("users")
        .updateOne({ _id: new ObjectId(user._id) }, { $set: { lastLoginAt: new Date() } });
    }

    await addAccountSession({
      userId,
      email: user.email,
      name: user.name,
      picture: user.picture,
    });
    return NextResponse.redirect(`${origin}/today`);
  } catch (err) {
    console.error("Magic link sign-in failed:", err);
    return NextResponse.redirect(`${origin}/?auth_error=auth_failed`);
  }
}
