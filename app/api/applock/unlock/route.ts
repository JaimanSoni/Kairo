import { NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { getUserById } from "@/lib/users";
import { verifyPin } from "@/lib/pin";
import { clearApp, grantApp } from "@/lib/lock-grants";
import { claimPinAttempt, clearPinAttempts, wrongPinPause } from "@/lib/rate-limit";

/**
 * Enter the app-lock PIN. On success this browser is given a grant, and every
 * other route starts answering again. The only route that works while locked.
 */
export async function POST(request: Request) {
  const session = await requireSession({ locked: "allow", expired: "allow" });
  if (!session) return unauthorized();

  let body: { pin?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.pin !== "string") return badRequest("pin required");

  const user = await getUserById(session.userId);
  if (!user) return unauthorized();
  if (!user.appLockHash || !user.appLockSalt) return badRequest("App lock is not set");

  const key = `app:${session.userId}`;
  const claim = await claimPinAttempt(key);
  if (!claim.ok) {
    return NextResponse.json(
      { error: "Too many tries. Take a breath and try again shortly.", retryAfter: claim.retryAfter },
      { status: 429, headers: { "Retry-After": String(claim.retryAfter) } }
    );
  }
  if (!verifyPin(body.pin, user.appLockSalt, user.appLockHash)) {
    await wrongPinPause();
    return NextResponse.json({ error: "Wrong PIN" }, { status: 403 });
  }
  await clearPinAttempts(key);
  await grantApp(session.userId, user.appLockHash);
  return NextResponse.json({ ok: true });
}

/** Lock now: this browser gives its grant back. */
export async function DELETE() {
  const session = await requireSession({ locked: "allow", expired: "allow" });
  if (!session) return unauthorized();
  await clearApp(session.userId);
  return NextResponse.json({ ok: true });
}
