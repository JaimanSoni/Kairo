import { addDays, friendlyDay, fmtMinutes, fmtTime12, nextWeekday, todayStr } from "./dates";
import { extractTime, parseEstimate } from "./nlp";
import type { List, Task } from "./types";

/**
 * Telling Kairo what to do with things you already have.
 *
 * Capture has always turned a sentence into a new task. This turns a sentence
 * into a change to an existing one: "move the quotation to monday", "put the
 * invoice in work", "mark the deck done", "delete the dentist thing". The same
 * box, so there is one place to say anything, and no syntax to learn.
 *
 * It is deliberately plain rather than clever:
 *
 *   - A command needs a verb it knows at the front. Without one the sentence
 *     is a new task, as before. "buy milk tomorrow" must never be read as an
 *     instruction to move something called "milk".
 *   - It names the task in your words and finds it by overlap, and it says
 *     which task it found before doing anything. A wrong guess is worse than
 *     no guess, so a tie asks rather than picks.
 *   - Nothing it does is unrecoverable: every command comes back with Undo.
 *
 * All of it is local: no request, no wait, and your task titles stay here.
 */

export type Action =
  | { kind: "move"; date: string | null; time: string | null }
  | { kind: "list"; listId: string | null; listName: string }
  | { kind: "done" }
  | { kind: "delete" }
  | { kind: "rename"; title: string }
  | { kind: "star"; on: boolean }
  | { kind: "focus" }
  | { kind: "estimate"; minutes: number };

export type Command = { action: Action; target: string };

/* ------------------------------------------------------------------ words */

/** Words that carry no meaning when naming a task, so they don't count for or against a match. */
const FILLER = new Set([
  "the", "a", "an", "this", "that", "these", "those", "my", "our", "his", "her", "their", "its",
  "task", "item", "thing", "one", "to", "for", "of", "on", "in", "at", "it", "please", "thing's",
]);

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

const meaningful = (s: string): string[] => words(s).filter((w) => !FILLER.has(w));

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tues: 2, tue: 2, wednesday: 3, weds: 3, wed: 3,
  thursday: 4, thurs: 4, thur: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

/**
 * When a tail like "monday", "next week", "the 21st" or "someday" means.
 * `null` with `someday` true is a real answer: no day at all.
 */
export function parseWhen(raw: string, today = todayStr()): { date: string | null; someday: boolean } | null {
  const t = raw.toLowerCase().trim().replace(/^(?:the|on|until|till)\s+/, "").replace(/\s+(?:please)$/, "");
  if (!t) return null;
  if (/^(someday|later|sometime|no ?day|the backlog|backlog)$/.test(t)) return { date: null, someday: true };
  if (/^(today|tod|now)$/.test(t)) return { date: today, someday: false };
  if (/^(tomorrow|tmr|tmrw|tom|2morrow)$/.test(t)) return { date: addDays(today, 1), someday: false };
  if (/^(day after tomorrow|the day after tomorrow)$/.test(t)) return { date: addDays(today, 2), someday: false };
  if (/^next week$/.test(t)) return { date: nextWeekday(1, today), someday: false };
  if (/^(this |the )?weekend$/.test(t)) return { date: nextWeekday(6, today), someday: false };
  const inDays = /^in (\d{1,3}) days?$/.exec(t);
  if (inDays) return { date: addDays(today, Number(inDays[1])), someday: false };
  const inWeeks = /^in (\d{1,2}) weeks?$/.exec(t);
  if (inWeeks) return { date: addDays(today, 7 * Number(inWeeks[1])), someday: false };
  const day = /^(?:next |this |on )?([a-z]+)$/.exec(t);
  if (day && day[1] in WEEKDAYS) return { date: nextWeekday(WEEKDAYS[day[1]], today), someday: false };
  // "21 sep", "sep 21", "21st september"
  const dm = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)$/.exec(t) ?? null;
  const md = /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/.exec(t) ?? null;
  const dayNum = dm ? Number(dm[1]) : md ? Number(md[2]) : null;
  const monthKey = dm ? dm[2] : md ? md[1] : null;
  if (dayNum && monthKey && monthKey in MONTHS && dayNum >= 1 && dayNum <= 31) {
    const now = new Date(`${today}T00:00:00`);
    let year = now.getFullYear();
    const month = MONTHS[monthKey];
    // a month already past means next year's
    if (month < now.getMonth() || (month === now.getMonth() && dayNum < now.getDate())) year += 1;
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return { date: iso, someday: false };
  }
  return null;
}

