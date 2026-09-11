/**
 * The journal's content model, shared by the server, the editor and the export.
 *
 * Pure on purpose — no database, no DOM — so the rules that decide what the API
 * will store are the same rules that decide what the word count says and what
 * the Markdown export writes. They cannot disagree, because there is only one.
 *
 * Pages are stored as the editor's own JSON rather than HTML. HTML would have
 * to be sanitised on every read, forever; a document tree is checked once, on
 * the way in, against a short list of things a journal page can contain.
 */

export type JMark = { type: string; attrs?: Record<string, unknown> };
export type JNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JNode[];
  text?: string;
  marks?: JMark[];
};

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

/* ------------------------------------------------------------ highlights */

/**
 * Highlights are stored as CSS variables, not colours. A hex picked on a light
 * theme is a glare on a dark one; a variable is redefined per theme, so an old
 * page opened in dark mode highlights correctly without being rewritten.
 */
export const HIGHLIGHTS = ["sun", "amber", "rose", "lilac", "sky", "moss"] as const;
export type HighlightName = (typeof HIGHLIGHTS)[number];
export const highlightVar = (name: HighlightName) => `var(--hl-${name})`;
const HIGHLIGHT_RE = new RegExp(`^var\\(--hl-(${HIGHLIGHTS.join("|")})\\)$`);

/* -------------------------------------------------------------- limits */

export const TITLE_MAX = 140;
/** Serialised JSON. A long novel chapter is ~150KB; this is generous, not unbounded. */
export const DOC_MAX_BYTES = 400_000;
const DOC_MAX_DEPTH = 24;
const DOC_MAX_NODES = 25_000;

export class JournalContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalContentError";
  }
}

/* ------------------------------------------------------------ sanitiser */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function int(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fallback;
}

/**
 * Only http, https and mailto survive. Everything else — javascript:, data:,
 * vbscript:, a relative path that resolves somewhere surprising — is dropped,
 * and the words it was attached to stay as plain text.
 */
export function safeHref(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > 2048) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:" ? u.toString() : null;
  } catch {
    return null;
  }
}

type AttrRule = ((a: Record<string, unknown>) => Record<string, unknown>) | null;

