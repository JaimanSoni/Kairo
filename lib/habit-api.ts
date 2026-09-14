import { NextResponse } from "next/server";
import { badRequest } from "./api-auth";
import { HabitInputError, isHabitToday } from "./habits";

/** The local day a garden request is about, from `?today=` or the body. */
export function todayFrom(value: unknown): string | null {
  return isHabitToday(value) ? value : null;
}

export const needToday = () => badRequest("today must be your local date, YYYY-MM-DD");

/** A refused input becomes a 400 with the sentence that explains it; anything else is a real error. */
export function habitFailure(err: unknown): NextResponse {
  if (err instanceof HabitInputError) return badRequest(err.message);
  throw err;
}

export async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
