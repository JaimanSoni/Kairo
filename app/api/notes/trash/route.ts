import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { emptyTrash, listTrash } from "@/lib/notes";

/** What's in the trash. Anything older than thirty days is cleared on the way. */
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();
  return NextResponse.json({ items: await listTrash(new ObjectId(session.userId)) });
}

/** Empties the trash for good. */
export async function DELETE() {
  const session = await requireSession();
  if (!session) return unauthorized();
  return NextResponse.json({ deleted: await emptyTrash(new ObjectId(session.userId)) });
}
