/**
 * Day boundaries for connections that have no browser.
 *
 * Every date in Kairo is a local-day string ("YYYY-MM-DD"), and until now it
 * was always computed in the browser from the user's own clock. An MCP client
 * has no clock of ours to read: the request lands on a machine running UTC,
 * where "today" turns over at 05:30 in India — so an evening capture would be
 * filed under tomorrow and the morning sweep would ask about a day that had
 * not ended. A connection therefore carries the zone it was created in, and
 * every day boundary below is computed in that zone.
 */

const DAY_FMT = new Map<string, Intl.DateTimeFormat>();
const CLOCK_FMT = new Map<string, Intl.DateTimeFormat>();
const PART_FMT = new Map<string, Intl.DateTimeFormat>();

export const DEFAULT_TIMEZONE = "UTC";

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Falls back rather than throwing: a bad zone must not break a whole request. */
export function safeTimeZone(tz: unknown): string {
  return isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

/** The local day, "YYYY-MM-DD". en-CA is already that shape. */
export function todayIn(tz: string, now: Date = new Date()): string {
  let fmt = DAY_FMT.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    DAY_FMT.set(tz, fmt);
  }
  return fmt.format(now);
}

/** The local wall clock, "HH:MM" (24h). */
export function clockIn(tz: string, now: Date = new Date()): string {
  let fmt = CLOCK_FMT.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    CLOCK_FMT.set(tz, fmt);
  }
  // en-GB can render midnight as "24:00" on some ICU builds
  return fmt.format(now).replace(/^24:/, "00:");
}

/** How far ahead of UTC the zone is at a given instant, in ms. */
function offsetMsAt(tz: string, utcMs: number): number {
  let fmt = PART_FMT.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    PART_FMT.set(tz, fmt);
  }
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24, // "24" for midnight on older ICU
    Number(p.minute),
    Number(p.second)
  );
  return asUtc - utcMs;
}

/**
 * Epoch ms for a wall-clock moment in a zone — "2026-09-04" + "18:00" in
 * Asia/Kolkata is one instant, and it is not the same instant as it is in UTC.
 *
 * Resolved twice because the offset at the guess is not always the offset at
 * the answer: across a DST boundary the first pass lands an hour out, and the
 * second pass, now measuring near the right instant, corrects it.
 */
export function epochIn(dateStr: string, hhmm: string, tz: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  const first = naive - offsetMsAt(tz, naive);
  return naive - offsetMsAt(tz, first);
}

/** The local day an instant fell on, in the connection's zone. */
export function dayOfInstant(iso: string | Date, tz: string): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : todayIn(tz, d);
}