/** Every block and inline node a page may hold, and the attributes each keeps. */
const NODES: Record<string, AttrRule> = {
  doc: null,
  paragraph: null,
  text: null,
  hardBreak: null,
  horizontalRule: null,
  bulletList: null,
  listItem: null,
  taskList: null,
  blockquote: null,
  heading: (a) => ({ level: int(a.level, 1, 3, 2) }),
  orderedList: (a) => ({
    start: int(a.start, 1, 99_999, 1),
    type: typeof a.type === "string" && ["1", "a", "A", "i", "I"].includes(a.type) ? a.type : null,
  }),
  taskItem: (a) => ({ checked: a.checked === true }),
  codeBlock: (a) => ({
    language: typeof a.language === "string" && /^[a-z0-9+#.-]{1,24}$/i.test(a.language) ? a.language : null,
  }),
  // a callout carries one emoji; anything longer is a smuggled string
  callout: (a) => ({
    emoji: typeof a.emoji === "string" && a.emoji.length > 0 && a.emoji.length <= 16 ? a.emoji : "💭",
  }),
  // the divider a page gets when you come back to it later in the day
  entryTime: (a) => ({ time: typeof a.time === "string" && TIME_RE.test(a.time) ? a.time : "00:00" }),
};

/** Marks, and a rule per mark. A rule returning null drops the mark but keeps the text. */
const MARKS: Record<string, ((a: Record<string, unknown>) => Record<string, unknown> | null) | null> = {
  bold: null,
  italic: null,
  underline: null,
  strike: null,
  code: null,
  highlight: (a) => ({ color: typeof a.color === "string" && HIGHLIGHT_RE.test(a.color) ? a.color : null }),
  link: (a) => {
    const href = safeHref(a.href);
    return href ? { href, target: "_blank", rel: "noopener noreferrer nofollow", class: null } : null;
  },
};

/**
 * Checks a page from the editor and rebuilds it from known parts.
 *
 * Unknown blocks are refused rather than silently dropped: the editor cannot
 * produce one, so meeting one means a client that is lying, and quietly
 * deleting part of someone's diary would be the worse failure. Unknown
 * attributes, by contrast, are just not copied — they carry no words.
 */
export function normalizeDoc(input: unknown): JNode {
  if (!isObj(input) || input.type !== "doc") {
    throw new JournalContentError("That page isn't a document.");
  }
  if (JSON.stringify(input).length > DOC_MAX_BYTES) {
    throw new JournalContentError("That page is too long to save in one piece.");
  }

  let count = 0;
  const walk = (n: unknown, depth: number): JNode | null => {
    if (depth > DOC_MAX_DEPTH) throw new JournalContentError("That page is nested too deeply.");
    if (++count > DOC_MAX_NODES) throw new JournalContentError("That page has too many pieces.");
    if (!isObj(n) || typeof n.type !== "string") throw new JournalContentError("A block on that page is malformed.");
    if (!(n.type in NODES)) throw new JournalContentError(`A page can't contain "${n.type}".`);

    const out: JNode = { type: n.type };
    const rule = NODES[n.type];
    if (rule) out.attrs = rule(isObj(n.attrs) ? n.attrs : {});

    if (n.type === "text") {
      // ProseMirror refuses empty text nodes; an empty one is dropped, not an error
      if (typeof n.text !== "string" || n.text.length === 0) return null;
      out.text = n.text;
      if (Array.isArray(n.marks)) {
        const marks: JMark[] = [];
        for (const m of n.marks) {
          if (!isObj(m) || typeof m.type !== "string" || !(m.type in MARKS)) continue;
          const markRule = MARKS[m.type];
          if (!markRule) {
            marks.push({ type: m.type });
            continue;
          }
          const attrs = markRule(isObj(m.attrs) ? m.attrs : {});
          if (attrs) marks.push({ type: m.type, attrs });
        }
        if (marks.length > 0) out.marks = marks;
      }
      return out;
    }

    if (Array.isArray(n.content)) {
      const children = n.content.map((c) => walk(c, depth + 1)).filter((c): c is JNode => c !== null);
      if (children.length > 0) out.content = children;
    }
    return out;
  };

  const doc = walk(input, 0) as JNode;
  // a document with nothing in it still needs one paragraph to put a caret in
  if (!doc.content || doc.content.length === 0) doc.content = [{ type: "paragraph" }];
  return doc;
}

export const EMPTY_DOC: JNode = { type: "doc", content: [{ type: "paragraph" }] };

export function cleanTitle(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX) : "";
}

/* ----------------------------------------------------------- plain text */

const TEXTBLOCKS = new Set(["paragraph", "heading", "codeBlock"]);

function inlineText(nodes: JNode[] | undefined): string {
  let s = "";
  for (const n of nodes ?? []) {
    if (n.type === "text") s += n.text ?? "";
    else if (n.type === "hardBreak") s += "\n";
    else s += inlineText(n.content);
  }
  return s;
}

/**
 * The words on a page, one line per block. Timestamps and dividers are left
 * out: searching for "16:30" should find what you wrote about half four, not
 * every afternoon you came back to the page.
 */
