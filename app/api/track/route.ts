import { getSession } from "@/lib/session";
import { recordEvent, type IngestEvent } from "@/lib/analytics";

/**
 * The event drain. Accepts anonymous beacons from anywhere on the site,
 * validates hard, enriches lightly (signed-in user id, coarse device, the
 * country Vercel already derived), stores nothing it was not sent, and
 * answers 204 no matter what: telemetry must never surface an error to the
 * person being counted.
 */

const NAME_RE = /^[a-z0-9_-]{1,40}$/;
const ID_RE = /^[a-zA-Z0-9_-]{6,64}$/;
const BOT_RE = /bot|crawl|spider|preview|lighthouse|headless|monitor/i;

const str = (x: unknown, max: number): string | undefined =>
  typeof x === "string" && x.length > 0 ? x.slice(0, max) : undefined;

/**
 * Per-instance flood brake. Serverless memory is not a real rate limiter,
 * but a hot loop hits one warm instance, and this stops it writing more
 * than a trickle to the free cluster. Honest visitors never get near it.
 */
const RATE_LIMIT = 120;
const buckets = new Map<string, { n: number; at: number }>();
function overLimit(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.at > 60_000) {
    if (buckets.size > 5_000) buckets.clear();
    buckets.set(key, { n: 1, at: now });
    return false;
  }
  b.n++;
  return b.n > RATE_LIMIT;
}

function cleanProps(x: unknown): IngestEvent["props"] {
  if (typeof x !== "object" || x === null) return undefined;
  const out: NonNullable<IngestEvent["props"]> = {};
  let n = 0;
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (n >= 12 || !NAME_RE.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 120);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else continue;
    n++;
  }
  return n > 0 ? out : undefined;
}

export async function POST(request: Request) {
  const done = new Response(null, { status: 204 });
  try {
    const ua = request.headers.get("user-agent") ?? "";
    if (BOT_RE.test(ua)) return done;
    // refuse oversized bodies before buffering them, not after
    const len = Number(request.headers.get("content-length") ?? 0);
    if (len > 4096) return done;

    const raw = await request.text();
    if (raw.length > 4096) return done;
    const body = JSON.parse(raw) as Record<string, unknown>;

    const event = str(body.e, 40);
    const vid = str(body.vid, 64);
    const sid = str(body.sid, 64);
    if (!event || !NAME_RE.test(event) || !vid || !ID_RE.test(vid) || !sid || !ID_RE.test(sid)) {
      return done;
    }
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
    if (overLimit(`${ip}:${vid}`)) return done;

    const ctx = (typeof body.ctx === "object" && body.ctx !== null ? body.ctx : {}) as Record<string, unknown>;
    const rawUtm = (typeof ctx.utm === "object" && ctx.utm !== null ? ctx.utm : {}) as Record<string, unknown>;
    const utm: Record<string, string> = {};
    for (const k of ["source", "medium", "campaign", "term", "content"]) {
      const v = str(rawUtm[k], 100);
      if (v) utm[k] = v;
    }

    const session = await getSession().catch(() => null);

    await recordEvent({
      event,
      path: str(body.path, 200) ?? "/",
      vid,
      sid,
      userId: session?.userId,
      props: cleanProps(body.props),
      ref: str(ctx.ref, 300),
      utm: Object.keys(utm).length > 0 ? utm : undefined,
      landing: str(ctx.landing, 200),
      country: str(request.headers.get("x-vercel-ip-country"), 8),
      device: /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop",
    });
  } catch {
    // swallowed on purpose; see the module comment
  }
  return done;
}
