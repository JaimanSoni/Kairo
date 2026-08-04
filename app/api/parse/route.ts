import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { listsCollection, listAccessFilter, toList, isDateString } from "@/lib/tasks";
import { aiParseTasks } from "@/lib/ai";
import { requireFeature } from "@/lib/entitlements";

/**
 * AI-assisted capture parsing via Gemma. One capture can contain several
 * tasks ("call the bank and hit the gym"), so `parsed` is an array.
 * Returns 502 on any AI failure — the client falls back to the local parser.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  // Not on every plan. The client already falls back to the local parser on a
  // non-200, so a Lite account still captures — it just doesn't get the tidying.
  const gate = await requireFeature(session.userId, "ai-capture");
  if (gate) return gate;

  let body: { text?: unknown; today?: unknown; time?: unknown };
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
