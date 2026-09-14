import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { deleteNoteForever, getNote, hideLockedChips, saveNoteDoc, trashNote, updateNoteMeta } from "@/lib/notes";
import { lockedListIds } from "@/lib/tasks";
import {
  NOTE_DOC_MAX_BYTES,
  NOTE_FONTS,
  NoteContentError,
  type NoteFont,
  type NoteMetaPatch,
} from "@/lib/notes-shared";

type Ctx = RouteContext<"/api/notes/[id]">;

/** One page, whole, with the pages that link to it. */
export async function GET(_request: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const userId = new ObjectId(session.userId);
  const found = await getNote(userId, id);
  if (!found) return notFound();
  const [page] = await hideLockedChips([found.page], await lockedListIds(userId));
  return NextResponse.json({ ...found, page });
}

/**
 * Saves a page's body. The body names the version the writer started from; if
 * the page has moved on since, nothing is written and the answer is 409 with
 * the page as it now stands.
 */
export async function PUT(request: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const raw = await request.text();
  if (raw.length > NOTE_DOC_MAX_BYTES + 8_000) return badRequest("That page is too long to save in one piece.");
  let body: { doc?: unknown; baseVersion?: unknown; allowEmpty?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.baseVersion !== "number" || !Number.isInteger(body.baseVersion) || body.baseVersion < 1) {
    return badRequest("baseVersion must be a whole number");
  }

  try {
    const result = await saveNoteDoc(new ObjectId(session.userId), id, body.doc, body.baseVersion, body.allowEmpty === true);
    if (result.ok) return NextResponse.json({ page: result.page });
    switch (result.reason) {
      case "missing":
        return notFound();
      case "trashed":
        return NextResponse.json({ error: "That page is in the trash. Restore it to keep writing." }, { status: 410 });
      case "locked":
        return NextResponse.json({ error: "That page is locked. Unlock it to keep writing." }, { status: 423 });
      case "empty":
        return badRequest("That save would empty the page. If that's what you meant, clear it again.");
      case "conflict": {
        const current = result.current
          ? (await hideLockedChips([result.current], await lockedListIds(new ObjectId(session.userId))))[0]
          : result.current;
        return NextResponse.json({ error: "This page changed somewhere else.", current }, { status: 409 });
      }
    }
  } catch (err) {
    if (err instanceof NoteContentError) return badRequest(err.message);
    throw err;
  }
}

/** Title, icon, cover and page settings — last writer wins, no version needed. */
export async function PATCH(request: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return badRequest("Invalid body");

  const patch: NoteMetaPatch = {};
  if ("title" in body) {
    if (typeof body.title !== "string" || body.title.length > 1000) return badRequest("Invalid title");
    patch.title = body.title;
  }
  if ("icon" in body) {
    if (body.icon !== null && typeof body.icon !== "string") return badRequest("Invalid icon");
    patch.icon = body.icon as string | null;
  }
  if ("cover" in body) {
    if (body.cover !== null && typeof body.cover !== "string") return badRequest("Invalid cover");
    patch.cover = body.cover as string | null;
  }
  for (const key of ["favorite", "fullWidth", "smallText", "locked"] as const) {
    if (key in body) {
      if (typeof body[key] !== "boolean") return badRequest(`Invalid ${key}`);
      patch[key] = body[key] as boolean;
    }
  }
  if ("font" in body) {
    if (!NOTE_FONTS.includes(body.font as NoteFont)) return badRequest("Invalid font");
    patch.font = body.font as NoteFont;
  }
  if (Object.keys(patch).length === 0) return badRequest("No valid fields");

  const result = await updateNoteMeta(new ObjectId(session.userId), id, patch);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ page: result.page });
}

/** Moves a page and its sub-pages to the trash — or, with ?forever=1, deletes a trashed page for good. */
export async function DELETE(request: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const userId = new ObjectId(session.userId);

  if (new URL(request.url).searchParams.get("forever") === "1") {
    const result = await deleteNoteForever(userId, id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ deleted: result.deleted });
  }
  const result = await trashNote(userId, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ trashed: result.ids });
}
