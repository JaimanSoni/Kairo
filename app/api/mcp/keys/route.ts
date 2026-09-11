import { NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { createApiKey, listApiKeys, type ApiKeyScope } from "@/lib/api-keys";
import { isValidTimeZone } from "@/lib/tz";

/**
 * Connection keys, from the settings sheet.
 *
 * Session-authenticated, deliberately: a connection key must never be able to
 * mint another connection key. Losing one would otherwise mean losing the
 * account, because the thief could keep issuing themselves fresh credentials
 * after the original was revoked.
 */

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();
  return NextResponse.json({ keys: await listApiKeys(session.userId) });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { name?: unknown; scope?: unknown; includeLocked?: unknown; includeJournal?: unknown; timezone?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 60) {
    return badRequest("Give the connection a name, so you know which one to revoke later");
  }
  const scope: ApiKeyScope = body.scope === "read" ? "read" : "write";
  const includeLocked = body.includeLocked === true;
  // the journal is never reachable by accident: only an explicit true opens it
  const includeJournal = body.includeJournal === true;

  // The browser knows the zone; the server's clock is UTC and would file an
  // evening capture under tomorrow for anyone east of Greenwich.
  if (!isValidTimeZone(body.timezone)) {
    return badRequest("A valid IANA time zone is required");
  }

  const created = await createApiKey({
    userIdHex: session.userId,
    name: body.name,
    scope,
    includeLocked,
    includeJournal,
    timezone: body.timezone,
  });
  if (!created.ok) return badRequest(created.error);

  // The only time the key itself is ever sent anywhere.
  return NextResponse.json({ key: created.key, info: created.info }, { status: 201 });
}
