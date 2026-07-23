import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { listsCollection, listAccessFilter } from "@/lib/tasks";
import { verifyPin } from "@/lib/pin";

const FAIL_DELAY_MS = 400;

/** Verify a list's PIN. The client reveals the list for this session on success. */
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

  // members unlock with the same PIN — the hash lives on the shared list itself
  const lists = await listsCollection();
  const doc = (await lists.findOne({
    _id: new ObjectId(id),
    ...listAccessFilter(new ObjectId(session.userId)),
  })) as { pinHash?: string; pinSalt?: string } | null;
  if (!doc) return notFound();
  if (!doc.pinHash || !doc.pinSalt) return badRequest("List is not locked");

  if (!verifyPin(body.pin, doc.pinSalt, doc.pinHash)) {
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return NextResponse.json({ error: "Wrong PIN" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
