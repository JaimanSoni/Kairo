import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { createNote, listTree } from "@/lib/notes";
import { NOTE_DOC_MAX_BYTES, NoteContentError } from "@/lib/notes-shared";

/** The whole tree: every live page, without bodies. */
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();
  return NextResponse.json({ pages: await listTree(new ObjectId(session.userId)) });
}

/** A new page — at the top level, or under a parent, optionally right after a sibling. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const raw = await request.text();
  if (raw.length > NOTE_DOC_MAX_BYTES + 8_000) return badRequest("That page is too long to save in one piece.");
  let body: { parentId?: unknown; afterId?: unknown; title?: unknown; icon?: unknown; cover?: unknown; doc?: unknown };
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return badRequest("Invalid JSON");
  }

  try {
    const result = await createNote(new ObjectId(session.userId), body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ page: result.page }, { status: 201 });
  } catch (err) {
    if (err instanceof NoteContentError) return badRequest(err.message);
    throw err;
  }
}
