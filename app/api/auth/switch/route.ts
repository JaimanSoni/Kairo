import { NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { switchAccountSession } from "@/lib/session";

/** Switches the active account to another signed-in roster account. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { userId?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.userId !== "string" || !body.userId) return badRequest("userId required");

  const ok = await switchAccountSession(body.userId);
  if (!ok) return badRequest("That account isn't signed in here");
  return NextResponse.json({ ok: true });
}
