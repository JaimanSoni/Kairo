import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { listsCollection, toList } from "@/lib/tasks";
import { PIN_RE, hashPin, makeSalt, verifyPin } from "@/lib/pin";
import { grantList, revokeList } from "@/lib/lock-grants";
import { claimPinAttempt, clearPinAttempts, wrongPinPause } from "@/lib/rate-limit";

type LockDoc = {
  _id: ObjectId;
  pinHash?: string;
  pinSalt?: string;
};

const attemptsKey = (userId: string, listId: string) => `list:${listId}:${userId}`;

function tooMany(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many tries. Take a breath and try again shortly.", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

/** Set or change a list's PIN. Changing requires the current PIN. */
export async function POST(request: Request, ctx: RouteContext<"/api/lists/[id]/lock">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid list id");

  let body: { pin?: unknown; currentPin?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.pin !== "string" || !PIN_RE.test(body.pin)) {
    return badRequest("PIN must be 4–8 digits");
  }

  const lists = await listsCollection();
  const filter = { _id: new ObjectId(id), userId: new ObjectId(session.userId) };
  const doc = (await lists.findOne(filter)) as LockDoc | null;
  if (!doc) return notFound();

  const changing = Boolean(doc.pinHash && doc.pinSalt);
  if (changing) {
    const claim = await claimPinAttempt(attemptsKey(session.userId, id));
    if (!claim.ok) return tooMany(claim.retryAfter);
    if (typeof body.currentPin !== "string" || !verifyPin(body.currentPin, doc.pinSalt!, doc.pinHash!)) {
      await wrongPinPause();
      return NextResponse.json({ error: "Wrong PIN" }, { status: 403 });
    }
    await clearPinAttempts(attemptsKey(session.userId, id));
  }

  const salt = makeSalt();
  const hash = hashPin(body.pin, salt);
  const updated = await lists.findOneAndUpdate(filter, { $set: { pinSalt: salt, pinHash: hash } }, { returnDocument: "after" });
  if (!updated) return notFound();
  // A new lock starts closed, everywhere. A changed PIN keeps this browser
  // open (it just proved the old one) and closes every other.
  if (changing) await grantList(session.userId, id, hash);
  else await revokeList(session.userId, id);
  return NextResponse.json({ list: { ...toList(updated, session.userId), unlocked: changing } });
}

/** Remove the lock — requires the current PIN. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/lists/[id]/lock">) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid list id");

  let body: { pin?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const lists = await listsCollection();
  const filter = { _id: new ObjectId(id), userId: new ObjectId(session.userId) };
  const doc = (await lists.findOne(filter)) as LockDoc | null;
  if (!doc) return notFound();
  if (!doc.pinHash || !doc.pinSalt) return badRequest("List is not locked");

  const claim = await claimPinAttempt(attemptsKey(session.userId, id));
  if (!claim.ok) return tooMany(claim.retryAfter);
  if (typeof body.pin !== "string" || !verifyPin(body.pin, doc.pinSalt, doc.pinHash)) {
    await wrongPinPause();
    return NextResponse.json({ error: "Wrong PIN" }, { status: 403 });
  }
  await clearPinAttempts(attemptsKey(session.userId, id));

  const updated = await lists.findOneAndUpdate(filter, { $unset: { pinHash: "", pinSalt: "" } }, { returnDocument: "after" });
  if (!updated) return notFound();
  await revokeList(session.userId, id);
  return NextResponse.json({ list: toList(updated, session.userId) });
}
