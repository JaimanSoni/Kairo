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
