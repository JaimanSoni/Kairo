import { addDays, parseDateStr, toDateStr } from "./dates";

export type Repeat = {
  type: "daily" | "weekly" | "monthly";
  /** daily: every N days (default 1) */
  interval?: number;
  /** weekly: weekdays 0(Sun)–6(Sat), non-empty */
  weekdays?: number[];
  /** monthly: 1–31, clamped to month length */
  dayOfMonth?: number;
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function sanitizeRepeat(raw: unknown): Repeat | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (r.type === "daily") {
    const interval =
      typeof r.interval === "number" && Number.isInteger(r.interval) && r.interval >= 1 && r.interval <= 365
        ? r.interval
        : 1;
    return { type: "daily", interval };
  }
  if (r.type === "weekly") {
    if (!Array.isArray(r.weekdays)) return undefined;
    const weekdays = [...new Set(r.weekdays)]
      .filter((d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6)
      .sort((a, b) => a - b);
    if (weekdays.length === 0) return undefined;
    return { type: "weekly", weekdays };
  }
  if (r.type === "monthly") {
    if (
      typeof r.dayOfMonth !== "number" ||
      !Number.isInteger(r.dayOfMonth) ||
      r.dayOfMonth < 1 ||
      r.dayOfMonth > 31
    )
      return undefined;
    return { type: "monthly", dayOfMonth: r.dayOfMonth };
  }
  return undefined;
}

function monthlyCandidate(year: number, monthIndex: number, dayOfMonth: number): string {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return toDateStr(new Date(year, monthIndex, Math.min(dayOfMonth, daysInMonth)));
}

/** First occurrence strictly AFTER `afterStr`. */
export function nextOccurrence(repeat: Repeat, afterStr: string): string {
  switch (repeat.type) {
    case "daily":
      return addDays(afterStr, repeat.interval ?? 1);
    case "weekly": {
      const days = repeat.weekdays ?? [];
      for (let i = 1; i <= 7; i++) {
        const candidate = addDays(afterStr, i);
        if (days.includes(parseDateStr(candidate).getDay())) return candidate;
      }
      return addDays(afterStr, 7);
    }
    case "monthly": {
      const after = parseDateStr(afterStr);
      const thisMonth = monthlyCandidate(after.getFullYear(), after.getMonth(), repeat.dayOfMonth ?? 1);
      if (thisMonth > afterStr) return thisMonth;
      const next = new Date(after.getFullYear(), after.getMonth() + 1, 1);
      return monthlyCandidate(next.getFullYear(), next.getMonth(), repeat.dayOfMonth ?? 1);
    }
  }
}

/** First occurrence ON or after `fromStr`. */
export function firstOccurrence(repeat: Repeat, fromStr: string): string {
  const dayBefore = addDays(fromStr, -1);
  return nextOccurrence(repeat, dayBefore);
}

function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

export function repeatLabel(repeat: Repeat): string {
  switch (repeat.type) {
    case "daily":
      return (repeat.interval ?? 1) === 1 ? "daily" : `every ${repeat.interval} days`;
    case "weekly": {
      const days = [...(repeat.weekdays ?? [])].sort(
        // Monday-first ordering for display
        (a, b) => ((a + 6) % 7) - ((b + 6) % 7)
      );
      if (days.length === 7) return "daily";
      return days.map((d) => DAY_SHORT[d]).join(" · ");
    }
    case "monthly":
      return `monthly · ${ordinal(repeat.dayOfMonth ?? 1)}`;
  }
}
