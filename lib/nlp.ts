import { addDays, nextWeekday, todayStr } from "./dates";
import { firstOccurrence, type Repeat } from "./repeat";
import type { List } from "./types";

export type ParsedInput = {
  title: string;
  plannedFor: string | null;
  dueDate: string | null;
  estimateMin: number | null;
  listId: string | null;
  listName: string | null;
  spotlight: boolean;
  repeat: Repeat | null;
};

const WEEKDAY_TOKENS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

function parseDateToken(token: string): string | null {
  const t = token.toLowerCase();
  if (t === "today" || t === "tod") return todayStr();
  if (t === "tomorrow" || t === "tmr" || t === "tmrw" || t === "tom") return addDays(todayStr(), 1);
  if (t in WEEKDAY_TOKENS) return nextWeekday(WEEKDAY_TOKENS[t]);
  return null;
}

function parseEstimate(token: string): number | null {
  // ~30m, ~1h, ~1h30m, 30m, 2h, 1h15
  const m = token.match(/^~?(?:(\d+)h)?(?:(\d+)m?)?$/i);
  if (!m) return null;
  const hours = m[1] ? parseInt(m[1], 10) : 0;
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const total = hours * 60 + mins;
  if (total <= 0 || total > 24 * 60) return null;
  // Bare numbers like "30" only count when prefixed with ~ or suffixed with m/h
  if (!token.startsWith("~") && !/[hm]/i.test(token)) return null;
  return total;
}

/** Extracts a recurrence phrase ("every monday", "daily", "every 2 days"…). */
function extractRepeat(text: string): { repeat: Repeat | null; rest: string } {
  const weekdayNames = "sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?";

  // "every mon", "every mon and wed", "every tue, thu"
  const weeklyRe = new RegExp(
    `\\bevery\\s+((?:(?:${weekdayNames})(?:\\s*(?:,|and|&)\\s*|\\s+)?)+)(?=\\s|$)`,
    "i"
  );
  const weeklyMatch = text.match(weeklyRe);
  if (weeklyMatch) {
    const tokens = weeklyMatch[1].toLowerCase().match(new RegExp(weekdayNames, "g")) ?? [];
    const weekdays = [...new Set(tokens.map((t) => WEEKDAY_TOKENS[t.slice(0, 3)]))].filter(
      (d): d is number => d !== undefined
    );
    if (weekdays.length > 0) {
      return { repeat: { type: "weekly", weekdays }, rest: text.replace(weeklyRe, " ") };
    }
  }

  const everyNDays = text.match(/\bevery\s+(\d{1,3})\s+days?\b/i);
  if (everyNDays) {
    const interval = Math.min(365, Math.max(1, parseInt(everyNDays[1], 10)));
    return { repeat: { type: "daily", interval }, rest: text.replace(everyNDays[0], " ") };
  }

  if (/\bevery\s?day\b|\bdaily\b/i.test(text)) {
    return { repeat: { type: "daily", interval: 1 }, rest: text.replace(/\bevery\s?day\b|\bdaily\b/i, " ") };
  }

  if (/\bevery\s+month\b|\bmonthly\b/i.test(text)) {
    const dayOfMonth = Number(todayStr().slice(8));
    return { repeat: { type: "monthly", dayOfMonth }, rest: text.replace(/\bevery\s+month\b|\bmonthly\b/i, " ") };
  }

  if (/\bevery\s+week\b|\bweekly\b/i.test(text)) {
    const [y, m, d] = todayStr().split("-").map(Number);
    return {
      repeat: { type: "weekly", weekdays: [new Date(y, m - 1, d).getDay()] },
      rest: text.replace(/\bevery\s+week\b|\bweekly\b/i, " "),
    };
  }

  return { repeat: null, rest: text };
}

/**
 * Parses quick-add text. Recognized, order-independent:
 *   dates:      today · tomorrow · mon…sunday · "next week"
 *   deadline:   due <date-token>
 *   repeat:     daily · every 2 days · every mon and wed · monthly
 *   estimate:   ~30m · ~1h30m · 45m · 2h
 *   list:       #listname (matches existing list by prefix)
 *   spotlight:  !
 * Everything unrecognized stays in the title.
 */
export function parseQuickAdd(raw: string, lists: List[]): ParsedInput {
  const result: ParsedInput = {
    title: "",
    plannedFor: null,
    dueDate: null,
    estimateMin: null,
    listId: null,
    listName: null,
    spotlight: false,
    repeat: null,
  };

  let text = raw;

  const { repeat, rest } = extractRepeat(text);
  if (repeat) {
    result.repeat = repeat;
    text = rest;
  }

  // "next week" → next Monday
  if (/\bnext week\b/i.test(text)) {
    result.plannedFor = nextWeekday(1);
    text = text.replace(/\bnext week\b/i, " ");
  }

  const words = text.split(/\s+/).filter(Boolean);
  const kept: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (word === "!") {
      result.spotlight = true;
      continue;
    }

    if (word.startsWith("#") && word.length > 1) {
      const name = word.slice(1).toLowerCase();
      const match = lists.find((l) => l.name.toLowerCase().startsWith(name));
      if (match) {
        result.listId = match.id;
        result.listName = match.name;
        continue;
      }
      kept.push(word);
      continue;
    }

    if (word.toLowerCase() === "due" && i + 1 < words.length) {
      const date = parseDateToken(words[i + 1]);
      if (date) {
        result.dueDate = date;
        i++;
        continue;
      }
    }

    const date = parseDateToken(word);
    if (date && result.plannedFor === null) {
      result.plannedFor = date;
      continue;
    }

    const est = parseEstimate(word);
    if (est !== null && result.estimateMin === null) {
      result.estimateMin = est;
      continue;
    }

    kept.push(word);
  }

  result.title = kept.join(" ").trim();

  // a repeating task needs a day — snap to the rule's first occurrence
  if (result.repeat && !result.plannedFor) {
    result.plannedFor = firstOccurrence(result.repeat, todayStr());
  }

  return result;
}
