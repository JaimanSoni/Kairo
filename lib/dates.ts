/** All date logic is local-time, string-based ("YYYY-MM-DD") to avoid TZ drift. */

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

/**
 * The LOCAL day an ISO instant fell on. `iso.slice(0, 10)` reads the UTC
 * day, which for anyone east of Greenwich shifts early-morning completions
 * onto yesterday — in India, everything finished before 05:30 vanished from
 * "Done today".
 */
export function localDayOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : toDateStr(d);
}

/**
 * The middle of a day, as a real instant.
 *
 * Something finished on a past day has to be stamped with a moment, not a
 * date, because that is what completion is recorded as. Midday is the safe
 * one: midnight either end can fall into the day before or after once a
 * clock changes or a summary is drawn up in another timezone, and nobody
 * cares what o'clock it was on a day they are filling in afterwards.
 */
export function middayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
}

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mon 22 Jul" style label; "Today"/"Tomorrow" when close. */
export function friendlyDay(dateStr: string, relativeTo = todayStr()): string {
  if (dateStr === relativeTo) return "Today";
  if (dateStr === addDays(relativeTo, 1)) return "Tomorrow";
  if (dateStr === addDays(relativeTo, -1)) return "Yesterday";
  const d = parseDateStr(dateStr);
  return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function weekdayName(dateStr: string): string {
  return WEEKDAYS[parseDateStr(dateStr).getDay()];
}

/** Next occurrence of a weekday (0=Sun..6=Sat), strictly after today. */
export function nextWeekday(target: number, from = todayStr()): string {
  const d = parseDateStr(from);
  let diff = (target - d.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  return addDays(from, diff);
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fullDate(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtClockTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "HH:MM" (24h) → "6:00 PM" for display. */
export function fmtTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Epoch ms for a planned day + "HH:MM" in local time. */
export function planEpoch(dateStr: string, hhmm: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}

/** "Today 15:00" / "Tomorrow 09:00" / "Thu 24 Jul 09:00" for a reminder moment. */
export function fmtReminder(ms: number, today: string): string {
  const day = toDateStr(new Date(ms));
  return `${friendlyDay(day, today)} ${fmtClockTime(ms)}`;
}
