import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/users";
import { isAdminEmail } from "@/lib/admin";
import { setComped } from "@/lib/billing";

/** Puts an existing account on the free list, or takes it off again. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const me = await getUserById(session.userId);
  if (!me || !isAdminEmail(me.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { userId?: unknown; comped?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.userId !== "string" || !ObjectId.isValid(body.userId)) {
    return NextResponse.json({ error: "Valid userId required" }, { status: 400 });
  }
  if (typeof body.comped !== "boolean") {
    return NextResponse.json({ error: "comped must be a boolean" }, { status: 400 });
  }

  const target = await getUserById(body.userId);
  if (!target) return NextResponse.json({ error: "No such user" }, { status: 404 });

  const note = typeof body.note === "string" ? body.note.slice(0, 200) : "";
  await setComped(body.userId, body.comped, note);
  console.info("[billing] %s free access for %s (by %s)", body.comped ? "granted" : "revoked", target.email, me.email);
  return NextResponse.json({ ok: true, userId: body.userId, comped: body.comped, note });
}
