import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { journalGate } from "@/lib/journal-lock";
import { deleteEntry, getEntry, saveEntry } from "@/lib/journal";
import {
  DOC_MAX_BYTES,
  isJournalDate,
  isMood,
  JournalContentError,
  utcTomorrow,
} from "@/lib/journal-shared";

type Ctx = RouteContext<"/api/journal/[date]">;

async function dayFrom(ctx: Ctx): Promise<string | null> {
  const { date } = await ctx.params;
  return isJournalDate(date, utcTomorrow()) ? date : null;
}

/** One page, whole. `entry` is null for a day nothing has been written on. */
export async function GET(_request: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const date = await dayFrom(ctx);
  if (!date) return badRequest("Invalid date");

  const gate = await journalGate(session.userId);
  if (!gate.ok) return gate.response;

  return NextResponse.json({ entry: await getEntry(new ObjectId(session.userId), date) });
}

/**
 * Saves a page. The body names the version the writer started from; if the
 * page has moved on since, nothing is written and the answer is 409 with the
 * page as it now stands, so the editor can offer a choice instead of guessing.
 */
export async function PUT(request: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const date = await dayFrom(ctx);
  if (!date) return badRequest("Invalid date");

  const raw = await request.text();
  // headroom over the document limit for the title, mood and JSON framing
  if (raw.length > DOC_MAX_BYTES + 8_000) return badRequest("That page is too long to save in one piece.");

  let body: { title?: unknown; doc?: unknown; mood?: unknown; baseVersion?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.baseVersion !== "number" || !Number.isInteger(body.baseVersion) || body.baseVersion < 0) {
    return badRequest("baseVersion must be a whole number");
  }
  if (body.mood !== null && body.mood !== undefined && !isMood(body.mood)) {
    return badRequest("mood must be 1–5 or null");
  }

  const gate = await journalGate(session.userId);
  if (!gate.ok) return gate.response;

  try {
    const result = await saveEntry(
      new ObjectId(session.userId),
      date,
      { title: body.title, doc: body.doc, mood: isMood(body.mood) ? body.mood : null },
      body.baseVersion
    );
    if (!result.ok) {
      if (result.reason === "empty") {
        return badRequest("That save would erase the page. Delete the page instead.");
      }
      return NextResponse.json({ error: "This page changed somewhere else.", current: result.current }, { status: 409 });
    }
    return NextResponse.json({ entry: result.entry });
  } catch (err) {
    if (err instanceof JournalContentError) return badRequest(err.message);
    throw err;
  }
}

/** Deletes a page. `?baseVersion=` guards against deleting a newer version than the one on screen. */
export async function DELETE(request: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const date = await dayFrom(ctx);
  if (!date) return badRequest("Invalid date");

  const rawVersion = new URL(request.url).searchParams.get("baseVersion");
  const baseVersion = rawVersion === null ? null : Number(rawVersion);
  if (baseVersion !== null && (!Number.isInteger(baseVersion) || baseVersion < 1)) {
    return badRequest("baseVersion must be a whole number");
  }

  const gate = await journalGate(session.userId);
  if (!gate.ok) return gate.response;

  const result = await deleteEntry(new ObjectId(session.userId), date, baseVersion);
  if (!result.ok) {
    return NextResponse.json({ error: "This page changed somewhere else.", current: result.current }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
