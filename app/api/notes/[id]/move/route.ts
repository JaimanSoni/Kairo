import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { moveNote } from "@/lib/notes";

/** Moves a page under another (or to the top level), before a given sibling or last. */
export async function POST(request: Request, ctx: RouteContext<"/api/notes/[id]/move">) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  let body: { parentId?: unknown; beforeId?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (!("parentId" in body)) return badRequest("parentId is required (null for the top level)");

  const result = await moveNote(new ObjectId(session.userId), id, { parentId: body.parentId, beforeId: body.beforeId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ page: result.page });
}