/* --------------------------------------------------------------- the verbs */

const MOVE = /^(?:move|push|shift|reschedule|resched|snooze|postpone|bump|defer|change)\s+(.+?)\s+(?:to|until|till|for|into)\s+(.+)$/i;
const PUT = /^(?:put|file|drop|add)\s+(.+?)\s+(?:in|into|under|on)\s+(?:the\s+)?(.+?)(?:\s+list)?$/i;
const DONE_A = /^(?:mark|tick|check)\s+(?:off\s+)?(.+?)(?:\s+(?:as\s+)?(?:done|complete|completed|finished|off))?$/i;
const DONE_B = /^(?:complete|finish|finished|did)\s+(.+)$/i;
const DONE_C = /^(.+?)\s+is\s+(?:done|complete|completed|finished)$/i;
const DELETE = /^(?:delete|remove|bin|trash|forget|cancel|scrap)\s+(.+)$/i;
const RENAME = /^(?:rename|retitle|call)\s+(.+?)\s+(?:to|as)\s+(.+)$/i;
const STAR = /^(?:star|spotlight|pin|highlight)\s+(.+)$/i;
const UNSTAR = /^(?:unstar|unpin|unspotlight)\s+(.+)$/i;
const FOCUS = /^(?:start|focus on|work on|begin)\s+(.+)$/i;
const ESTIMATE = /^(?:(.+?)\s+(?:takes|needs|will take)\s+(.+)|set\s+(.+?)\s+to\s+(~?\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours)))$/i;

/** The list whose name the tail names, if any. */
function findList(tail: string, lists: List[]): List | null {
  const t = tail.toLowerCase().trim().replace(/\s+list$/, "");
  if (!t) return null;
  return lists.find((l) => l.name.toLowerCase() === t) ?? lists.find((l) => l.name.toLowerCase().startsWith(t)) ?? null;
}

/**
 * A sentence as an instruction, or null when it is just a new task.
 * `lists` lets "put the invoice in work" find the list called Work.
 */
export function parseCommand(raw: string, lists: List[], today = todayStr()): Command | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text || text.length > 200) return null;

  const unstar = UNSTAR.exec(text);
  if (unstar) return { action: { kind: "star", on: false }, target: unstar[1] };
  const star = STAR.exec(text);
  if (star) return { action: { kind: "star", on: true }, target: star[1] };

  const del = DELETE.exec(text);
  if (del) return { action: { kind: "delete" }, target: del[1] };

  const rename = RENAME.exec(text);
  if (rename) return { action: { kind: "rename", title: rename[2].trim() }, target: rename[1] };

  const focus = FOCUS.exec(text);
  if (focus) return { action: { kind: "focus" }, target: focus[1] };

  const move = MOVE.exec(text);
  if (move) {
    const [, target, tailRaw] = move;
    const list = findList(tailRaw, lists);
    if (list) return { action: { kind: "list", listId: list.id, listName: list.name }, target };
    // a day, and a time riding along with it ("to monday 6pm")
    const { time, rest } = extractTime(tailRaw);
    const when = parseWhen(rest, today) ?? (time ? { date: today, someday: false } : null);
    if (when) return { action: { kind: "move", date: when.someday ? null : when.date, time }, target };
    return null;
  }

  const put = PUT.exec(text);
  if (put) {
    const list = findList(put[2], lists);
    // "add milk to shopping" with no such list is still a new task, as it always was
    if (list) return { action: { kind: "list", listId: list.id, listName: list.name }, target: put[1] };
    return null;
  }

  const est = ESTIMATE.exec(text);
  if (est) {
    const target = est[1] ?? est[3];
    const amount = est[2] ?? est[4];
    const minutes = amount ? parseEstimate(amount.trim().replace(/\s+/g, "")) : null;
    if (target && minutes) return { action: { kind: "estimate", minutes }, target };
  }

  const doneC = DONE_C.exec(text);
  if (doneC) return { action: { kind: "done" }, target: doneC[1] };
  const doneB = DONE_B.exec(text);
  if (doneB) return { action: { kind: "done" }, target: doneB[1] };
  const doneA = DONE_A.exec(text);
  // "mark X" alone is only a command when it ended with a done-ish word
  if (doneA && /\b(done|complete|completed|finished|off)\s*$/i.test(text)) return { action: { kind: "done" }, target: doneA[1] };

  return null;
}

