import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { leaveCity } from "@/lib/city";
import { getGardener } from "@/lib/habits";

/**
 * Takes your garden off Kairo City's streets. Your habits, friends and name
 * stay, so claiming your plot again puts it straight back.
 */
export async function POST() {
  const session = await requireSession();
  if (!session) return unauthorized();
  const userId = new ObjectId(session.userId);
  await leaveCity(userId);
  return NextResponse.json({ gardener: await getGardener(userId) });
}
