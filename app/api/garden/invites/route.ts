import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { createInvite, InviteRefused, sentInviteEmails } from "@/lib/city";
import { habitFailure } from "@/lib/habit-api";

/** The addresses you've sent plots to before: suggestions for the next invite. */
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();
  return NextResponse.json({ sent: await sentInviteEmails(new ObjectId(session.userId)) });
}

/** Saves a free plot beside your garden for a friend, and hands back its code. */
export async function POST() {
  const session = await requireSession();
  if (!session) return unauthorized();
  try {
    return NextResponse.json(await createInvite(new ObjectId(session.userId)), { status: 201 });
  } catch (err) {
    if (err instanceof InviteRefused) return NextResponse.json({ error: err.message }, { status: 403 });
    return habitFailure(err);
  }
}