/* ------------------------------------------------------------- the target */

export type Match = { task: Task; score: number };

/**
 * The tasks a target phrase could mean, best first. Scored on how much of
 * what you said appears in the title, so "the quotation" finds "Send the
 * quotation to Acme" without matching everything else you own.
 */
export function matchTasks(target: string, tasks: Task[]): Match[] {
  const want = meaningful(target);
  if (!want.length) return [];
  const phrase = want.join(" ");
  const scored: Match[] = [];
  for (const task of tasks) {
    if (task.status === "done") continue;
    const title = task.title.toLowerCase();
    const have = new Set(meaningful(task.title));
    let hits = 0;
    for (const w of want) {
      if (have.has(w)) hits += 1;
      else if (w.length >= 4 && [...have].some((h) => h.startsWith(w) || w.startsWith(h))) hits += 0.75;
    }
    let score = hits / want.length;
    if (score === 0) continue;
    if (title.includes(phrase)) score += 0.35;
    // a short title that is almost all of what you said is a better answer than a long one that merely contains it
    if (have.size <= want.length + 1) score += 0.1;
    scored.push({ task, score: Math.min(1.3, score) });
  }
  scored.sort((a, b) => b.score - a.score || a.task.title.length - b.task.title.length);
  return scored.filter((m) => m.score >= 0.55).slice(0, 5);
}

/** The one task this plainly means, or null when it is too close to call. */
export function pickOne(matches: Match[]): Task | null {
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0].task;
  return matches[0].score - matches[1].score >= 0.25 ? matches[0].task : null;
}

/* -------------------------------------------------------------- the words */

/** What a command will do, in a sentence: "Move Send the quotation to Monday". */
export function commandSentence(action: Action, taskTitle: string, today = todayStr()): string {
  const name = `“${taskTitle}”`;
  switch (action.kind) {
    case "move": {
      if (!action.date) return `Park ${name} in Someday`;
      const day = friendlyDay(action.date, today);
      return `Move ${name} to ${day}${action.time ? ` at ${fmtTime12(action.time)}` : ""}`;
    }
    case "list":
      return `Put ${name} in ${action.listName}`;
    case "done":
      return `Tick ${name} off`;
    case "delete":
      return `Delete ${name}`;
    case "rename":
      return `Rename ${name} to “${action.title}”`;
    case "star":
      return action.on ? `Spotlight ${name}` : `Take ${name} out of the spotlight`;
    case "focus":
      return `Start focusing on ${name}`;
    case "estimate":
      return `Give ${name} ${fmtMinutes(action.minutes)}`;
  }
}

/** What to say once it's done. */
export function commandDone(action: Action, taskTitle: string, today = todayStr()): string {
  const name = `“${taskTitle}”`;
  switch (action.kind) {
    case "move":
      return action.date ? `${name} is on ${friendlyDay(action.date, today).toLowerCase()}'s plan.` : `${name} is in Someday.`;
    case "list":
      return `${name} is in ${action.listName}.`;
    case "done":
      return `${name} is done.`;
    case "delete":
      return "Let go. One less thing.";
    case "rename":
      return `Renamed to ${`“${action.title}”`}.`;
    case "star":
      return action.on ? `${name} is in the spotlight.` : `${name} is out of the spotlight.`;
    case "focus":
      return `Focusing on ${name}.`;
    case "estimate":
      return `${name} takes ${fmtMinutes(action.minutes)}.`;
  }
}
