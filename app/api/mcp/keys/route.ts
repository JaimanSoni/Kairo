import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { createApiKey, listApiKeys, type ApiKeyScope } from "@/lib/api-keys";
import { isValidTimeZone } from "@/lib/tz";
import { getUserById } from "@/lib/users";
import { journalGate, journalStampOf } from "@/lib/journal-lock";
import { lockedListIds } from "@/lib/tasks";

/**
 * Connection keys, from the settings sheet.
 *
 * Session-authenticated, deliberately: a connection key must never be able to
 * mint another connection key. Losing one would otherwise mean losing the
 * account, because the thief could keep issuing themselves fresh credentials
 * after the original was revoked.
 *
 * A session isn't enough to hand a key what a PIN protects, though. Giving a
 * key the journal takes a browser that has the journal open; giving it locked
 * lists takes a browser that has every locked list open. Otherwise anyone at
 * an unlocked laptop could read past a PIN by making a key for themselves.
 */

export async function GET() {
  // listing and revoking stay open to a lapsed account: a key must always be revocable
  const session = await requireSession({ expired: "allow" });
  if (!session) return unauthorized();
  const user = await getUserById(session.userId);
  return NextResponse.json({ keys: await listApiKeys(session.userId, journalStampOf(user)) });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

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

  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 60) {
    return badRequest("Give the connection a name, so you know which one to revoke later");
  }
  const scope: ApiKeyScope = body.scope === "read" ? "read" : "write";
  const includeLocked = body.includeLocked === true;
  // the journal is never reachable by accident: only an explicit true opens it
  const includeJournal = body.includeJournal === true;
  // notes and the garden too: an existing assistant never gains a new kind of access by itself
  const includeNotes = body.includeNotes === true;
  const includeHabits = body.includeHabits === true;

  // The browser knows the zone; the server's clock is UTC and would file an
  // evening capture under tomorrow for anyone east of Greenwich.
  if (!isValidTimeZone(body.timezone)) {
    return badRequest("A valid IANA time zone is required");
  }

  let journalStamp: string | undefined;
  if (includeJournal) {
    const gate = await journalGate(session.userId);
    if (!gate.ok) return pinFirst("Open your journal with its PIN first, then give it to a connection.");
    journalStamp = journalStampOf(gate.user);
  }
  if (includeLocked && (await lockedListIds(new ObjectId(session.userId))).length > 0) {
    return pinFirst("Unlock your locked lists first, then give them to a connection.");
  }

  const created = await createApiKey({
    userIdHex: session.userId,
    name: body.name,
    scope,
    includeLocked,
    includeJournal,
    includeNotes,
    includeHabits,
    journalStamp,
    timezone: body.timezone,
  });
  if (!created.ok) return badRequest(created.error);

  // The only time the key itself is ever sent anywhere.
  return NextResponse.json({ key: created.key, info: created.info }, { status: 201 });
}

function pinFirst(error: string) {
  return NextResponse.json({ error, locked: true }, { status: 423 });
}
