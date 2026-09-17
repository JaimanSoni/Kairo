import { NextResponse } from "next/server";
import { requireSession, unauthorized, badRequest } from "@/lib/api-auth";
import { linkPreview } from "@/lib/link-preview";
import { hitLimit } from "@/lib/rate-limit";

/**
 * What a pasted link looks like: its title, a line about it, and a picture,
 * read from the page itself and kept for a week.
 *
 * Signed in only, and capped per account: this is the one place in Kairo
 * where someone else chooses an address our server fetches.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const url = new URL(request.url).searchParams.get("url");
  if (!url) return badRequest("url is required");

  const limit = await hitLimit(`link-preview:${session.userId}`, 60, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "That is a lot of links at once. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  const preview = await linkPreview(url);
  if (!preview) return badRequest("That link can't be previewed");
  return NextResponse.json({ preview }, { headers: { "Cache-Control": "private, max-age=600" } });
}
