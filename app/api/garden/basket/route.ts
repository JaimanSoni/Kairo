import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { basket } from "@/lib/habits";

/** Every fruit you've picked, newest first. */
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();
  return NextResponse.json({ harvests: await basket(new ObjectId(session.userId)) });
}
