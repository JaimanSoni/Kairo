import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { hitLimit } from "@/lib/rate-limit";
import { kmBetween, liveSky, validPlace } from "@/lib/weather";

/** Vercel writes the city name URL-encoded ("S%C3%A3o%20Paulo"). */
function header(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim().slice(0, 80) || null;
  } catch {
    return null;
  }
}

/**
 * The sky over your garden, this hour: `{ weather }`, or `{ weather: null }`
 * when we can't tell where you are.
 *
 * Where you are is your connection's town (from the address it comes from),
 * or `?lat=&lon=` when this device shared its location. Either way it is
 * rounded to about 10 km before it goes anywhere, and nothing is kept
 * against your account.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const limit = await hitLimit(`weather:${session.userId}`, 40, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many weather checks. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  const params = new URL(request.url).searchParams;
  const h = request.headers;
  const connection = validPlace(h.get("x-vercel-ip-latitude"), h.get("x-vercel-ip-longitude"));
  const town = header(h.get("x-vercel-ip-city"));
  const country = header(h.get("x-vercel-ip-country"));
  const shared = validPlace(params.get("lat"), params.get("lon"));

  const place = shared ?? connection;
  if (!place) return NextResponse.json({ weather: null, connection: null });
  // a shared location keeps the town's name only when it is plainly the same town
  const name = shared ? (connection && town && kmBetween(shared, connection) <= 40 ? town : null) : town;
  const weather = await liveSky(place, { name, country });
  return NextResponse.json({ weather, connection: connection ? town : null }, { headers: { "Cache-Control": "private, no-store" } });
}
