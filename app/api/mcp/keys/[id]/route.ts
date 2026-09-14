import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { revokeApiKey, updateApiKey, type ApiKeyScope } from "@/lib/api-keys";
import { isValidTimeZone } from "@/lib/tz";
import { journalGate, journalStampOf } from "@/lib/journal-lock";
import { lockedListIds } from "@/lib/tasks";

/** Rename a connection, or change what it may reach. What a PIN protects takes the PIN, here as at creation. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/mcp/keys/[id]">) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  let body: {
    name?: unknown;
    scope?: unknown;
    includeLocked?: unknown;
    includeJournal?: unknown;
    includeNotes?: unknown;
    includeHabits?: unknown;
    timezone?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const patch: {
    name?: string;
    scope?: ApiKeyScope;
    includeLocked?: boolean;
    includeJournal?: boolean;
    includeNotes?: boolean;
    includeHabits?: boolean;
    journalStamp?: string;
    timezone?: string;
  } = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 60) {
      return badRequest("Invalid name");
    }
    patch.name = body.name;
  }
  if ("scope" in body) {
    if (body.scope !== "read" && body.scope !== "write") return badRequest("Invalid scope");
    patch.scope = body.scope;
  }
  if ("includeLocked" in body) {
    if (typeof body.includeLocked !== "boolean") return badRequest("Invalid includeLocked");
    if (body.includeLocked && (await lockedListIds(new ObjectId(session.userId))).length > 0) {
      return pinFirst("Unlock your locked lists first, then give them to a connection.");
    }
    patch.includeLocked = body.includeLocked;
  }
  if ("includeJournal" in body) {
    if (typeof body.includeJournal !== "boolean") return badRequest("Invalid includeJournal");
    if (body.includeJournal) {
      const gate = await journalGate(session.userId);
      if (!gate.ok) return pinFirst("Open your journal with its PIN first, then give it to a connection.");
      patch.journalStamp = journalStampOf(gate.user);
    }
    patch.includeJournal = body.includeJournal;
  }
  if ("includeNotes" in body) {
    if (typeof body.includeNotes !== "boolean") return badRequest("Invalid includeNotes");
    patch.includeNotes = body.includeNotes;
  }
  if ("includeHabits" in body) {
    if (typeof body.includeHabits !== "boolean") return badRequest("Invalid includeHabits");
    patch.includeHabits = body.includeHabits;
  }
  if ("timezone" in body) {
    if (!isValidTimeZone(body.timezone)) return badRequest("Invalid time zone");
    patch.timezone = body.timezone;
  }
  if (Object.keys(patch).length === 0) return badRequest("No valid fields");

  const updated = await updateApiKey(session.userId, id, patch);
  if (!updated) return notFound();
  return NextResponse.json({ info: updated });
}

/**
 * Revoking is immediate: the next call made with this key fails to find it,
 * whichever assistant still holds it. Nothing is cached on the way in. Open to
 * a lapsed account too: a key must always be revocable.
 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/mcp/keys/[id]">) {
  const session = await requireSession({ expired: "allow" });
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const revoked = await revokeApiKey(session.userId, id);
  if (!revoked) return notFound();
  return NextResponse.json({ ok: true });
}

function pinFirst(error: string) {
  return NextResponse.json({ error, locked: true }, { status: 423 });
}