export function docToText(doc: JNode): string {
  const lines: string[] = [];
  const visit = (n: JNode) => {
    if (TEXTBLOCKS.has(n.type)) {
      lines.push(inlineText(n.content));
      return;
    }
    for (const c of n.content ?? []) visit(c);
  };
  visit(doc);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const CJK = /[぀-ヿ㐀-鿿豈-﫿가-힯]/g;

/**
 * Words, counted the way a writer would. Scripts written without spaces —
 * Chinese, Japanese, Korean — count a character as a word, or a full page of
 * Japanese would report itself as one.
 */
export function countWords(text: string): number {
  const cjk = (text.match(CJK) ?? []).length;
  const rest = text.replace(CJK, " ").match(/\S+/g)?.length ?? 0;
  return cjk + rest;
}

export function previewOf(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** Empty means nothing a person wrote: no words, no title, no mood. */
export function isEmptyPage(text: string, title: string, mood: Mood | null): boolean {
  return text.trim().length === 0 && title.trim().length === 0 && mood === null;
}

/* ------------------------------------------------------------- markdown */

function escapeMd(s: string): string {
  return s.replace(/([\\`*_~[\]])/g, "\\$1");
}

/** Marks wrap the words, never the spaces around them — `** word **` is not bold. */
function wrap(t: string, fence: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(t);
  if (!m || !m[2]) return t;
  return `${m[1]}${fence}${m[2]}${fence}${m[3]}`;
}

function mdInline(nodes: JNode[] | undefined): string {
  let out = "";
  for (const n of nodes ?? []) {
    if (n.type === "hardBreak") {
      out += "  \n";
      continue;
    }
    if (n.type !== "text") continue;
    const marks = n.marks ?? [];
    const has = (type: string) => marks.some((m) => m.type === type);
    let t: string;
    if (has("code")) {
      t = `\`${(n.text ?? "").replace(/`/g, "'")}\``;
    } else {
      t = escapeMd(n.text ?? "");
      if (has("bold")) t = wrap(t, "**");
      if (has("italic")) t = wrap(t, "_");
      if (has("strike")) t = wrap(t, "~~");
      if (has("highlight")) t = wrap(t, "==");
    }
    const link = marks.find((m) => m.type === "link");
    const href = link ? safeHref(link.attrs?.href) : null;
    out += href ? `[${t}](${href})` : t;
  }
  return out;
}

/** Stops a paragraph that begins with "#" or "-" turning into a heading or a list. */
function guardLineStart(s: string): string {
  return s.replace(/^(#{1,6}\s|[-+>]\s|\d+\.\s)/, "\\$1");
}

function mdListItem(item: JNode, indent: string, marker: string, shift: number): string {
  const [first, ...rest] = item.content ?? [];
  const lead = first && TEXTBLOCKS.has(first.type) ? mdInline(first.content) : "";
  const pad = indent + " ".repeat(marker.length);
  const tail = (first && !TEXTBLOCKS.has(first.type) ? [first, ...rest] : rest)
    .map((b) => mdBlock(b, pad, shift))
    .filter(Boolean);
  return [`${indent}${marker}${lead}`, ...tail].join("\n");
}

function mdBlock(n: JNode, indent: string, shift: number): string {
  switch (n.type) {
    case "paragraph":
      return indent + guardLineStart(mdInline(n.content));
    case "heading": {
      const level = Math.min(6, int(n.attrs?.level, 1, 3, 2) + shift);
      return `${indent}${"#".repeat(level)} ${mdInline(n.content)}`;
    }
    case "blockquote":
    case "callout": {
      const inner = (n.content ?? []).map((b) => mdBlock(b, "", shift)).join("\n\n");
      const emoji = n.type === "callout" ? `${String(n.attrs?.emoji ?? "💭")} ` : "";
      return (emoji + inner)
        .split("\n")
        .map((line) => `${indent}> ${line}`.trimEnd())
        .join("\n");
    }
    case "bulletList":
      return (n.content ?? []).map((li) => mdListItem(li, indent, "- ", shift)).join("\n");
    case "orderedList": {
      const start = int(n.attrs?.start, 1, 99_999, 1);
      return (n.content ?? []).map((li, i) => mdListItem(li, indent, `${start + i}. `, shift)).join("\n");
    }
    case "taskList":
      return (n.content ?? [])
        .map((li) => mdListItem(li, indent, li.attrs?.checked === true ? "- [x] " : "- [ ] ", shift))
        .join("\n");
    case "codeBlock": {
      const lang = typeof n.attrs?.language === "string" ? n.attrs.language : "";
      return `${indent}\`\`\`${lang}\n${inlineText(n.content)}\n${indent}\`\`\``;
    }
    case "horizontalRule":
      return `${indent}---`;
    case "entryTime":
      return `${indent}_— ${String(n.attrs?.time ?? "")}_`;
    default:
      return (n.content ?? []).map((b) => mdBlock(b, indent, shift)).join("\n\n");
  }
}

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
  const body = (entry.doc.content ?? [])
    .map((b) => mdBlock(b, "", depth + 1))
    .filter((s) => s.trim().length > 0)
    .join("\n\n");
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
