import { ObjectId } from "mongodb";
import {
  findLiveApiKey,
  touchApiKey,
  KEY_PREFIX,
  type ApiKeyDoc,
  type ApiKeyScope,
} from "../api-keys";
import { getUserById, isUserDisabled } from "../users";
import { accessFor, type UserBilling } from "../billing";
import { clockIn, todayIn } from "../tz";
import { journalStampOf } from "../journal-lock";

/**
 * Everything a tool call is allowed to assume about who is asking.
 *
 * Built once per HTTP request and passed down, so no tool ever reaches for the
 * key, the request headers, or the server's own clock — the three things that
 * would let one connection's rules leak into another's.
 */
export type McpContext = {
  userId: ObjectId;
  userIdHex: string;
  email: string;
  name: string;
  /** IANA zone this connection was created in. */
  timezone: string;
  /** The user's local day, "YYYY-MM-DD" — fixed for the whole request. */
  today: string;
  /** The user's local wall clock, "HH:MM". */
  clock: string;
  scope: ApiKeyScope;
  /** Whether PIN-locked lists are in scope for this connection. */
  includeLocked: boolean;
  /** Whether journal tools exist for this connection at all. */
  includeJournal: boolean;
  /** Whether notes tools exist for this connection at all. */
  includeNotes: boolean;
  /** Whether garden tools exist for this connection at all. */
  includeHabits: boolean;
  keyName: string;
  /** Why access is allowed — surfaced by whoami so a trial is never a surprise. */
  accessReason: string;
  trialDaysLeft: number;
};

export type AuthFailure = {
  status: 401 | 402;
  error: string;
  /** Sent as WWW-Authenticate so a client can say something useful. */
  challenge?: string;
};

export type AuthResult = { ok: true; ctx: McpContext; key: ApiKeyDoc } | { ok: false } & AuthFailure;

/**
 * Three ways to present a key, because "works in any AI" is the whole point.
 *
 * A header is the right answer and the first two forms cover every client that
 * can set one. The query string is the fallback for the ones that cannot —
 * some connector UIs offer a URL and nothing else — and it is a real trade:
 * URLs end up in proxy logs and browser history in a way headers do not. It is
 * documented as such where the key is created, and revoking is one click.
 */
export function extractToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth) {
    const bearer = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (bearer) return bearer[1].trim();
  }
  const header = request.headers.get("x-api-key");
  if (header && header.trim()) return header.trim();

  try {
    const fromQuery = new URL(request.url).searchParams.get("key");
    if (fromQuery && fromQuery.trim()) return fromQuery.trim();
  } catch {
    /* an unparseable URL simply has no key in it */
  }
  return null;
}

const UNAUTHORIZED: AuthFailure = {
  status: 401,
  error: `Missing or invalid connection key. Send it as "Authorization: Bearer ${KEY_PREFIX}…", as an "X-API-Key" header, or as a "?key=" query parameter. Create one in Kairo under Settings → Connections.`,
  challenge: `Bearer realm="Kairo MCP", error="invalid_token"`,
};

export async function authenticate(request: Request): Promise<AuthResult> {
  const token = extractToken(request);
  if (!token) return { ok: false, ...UNAUTHORIZED };

  const key = await findLiveApiKey(token);
  // A revoked, mistyped or foreign key is one answer, deliberately: telling
  // the difference is telling someone which of their guesses was closer.
  if (!key) return { ok: false, ...UNAUTHORIZED };

  const userIdHex = key.userId.toHexString();
  if (await isUserDisabled(userIdHex)) {
    return { ok: false, status: 401, error: "This Kairo account is switched off." };
  }

  const user = await getUserById(userIdHex);
  if (!user) return { ok: false, ...UNAUTHORIZED };

  // The plan is enforced here for the same reason it is enforced on every
  // route: a key is a way into the product, and an expired account must not
  // find one open door left. Trial and comped accounts are allowed — MCP is
  // not sold separately.
  const access = await accessFor({
    createdAt: user.createdAt,
    billing: (user as { billing?: UserBilling }).billing,
  });
  if (!access.allowed) {
    return {
      ok: false,
      status: 402,
      error: "This Kairo account's access has ended. Renew at https://kairo.jaimansoni.com/billing to keep using connections.",
    };
  }

  touchApiKey(key);

  const now = new Date();
  return {
    ok: true,
    key,
    ctx: {
      userId: key.userId,
      userIdHex,
      email: String(user.email ?? ""),
      name: String(user.name ?? ""),
      timezone: key.timezone,
      today: todayIn(key.timezone, now),
      clock: clockIn(key.timezone, now),
      scope: key.scope,
      includeLocked: Boolean(key.includeLocked),
      // given the journal under a PIN that has since changed (or appeared): paused
      includeJournal: Boolean(key.includeJournal) && (key.journalStamp ?? "none") === journalStampOf(user),
      includeNotes: Boolean(key.includeNotes),
      includeHabits: Boolean(key.includeHabits),
      keyName: key.name,
      accessReason: access.reason,
      trialDaysLeft: access.trialDaysLeft,
    },
  };
}

export function canWrite(ctx: McpContext): boolean {
  return ctx.scope === "write";
}
