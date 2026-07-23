import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { getUserById } from "@/lib/users";
import { PIN_RE, hashPin, makeSalt, verifyPin } from "@/lib/pin";

const FAIL_DELAY_MS = 400;

/** Set or change the app-wide PIN. Changing requires the current PIN. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

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
    if (
      typeof body.currentPin !== "string" ||
      !verifyPin(body.currentPin, user.appLockSalt, user.appLockHash)
    ) {
      await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
      return NextResponse.json({ error: "Wrong PIN" }, { status: 403 });
    }
  }

  const salt = makeSalt();
  const db = await getDb();
  await db.collection("users").updateOne(
    { _id: new ObjectId(session.userId) },
    { $set: { appLockSalt: salt, appLockHash: hashPin(body.pin, salt) } }
  );
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

  if (typeof body.pin !== "string" || !verifyPin(body.pin, user.appLockSalt, user.appLockHash)) {
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return NextResponse.json({ error: "Wrong PIN" }, { status: 403 });
  }

  const db = await getDb();
  await db.collection("users").updateOne(
    { _id: new ObjectId(session.userId) },
    { $unset: { appLockHash: "", appLockSalt: "" } }
  );
  return NextResponse.json({ enabled: false });
}
