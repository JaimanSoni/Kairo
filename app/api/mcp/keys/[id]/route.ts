import { NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest, notFound } from "@/lib/api-auth";
import { revokeApiKey, updateApiKey, type ApiKeyScope } from "@/lib/api-keys";
import { isValidTimeZone } from "@/lib/tz";

/** Rename a connection, or change what it may reach. */
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
    patch.includeLocked = body.includeLocked;
  }
  if ("includeJournal" in body) {
    if (typeof body.includeJournal !== "boolean") return badRequest("Invalid includeJournal");
    patch.includeJournal = body.includeJournal;
  }
  if ("includeNotes" in body) {
    if (typeof body.includeNotes !== "boolean") return badRequest("Invalid includeNotes");
    patch.includeNotes = body.includeNotes;
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
 * whichever assistant still holds it. Nothing is cached on the way in.
 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/mcp/keys/[id]">) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const revoked = await revokeApiKey(session.userId, id);
  if (!revoked) return notFound();
  return NextResponse.json({ ok: true });
}
