import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { duplicateNote } from "@/lib/notes";

/** A copy of a page and its sub-pages, right after the original. */
export async function POST(_request: Request, ctx: RouteContext<"/api/notes/[id]/duplicate">) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const result = await duplicateNote(new ObjectId(session.userId), id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ page: result.root, pages: result.pages }, { status: 201 });
}
