import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { listsCollection, listAccessFilter, toList, isDateString } from "@/lib/tasks";
import { aiParseTask } from "@/lib/ai";

/**
 * AI-assisted capture parsing via Ollama cloud.
 * Returns 502 on any AI failure — the client falls back to the local parser.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { text?: unknown; today?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.text !== "string" || !body.text.trim()) return badRequest("text required");
  const today = isDateString(body.today) ? body.today : new Date().toISOString().slice(0, 10);

  const lists = await listsCollection();
  // Locked lists stay out of the AI prompt entirely — their names are private.
  const userLists = (
    await lists.find(listAccessFilter(new ObjectId(session.userId))).sort({ order: 1 }).toArray()
  )
    .map((d) => toList(d, session.userId))
    .filter((l) => !l.locked);

  const parsed = await aiParseTask(body.text, today, userLists);
  if (!parsed) {
    return NextResponse.json({ error: "AI parse unavailable" }, { status: 502 });
  }
  return NextResponse.json({ parsed });
}
