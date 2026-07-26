/**
 * Decides when to ask, once, for a coffee.
 *
 * The rule: after someone has actually opened Kairo on three *different* days.
 * Not three days since signup — three days of real use, so the ask only lands
 * with people the thing has genuinely been useful to.
 *
 * Device-local on purpose. It needs no schema change, and if you use Kairo on
 * a phone and a laptop the worst case is being asked twice, months apart.
 * Everything degrades to "never ask" if storage is unavailable — a broken
 * nudge must never break the app.
 */

const DAYS_KEY = "kairo.days-seen";
const ASKED_KEY = "kairo.coffee-asked";

export const DAYS_BEFORE_ASKING = 3;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode, disabled storage, quota — all mean "don't ask"
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* nothing to do — the nudge just won't fire */
  }
}

/** Distinct YYYY-MM-DD days this device has opened the app, oldest first. */
function daysSeen(): string[] {
  const raw = read(DAYS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Records that the app was opened today. Returns the number of distinct days
 * seen so far. Safe to call on every mount — the same day never counts twice.
 */
export function recordVisit(today: string): number {
  const days = daysSeen();
  if (days.includes(today)) return days.length;
  // only the count matters, so keep the tail short rather than growing forever
  const next = [...days, today].slice(-(DAYS_BEFORE_ASKING + 2));
  write(DAYS_KEY, JSON.stringify(next));
  return next.length;
}

export function alreadyAsked(): boolean {
  return read(ASKED_KEY) === "1";
}

/** Called when the prompt is actually shown, so it never appears twice. */
export function markAsked(): void {
  write(ASKED_KEY, "1");
}

/** True once there are enough days of use and we haven't asked before. */
export function shouldAsk(today: string): boolean {
  if (alreadyAsked()) return false;
  return recordVisit(today) >= DAYS_BEFORE_ASKING;
}
