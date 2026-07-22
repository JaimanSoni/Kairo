import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./session";

export async function requireSession(): Promise<SessionPayload | null> {
  return getSession();
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message = "Bad request"): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
