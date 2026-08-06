import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, badRequest } from "@/lib/api-auth";
import { listsCollection, listAccessFilter, toList, isDateString } from "@/lib/tasks";
import { aiParseTasks } from "@/lib/ai";
import { requireFeature } from "@/lib/entitlements";
import { allowGuestParse, refundGuestParse } from "@/lib/guest-ai";
import type { List } from "@/lib/types";

/**
 * AI-assisted capture parsing via Gemma. One capture can contain several
 * tasks ("call the bank and hit the gym"), so `parsed` is an array.
 * Returns 502 on any AI failure — the client falls back to the local parser.
 *
 * Guests (no session) get 3 free runs, counted server-side per IP per day;
 * their responses carry `guestRunsLeft` so the client can say what remains.
 */
export async function POST(request: Request) {
  const session = await requireSession();

  let body: { text?: unknown; today?: unknown; time?: unknown; lists?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.text !== "string" || !body.text.trim()) return badRequest("text required");
  const today = isDateString(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  // the user's local clock; the server's own clock is UTC and would mislead
  const time =
    typeof body.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)
      ? body.time
      : "12:00";

  /* ------------------------------------------------------------- guest lane */
  if (!session) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const gate = await allowGuestParse(ip);
    if (!gate.allowed) {
      return NextResponse.json(
        { error: "Free AI captures used", guestRunsLeft: 0 },
        { status: 429 }
      );
    }

    // a guest's lists exist only in their browser, so the names arrive with
    // the request — used for filing suggestions and nothing else
    const rawLists = Array.isArray(body.lists) ? body.lists.slice(0, 20) : [];
    const guestLists = rawLists
      .filter(
        (l): l is { id: string; name: string } =>
          typeof l === "object" && l !== null &&
          typeof (l as { id?: unknown }).id === "string" &&
          typeof (l as { name?: unknown }).name === "string"
      )
      .map(
        (l): List => ({
          id: l.id.slice(0, 64),
          name: l.name.slice(0, 40),
          emoji: "",
          order: 0,
          locked: false,
          role: "owner",
          memberCount: 0,
        })
      );

    const parsed = await aiParseTasks(body.text, today, time, guestLists);
    if (!parsed) {
      // a failed parse must not burn a free run
      await refundGuestParse(ip);
      return NextResponse.json({ error: "AI parse unavailable" }, { status: 502 });
    }
    return NextResponse.json({ parsed, guestRunsLeft: gate.left });
  }

  /* ------------------------------------------------------------ signed in */
  // Not on every plan. The client already falls back to the local parser on a
  // non-200, so a Lite account still captures — it just doesn't get the tidying.
  const gate = await requireFeature(session.userId, "ai-capture");
  if (gate) return gate;

  const lists = await listsCollection();
  // Locked lists stay out of the AI prompt entirely — their names are private.
  const userLists = (
    await lists.find(listAccessFilter(new ObjectId(session.userId))).sort({ order: 1 }).toArray()
  )
    .map((d) => toList(d, session.userId))
    .filter((l) => !l.locked);

  const parsed = await aiParseTasks(body.text, today, time, userLists);
  if (!parsed) {
    return NextResponse.json({ error: "AI parse unavailable" }, { status: 502 });
  }
  return NextResponse.json({ parsed });
}
