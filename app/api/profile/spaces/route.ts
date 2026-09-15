import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { bustUserGate } from "@/lib/users";

/**
 * Which of the optional places this account keeps: the journal, notes and the
 * garden. Hiding one tidies it out of the app; nothing in it is touched, and
 * its pages still open from a link. `welcomed` answers the first-run welcome.
 */
export async function PUT(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { journal?: unknown; notes?: unknown; garden?: unknown; welcomed?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const keys = ["journal", "notes", "garden"] as const;
  if (!keys.every((k) => typeof body[k] === "boolean")) return badRequest("journal, notes and garden must each be true or false");
  if (body.welcomed !== undefined && typeof body.welcomed !== "boolean") return badRequest("welcomed must be true or false");

  const spaces = { journal: body.journal as boolean, notes: body.notes as boolean, garden: body.garden as boolean };
  const db = await getDb();
  await db.collection("users").updateOne(
    { _id: new ObjectId(session.userId) },
    { $set: { spaces, ...(body.welcomed ? { welcomedAt: new Date() } : {}) } }
  );
  bustUserGate(session.userId);
  return NextResponse.json({ spaces });
}
