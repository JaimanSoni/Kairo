import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { seedStats } from "@/lib/habits";

/** How many gardeners grow each seed in the catalogue, and how many watered it lately. */
export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();
  return NextResponse.json({ stats: await seedStats() });
}
