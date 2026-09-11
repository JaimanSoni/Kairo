import { getEntry, listSummaries, saveEntry, searchEntries } from "../journal";
import {
  docToText,
  entryToMarkdown,
  isRealDate,
  JournalContentError,
  longDate,
  moodOf,
  MOODS,
  type JNode,
  type Mood,
} from "../journal-shared";
import { canWrite, type McpContext } from "./context";
import { ToolFail } from "./fail";
import { json, text, type JsonSchema } from "./protocol";
import { optDate, optEnum, optInt, optString, reqString, type Args } from "./args";
import type { Tool } from "./tools";

/**
 * The journal, over MCP — for keys that were created with it ticked.
 *
 * Three tools and no delete. Reading, searching and adding cover "what did I
 * write last week?" and "journal for me: today was…". Deleting a page of
 * someone's diary is not a thing to hand an assistant that can misread a
 * sentence; it stays a deliberate tap in the app.
 *
 * A key with the journal ticked is the user's explicit consent, so these
 * tools do not stop at the journal's PIN. That trade is stated where the box
 * is ticked.
 */

function obj(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
  return { type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false };
}

const dateField = (description: string): JsonSchema => ({
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  description,
});

const MOOD_NAMES = MOODS.map((m) => m.label.toLowerCase()) as [string, ...string[]];

function addDaysStr(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A day to act on: the one asked for, or today — never a day that hasn't happened. */
function dayArg(ctx: McpContext, args: Args, key = "date"): string {
  const date = optDate(args, key) ?? ctx.today;
  if (!isRealDate(date)) throw new ToolFail(`${key} is not a real date.`);
  if (date > ctx.today) {
    throw new ToolFail(`${longDate(date)} hasn't happened yet for this user — today is ${longDate(ctx.today)}.`);
  }
  return date;
}

/* ------------------------------------------------------- markdown → page */

function inline(s: string): JNode[] {
  const out: JNode[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ type: "text", text: s.slice(last, m.index) });
    const token = m[0];
    const bold = token.startsWith("**") || token.startsWith("__");
    out.push({ type: "text", text: bold ? token.slice(2, -2) : token.slice(1, -1), marks: [{ type: bold ? "bold" : "italic" }] });
    last = m.index + token.length;
  }
  if (last < s.length) out.push({ type: "text", text: s.slice(last) });
  return out.filter((n) => n.text);
}

/** Lines of one paragraph keep their breaks — a diary is not reflowed prose. */
function paragraph(lines: string[]): JNode {
  const content: JNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) content.push({ type: "hardBreak" });
    content.push(...inline(line));
  });
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

/**
 * The small, forgiving Markdown an assistant naturally writes: paragraphs,
 * headings, quotes, bullets, numbers and checkboxes. Anything else arrives as
 * plain text, which is never wrong — just unformatted.
 */
