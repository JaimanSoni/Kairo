import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { listsCollection, listAccessFilter } from "@/lib/tasks";
import { verifyPin } from "@/lib/pin";
import { grantList, revokeList } from "@/lib/lock-grants";
import { claimPinAttempt, clearPinAttempts, wrongPinPause } from "@/lib/rate-limit";

/**
 * Enter a list's PIN. On success this browser holds a grant for the list, and
 * its tasks start arriving from the server (the client reloads them).
 * Members unlock with the same PIN: the hash lives on the shared list itself.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/lists/[id]/unlock">) {
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
  if (typeof body.pin !== "string") return badRequest("pin required");

  const lists = await listsCollection();
  const doc = (await lists.findOne({
    _id: new ObjectId(id),
    ...listAccessFilter(new ObjectId(session.userId)),
  })) as { pinHash?: string; pinSalt?: string } | null;
  if (!doc) return notFound();
  if (!doc.pinHash || !doc.pinSalt) return badRequest("List is not locked");

  // counted per person per list: a member guessing can't lock the owner out
  const key = `list:${id}:${session.userId}`;
  const claim = await claimPinAttempt(key);
  if (!claim.ok) {
    return NextResponse.json(
      { error: "Too many tries. Take a breath and try again shortly.", retryAfter: claim.retryAfter },
      { status: 429, headers: { "Retry-After": String(claim.retryAfter) } }
    );
  }
  if (!verifyPin(body.pin, doc.pinSalt, doc.pinHash)) {
    await wrongPinPause();
    return NextResponse.json({ error: "Wrong PIN" }, { status: 403 });
  }
  await clearPinAttempts(key);
  await grantList(session.userId, id, doc.pinHash);
  return NextResponse.json({ ok: true });
}

/** Lock it again: this browser gives its grant back. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/lists/[id]/unlock">) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return badRequest("Invalid list id");
  await revokeList(session.userId, id);
  return NextResponse.json({ ok: true });
}
