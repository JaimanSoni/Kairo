import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { bustUserGate, getUserById } from "@/lib/users";
import { PIN_RE, hashPin, makeSalt, verifyPin } from "@/lib/pin";
import { requireFeature } from "@/lib/entitlements";
import { clearApp, grantApp } from "@/lib/lock-grants";
import { claimPinAttempt, clearPinAttempts, wrongPinPause } from "@/lib/rate-limit";

const attemptsKey = (userId: string) => `app:${userId}`;

function tooMany(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many tries. Take a breath and try again shortly.", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

/** Set or change the app-wide PIN. Changing requires the current PIN. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  // Only setting a whole-app PIN is gated. Locking an individual list is on
  // every plan, and an existing app lock keeps working — see DELETE below,
  // which stays open so nobody can be locked out of their own app by a
  // downgrade.
  const gate = await requireFeature(session.userId, "app-lock");
  if (gate) return gate;

  let body: { pin?: unknown; currentPin?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.pin !== "string" || !PIN_RE.test(body.pin)) {
    return badRequest("PIN must be 4–8 digits");
  }

  const user = await getUserById(session.userId);
  if (!user) return unauthorized();

  if (user.appLockHash && user.appLockSalt) {
    const claim = await claimPinAttempt(attemptsKey(session.userId));
    if (!claim.ok) return tooMany(claim.retryAfter);
    if (typeof body.currentPin !== "string" || !verifyPin(body.currentPin, user.appLockSalt, user.appLockHash)) {
      await wrongPinPause();
      return NextResponse.json({ error: "Wrong PIN" }, { status: 403 });
    }
    await clearPinAttempts(attemptsKey(session.userId));
  }

  const salt = makeSalt();
  const hash = hashPin(body.pin, salt);
  const db = await getDb();
  await db.collection("users").updateOne({ _id: new ObjectId(session.userId) }, { $set: { appLockSalt: salt, appLockHash: hash } });
  bustUserGate(session.userId);
  // this browser set the PIN, so it stays open; every other one locks, because
  // its unlock was earned with a PIN that no longer exists
  await grantApp(session.userId, hash);
  return NextResponse.json({ enabled: true });
}

/** Remove the app lock — requires the current PIN. */
export async function DELETE(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { pin?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const user = await getUserById(session.userId);
  if (!user) return unauthorized();
  if (!user.appLockHash || !user.appLockSalt) return badRequest("App lock is not set");

  const claim = await claimPinAttempt(attemptsKey(session.userId));
  if (!claim.ok) return tooMany(claim.retryAfter);
  if (typeof body.pin !== "string" || !verifyPin(body.pin, user.appLockSalt, user.appLockHash)) {
    await wrongPinPause();
    return NextResponse.json({ error: "Wrong PIN" }, { status: 403 });
  }
  await clearPinAttempts(attemptsKey(session.userId));

  const db = await getDb();
  await db.collection("users").updateOne({ _id: new ObjectId(session.userId) }, { $unset: { appLockHash: "", appLockSalt: "" } });
  bustUserGate(session.userId);
  await clearApp(session.userId);
  return NextResponse.json({ enabled: false });
}
