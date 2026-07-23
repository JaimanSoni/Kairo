import { NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { getUserById } from "@/lib/users";
import { verifyPin } from "@/lib/pin";

const FAIL_DELAY_MS = 400;

/** Verify the app-lock PIN. The client opens the gate for this session. */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: { pin?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  if (typeof body.pin !== "string") return badRequest("pin required");

  const user = await getUserById(session.userId);
  if (!user) return unauthorized();
  if (!user.appLockHash || !user.appLockSalt) return badRequest("App lock is not set");

  if (!verifyPin(body.pin, user.appLockSalt, user.appLockHash)) {
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return NextResponse.json({ error: "Wrong PIN" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