export function markdownToBlocks(md: string): JNode[] {
  const blocks: JNode[] = [];
  let para: string[] = [];
  let list: { kind: "bulletList" | "orderedList" | "taskList"; items: JNode[] } | null = null;

  const endPara = () => {
    if (para.length) blocks.push(paragraph(para));
    para = [];
  };
  const endList = () => {
    if (list) {
      blocks.push(
        list.kind === "orderedList"
          ? { type: "orderedList", attrs: { start: 1 }, content: list.items }
          : { type: list.kind, content: list.items }
      );
    }
    list = null;
  };
  const item = (kind: "bulletList" | "orderedList" | "taskList", body: string, checked?: boolean) => {
    endPara();
    if (!list || list.kind !== kind) {
      endList();
      list = { kind, items: [] };
    }
    const node: JNode =
      kind === "taskList"
        ? { type: "taskItem", attrs: { checked: Boolean(checked) }, content: [paragraph([body])] }
        : { type: "listItem", content: [paragraph([body])] };
    list.items.push(node);
  };

  for (const raw of md.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    let m: RegExpExecArray | null;
    if (!line.trim()) {
      endPara();
      endList();
    } else if ((m = /^(#{1,3})\s+(.+)$/.exec(line))) {
      endPara();
      endList();
      blocks.push({ type: "heading", attrs: { level: m[1].length }, content: inline(m[2]) });
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      endPara();
      endList();
      blocks.push({ type: "blockquote", content: [paragraph([m[1]])] });
    } else if ((m = /^[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line))) {
      item("taskList", m[2], m[1].toLowerCase() === "x");
    } else if ((m = /^[-*]\s+(.*)$/.exec(line))) {
      item("bulletList", m[1]);
    } else if ((m = /^\d+[.)]\s+(.*)$/.exec(line))) {
      item("orderedList", m[1]);
    } else {
      endList();
      para.push(line.trim());
    }
  }
  endPara();
  endList();
  return blocks;
}

/* ---------------------------------------------------------------- tools */

const journalRead: Tool = {
  name: "journal_read",
  title: "Read a journal page",
  journal: true,
  write: false,
  annotations: { readOnlyHint: true },
  description:
    "Read one day's page of the user's private journal, as Markdown. Only call this when the user asks about their journal. Defaults to today.",
  inputSchema: obj({ date: dateField("The day to read, YYYY-MM-DD. Defaults to today in the user's time zone.") }),
  run: async (ctx, _scope, args) => {
    const date = dayArg(ctx, args);
    const entry = await getEntry(ctx.userId, date);
    if (!entry) return text(`Nothing is written in the journal for ${longDate(date)}.`);
    return text(entryToMarkdown(entry, 1));
  },
};

const journalSearch: Tool = {
  name: "journal_search",
  title: "Search the journal",
  journal: true,
  write: false,
  annotations: { readOnlyHint: true },
  description:
    "Find pages in the user's private journal. With a query, returns pages containing those words and the passage each was found in. Without one, lists the pages written between two dates (the last two weeks by default). Only call this when the user asks about their journal.",
  inputSchema: obj({
    query: { type: "string", maxLength: 100, description: "Exact words or a phrase to look for. Case doesn't matter." },
    from: dateField("Without a query: the first day to list."),
    to: dateField("Without a query: the last day to list. Defaults to today."),
    limit: { type: "integer", minimum: 1, maximum: 50, description: "Default 20." },
  }),
  run: async (ctx, _scope, args) => {
    const limit = optInt(args, "limit", 1, 50) ?? 20;
    const query = optString(args, "query", 100)?.trim();
    const moodName = (m: Mood | null) => moodOf(m)?.label ?? null;

    if (query) {
      const hits = await searchEntries(ctx.userId, query, limit);
      return json({
        query,
        count: hits.length,
        results: hits.map((h) => ({
          date: h.date,
          day: longDate(h.date),
          ...(h.title ? { title: h.title } : {}),
          ...(h.mood ? { mood: moodName(h.mood) } : {}),
          words: h.words,
          passage: h.snippet,
        })),
      });
    }

    const to = dayArg(ctx, args, "to");
    const from = optDate(args, "from") ?? addDaysStr(to, -13);
    if (from > to) throw new ToolFail("from must be on or before to.");
    const pages = (await listSummaries(ctx.userId, from, to)).slice(0, limit);
    return json({
      from,
      to,
      count: pages.length,
      pages: pages.map((p) => ({
        date: p.date,
        day: longDate(p.date),
        ...(p.title ? { title: p.title } : {}),
        ...(p.mood ? { mood: moodName(p.mood) } : {}),
        words: p.words,
        preview: p.preview,
      })),
    });
  },
};

const journalWrite: Tool = {
  name: "journal_write",
  title: "Write in the journal",
  journal: true,
  write: true,
  description:
    "Add to a page of the user's private journal — only when they ask you to write something there, and in their words, not yours. By default the text is appended to the day's page under the current time, leaving what's already there untouched. Use mode 'replace' only when the user explicitly asks to rewrite the whole page. Blank lines separate paragraphs; lines starting with '# ' become headings, '> ' quotes, '- ' bullets, '1. ' numbered items and '- [ ] ' checkboxes.",
  inputSchema: obj(
    {
      text: { type: "string", maxLength: 20000, description: "What to write." },
      date: dateField("The day's page to write on, YYYY-MM-DD. Defaults to today."),
      mode: {
        type: "string",
        enum: ["append", "replace"],
        description: "append (default) adds under the current time; replace swaps out the whole page.",
      },
      mood: { type: "string", enum: MOOD_NAMES, description: "The day's weather, if the user said how it felt." },
      title: { type: "string", maxLength: 140, description: "A title for the page, if the user gave one." },
    },
    ["text"]
  ),
  run: async (ctx, _scope, args) => {
    if (!canWrite(ctx)) {
      throw new ToolFail("This connection is read-only, so it can't write in the journal.");
    }
    const date = dayArg(ctx, args);
    const blocks = markdownToBlocks(reqString(args, "text", 20000));
    if (blocks.length === 0) throw new ToolFail("There's nothing to write.");
    const mode = optEnum(args, "mode", ["append", "replace"] as const) ?? "append";
    const moodArg = optEnum(args, "mood", MOOD_NAMES);
    const mood = moodArg ? (MOODS.findIndex((m) => m.label.toLowerCase() === moodArg) + 1) as Mood : undefined;
    const title = optString(args, "title", 140);

    // One retry: if the page moved on between reading and writing — the app
    // saved while this call was in flight — append to the newer version rather
    // than overwrite it.
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await getEntry(ctx.userId, date);
      const existing = current?.doc.content ?? [];
      const hasWords = current ? docToText(current.doc).trim().length > 0 : false;
      const content =
        mode === "replace" || !hasWords
          ? blocks
          : [...existing, { type: "entryTime", attrs: { time: ctx.clock } }, ...blocks];

      try {
        const result = await saveEntry(
          ctx.userId,
          date,
          {
            title: title ?? current?.title ?? "",
            doc: { type: "doc", content },
            mood: mood ?? current?.mood ?? null,
          },
          current?.version ?? 0
        );
        if (result.ok) {
          return json({
            saved: longDate(date),
            mode: mode === "replace" || !hasWords ? (current ? "replaced" : "created") : "appended",
            words: result.entry?.words ?? 0,
          });
        }
        if (result.reason === "empty") {
          throw new ToolFail("That would leave the page empty. Write something, or delete the page in Kairo.");
        }
      } catch (err) {
        if (err instanceof JournalContentError) throw new ToolFail(err.message);
        throw err;
      }
    }
    throw new ToolFail("That page kept changing while writing to it. Try again in a moment.");
  },
};

export const JOURNAL_TOOLS: Tool[] = [journalRead, journalSearch, journalWrite];
