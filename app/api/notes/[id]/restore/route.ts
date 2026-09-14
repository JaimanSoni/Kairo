import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { restoreNote } from "@/lib/notes";

/** Brings a page back from the trash, with the sub-pages that went with it. */
export async function POST(_request: Request, ctx: RouteContext<"/api/notes/[id]/restore">) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const result = await restoreNote(new ObjectId(session.userId), id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ pages: result.pages });
}
