import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { searchNotes } from "@/lib/notes";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.length > 100) return badRequest("Searches are limited to 100 characters");
  return NextResponse.json({ results: await searchNotes(new ObjectId(session.userId), q) });
}
