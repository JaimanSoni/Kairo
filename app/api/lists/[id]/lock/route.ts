import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { listsCollection, toList } from "@/lib/tasks";
import { PIN_RE, hashPin, makeSalt, verifyPin } from "@/lib/pin";

const FAIL_DELAY_MS = 400;

type LockDoc = {
  _id: ObjectId;
  pinHash?: string;
  pinSalt?: string;
};

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

  if (doc.pinHash && doc.pinSalt) {
    if (
      typeof body.currentPin !== "string" ||
      !verifyPin(body.currentPin, doc.pinSalt, doc.pinHash)
    ) {
      await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
      return NextResponse.json({ error: "Wrong PIN" }, { status: 403 });
    }
  }

  const salt = makeSalt();
  const updated = await lists.findOneAndUpdate(
    filter,
    { $set: { pinSalt: salt, pinHash: hashPin(body.pin, salt) } },
    { returnDocument: "after" }
  );
  if (!updated) return notFound();
  return NextResponse.json({ list: toList(updated, session.userId) });
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

  if (typeof body.pin !== "string" || !verifyPin(body.pin, doc.pinSalt, doc.pinHash)) {
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return NextResponse.json({ error: "Wrong PIN" }, { status: 403 });
  }

  const updated = await lists.findOneAndUpdate(
    filter,
    { $unset: { pinHash: "", pinSalt: "" } },
    { returnDocument: "after" }
  );
  if (!updated) return notFound();
  return NextResponse.json({ list: toList(updated, session.userId) });
}
