/**
 * The journal's content model, shared by the server, the editor and the export.
 *
 * The document rules every editor shares live in doc-model; this file adds what
 * only a diary has — the weather, the day a page belongs to, the timestamp
 * divider — and the short list of blocks a journal page may contain.
 */

import {
  BASE_MARKS,
  BASE_NODES,
  blocksToMarkdown,
  createNormalizer,
  escapeMd,
  type JNode,
} from "./doc-model";

export {
  countWords,
  docToText,
  EMPTY_DOC,
  HIGHLIGHTS,
  highlightVar,
  previewOf,
  safeHref,
  withTrailingParagraph,
  type HighlightName,
  type JMark,
  type JNode,
} from "./doc-model";

/* ------------------------------------------------------------------ mood */

export type Mood = 1 | 2 | 3 | 4 | 5;

/**
 * Mood as weather, not as a score.
 *
 * A 1-to-5 face scale reads like a grade, and a calendar full of frowns is
 * exactly the wall of red Kairo exists to avoid. Weather is honest without
 * being a verdict: nobody failed at a cloudy day.
 */
export const MOODS: { value: Mood; emoji: string; label: string; color: string }[] = [
  { value: 1, emoji: "🌧️", label: "Stormy", color: "#7c86a8" },
  { value: 2, emoji: "☁️", label: "Cloudy", color: "#4e93c9" },
  { value: 3, emoji: "🌤️", label: "Mixed", color: "#0c9384" },
  { value: 4, emoji: "☀️", label: "Sunny", color: "#d8a03e" },
  { value: 5, emoji: "🌈", label: "Radiant", color: "#c960a5" },
];

export function isMood(v: unknown): v is Mood {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
}

export function moodOf(v: Mood | null | undefined) {
  return v ? MOODS[v - 1] : null;
}

/* ----------------------------------------------------------------- dates */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Rejects 2026-02-31, which the pattern alone would let through. */
export function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (y < 1900 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * A day a page may belong to. `latest` is the newest allowed day: the browser
 * passes its own today, and the server — which has no idea where the user is —
 * passes tomorrow in UTC, which is today somewhere on Earth.
 */
export function isJournalDate(v: unknown, latest: string): v is string {
  return typeof v === "string" && isRealDate(v) && v <= latest;
}

export function utcTomorrow(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* ----------------------------------------------------------------- types */

/** A whole page, as the editor loads it. */
export type JournalEntry = {
  date: string;
  title: string;
  doc: JNode;
  mood: Mood | null;
  words: number;
  /** Bumped on every save. A save carries the version it started from. */
  version: number;
  createdAt: string;
  updatedAt: string;
};

/** A page as the calendar and search see it — no document, just enough to recognise. */
export type JournalSummary = {
  date: string;
  title: string;
  mood: Mood | null;
  words: number;
  preview: string;
  updatedAt: string;
};

export type JournalStats = {
  entries: number;
  wordsThisYear: number;
  firstDate: string | null;
};

export type JournalMemories = {
  weekAgo: JournalSummary | null;
  monthAgo: JournalSummary | null;
  /** Same day in earlier years, newest first. */
  yearsAgo: JournalSummary[];
};

/* -------------------------------------------------------------- limits */

export const TITLE_MAX = 140;
/** Serialised JSON. A long novel chapter is ~150KB; this is generous, not unbounded. */
export const DOC_MAX_BYTES = 400_000;

export class JournalContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalContentError";
  }
}

/* ------------------------------------------------------------ sanitiser */

/** Checks a journal page from the editor and rebuilds it from known parts. */
export const normalizeDoc = createNormalizer({
  nodes: {
    ...BASE_NODES,
    // the divider a page gets when you come back to it later in the day
    entryTime: (a) => ({ time: typeof a.time === "string" && TIME_RE.test(a.time) ? a.time : "00:00" }),
  },
  marks: BASE_MARKS,
  maxBytes: DOC_MAX_BYTES,
  maxDepth: 24,
  maxNodes: 25_000,
  fail: (message) => new JournalContentError(message),
});

export function cleanTitle(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX) : "";
}

/** Empty means nothing a person wrote: no words, no title, no mood. */
export function isEmptyPage(text: string, title: string, mood: Mood | null): boolean {
  return text.trim().length === 0 && title.trim().length === 0 && mood === null;
}

/* ------------------------------------------------------------- markdown */

const LONG_WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LONG_MONTH = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Thursday, 11 September 2026" — the zone never enters into it. */
export function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = LONG_WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${d} ${LONG_MONTH[m - 1]} ${y}`;
}

/**
 * One page as Markdown. `depth` is the heading level the day's own heading
 * takes: 1 for a single-page download, 2 inside the whole-journal export, so
 * a page's own headings nest beneath its date instead of competing with it.
 */
export function entryToMarkdown(
  entry: Pick<JournalEntry, "date" | "title" | "mood" | "doc" | "words">,
  depth: 1 | 2 = 1
): string {
  const mood = moodOf(entry.mood);
  const meta = [mood ? `${mood.emoji} ${mood.label}` : null, `${entry.words} ${entry.words === 1 ? "word" : "words"}`]
    .filter(Boolean)
    .join(" · ");
  const parts = [`${"#".repeat(depth)} ${longDate(entry.date)}`, `_${meta}_`];
  if (entry.title) parts.push(`${"#".repeat(depth + 1)} ${escapeMd(entry.title)}`);
  const body = blocksToMarkdown(entry.doc.content, { shift: depth + 1 });
  if (body) parts.push(body);
  return parts.join("\n\n");
}

export function journalToMarkdown(
  entries: Pick<JournalEntry, "date" | "title" | "mood" | "doc" | "words">[],
  owner: string,
  exportedOn: string
): string {
  const words = entries.reduce((sum, e) => sum + e.words, 0);
  const head = [
    `# ${owner ? `${owner}'s journal` : "Journal"}`,
    `_Exported from Kairo on ${longDate(exportedOn)} · ${entries.length} ${entries.length === 1 ? "page" : "pages"} · ${words.toLocaleString("en-US")} words_`,
  ].join("\n\n");
  if (entries.length === 0) return `${head}\n`;
  return `${head}\n\n---\n\n${entries.map((e) => entryToMarkdown(e, 2)).join("\n\n---\n\n")}\n`;
}
