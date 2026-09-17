/**
 * The document model every Kairo editor shares: the JSON a page is stored as,
 * the sanitiser that rebuilds a page from known parts, and the plain-text and
 * Markdown views of it.
 *
 * Pure on purpose — no database, no DOM — so the rules that decide what the API
 * will store are the same rules that decide what the word count says and what
 * an export writes. They cannot disagree, because there is only one.
 *
 * Pages are stored as the editor's own JSON rather than HTML. HTML would have
 * to be sanitised on every read, forever; a document tree is checked once, on
 * the way in, against a short list of things a page can contain. Each editor
 * (the journal, notes) brings its own list; the checking is done here.
 */

import { isIconKey } from "./icons";

export type JMark = { type: string; attrs?: Record<string, unknown> };
export type JNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JNode[];
  text?: string;
  marks?: JMark[];
};

export const EMPTY_DOC: JNode = { type: "doc", content: [{ type: "paragraph" }] };

/**
 * The page as an editor will hold it: ending in a paragraph. The editors keep
 * a trailing paragraph so there is always somewhere to type after a table or a
 * list — and if a page arrives without one, the editor adds it on the first
 * transaction of any kind, even a click. That counts as an edit, so opening a
 * page would save it and bump its version. Opening it in this shape instead
 * means reading a page never writes to it.
 */
export function withTrailingParagraph(doc: JNode): JNode {
  const last = doc.content?.[doc.content.length - 1];
  if (last?.type === "paragraph") return doc;
  return { ...doc, content: [...(doc.content ?? []), { type: "paragraph" }] };
}

/* ------------------------------------------------------------ highlights */

/**
 * Highlights and text colours are stored as CSS variables, not colours. A hex
 * picked on a light theme is a glare on a dark one; a variable is redefined
 * per theme, so an old page opened in dark mode reads correctly without being
 * rewritten.
 */
export const HIGHLIGHTS = ["sun", "amber", "rose", "lilac", "sky", "moss"] as const;
export type HighlightName = (typeof HIGHLIGHTS)[number];
export const highlightVar = (name: HighlightName) => `var(--hl-${name})`;
export const HIGHLIGHT_RE = new RegExp(`^var\\(--hl-(${HIGHLIGHTS.join("|")})\\)$`);

export const TEXT_COLORS = ["gray", "amber", "rose", "lilac", "sky", "moss", "sun"] as const;
export type TextColorName = (typeof TEXT_COLORS)[number];
export const textColorVar = (name: TextColorName) => `var(--tc-${name})`;
export const TEXT_COLOR_RE = new RegExp(`^var\\(--tc-(${TEXT_COLORS.join("|")})\\)$`);

/* ------------------------------------------------------------ sanitiser */

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function int(v: unknown, min: number, max: number, fallback: number): number {
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

/** Keeps the attributes a node may carry. Null: the node carries none. */
export type AttrRule = ((a: Record<string, unknown>) => Record<string, unknown>) | null;
/** A rule returning null drops the mark but keeps the words. */
export type MarkRule = ((a: Record<string, unknown>) => Record<string, unknown> | null) | null;

/** The blocks and inline nodes both editors understand. */
export const BASE_NODES: Record<string, AttrRule> = {
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
  // a callout carries one icon key or emoji; anything longer is a smuggled string
  callout: (a) => ({
    emoji: typeof a.emoji === "string" && a.emoji.length > 0 && a.emoji.length <= 16 ? a.emoji : "💭",
  }),
};

export const BASE_MARKS: Record<string, MarkRule> = {
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

export type DocSchema = {
  nodes: Record<string, AttrRule>;
  marks: Record<string, MarkRule>;
  /** Serialised JSON, in characters. */
  maxBytes: number;
  maxDepth: number;
  maxNodes: number;
  /** Builds the error a refused document is reported with. */
  fail: (message: string) => Error;
};

/**
 * Builds the function that checks a page from an editor and rebuilds it from
 * known parts.
 *
 * Unknown blocks are refused rather than silently dropped: the editor cannot
 * produce one, so meeting one means a client that is lying, and quietly
 * deleting part of someone's page would be the worse failure. Unknown
 * attributes, by contrast, are just not copied — they carry no words.
 */
export function createNormalizer(schema: DocSchema): (input: unknown) => JNode {
  const { nodes, marks, fail } = schema;
  return (input: unknown): JNode => {
    if (!isObj(input) || input.type !== "doc") throw fail("That page isn't a document.");
    if (JSON.stringify(input).length > schema.maxBytes) throw fail("That page is too long to save in one piece.");

    let count = 0;
    const walk = (n: unknown, depth: number): JNode | null => {
      if (depth > schema.maxDepth) throw fail("That page is nested too deeply.");
      if (++count > schema.maxNodes) throw fail("That page has too many pieces.");
      if (!isObj(n) || typeof n.type !== "string") throw fail("A block on that page is malformed.");
      if (!Object.hasOwn(nodes, n.type)) throw fail(`A page can't contain "${n.type}".`);

      const out: JNode = { type: n.type };
      const rule = nodes[n.type];
      if (rule) out.attrs = rule(isObj(n.attrs) ? n.attrs : {});

      if (n.type === "text") {
        // ProseMirror refuses empty text nodes; an empty one is dropped, not an error
        if (typeof n.text !== "string" || n.text.length === 0) return null;
        out.text = n.text;
        if (Array.isArray(n.marks)) {
          const kept: JMark[] = [];
          for (const m of n.marks) {
            if (!isObj(m) || typeof m.type !== "string" || !Object.hasOwn(marks, m.type)) continue;
            const markRule = marks[m.type];
            if (!markRule) {
              kept.push({ type: m.type });
              continue;
            }
            const attrs = markRule(isObj(m.attrs) ? m.attrs : {});
            if (attrs) kept.push({ type: m.type, attrs });
          }
          if (kept.length > 0) out.marks = kept;
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
  };
}

/* ----------------------------------------------------------- plain text */

const TEXTBLOCKS = new Set(["paragraph", "heading", "codeBlock", "detailsSummary"]);

export function inlineText(nodes: JNode[] | undefined): string {
  let s = "";
  for (const n of nodes ?? []) {
    if (n.type === "text") s += n.text ?? "";
    else if (n.type === "hardBreak") s += "\n";
    else if (n.type === "pageMention") s += typeof n.attrs?.label === "string" ? n.attrs.label : "";
    // A task chip's title is a copy of a task that may later sit in a locked
    // list, so it is never part of a page's searchable text. (Markdown export
    // writes it, after the server has hidden the ones this viewer can't see.)
    else if (n.type === "taskRef") s += "";
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
    // a pasted link has no text of its own, but a page is findable by what the card says
    if (n.type === "linkPreview") {
      const title = typeof n.attrs?.title === "string" ? n.attrs.title : "";
      const url = typeof n.attrs?.url === "string" ? n.attrs.url : "";
      lines.push([title, url].filter(Boolean).join(" "));
      return;
    }
    for (const c of n.content ?? []) visit(c);
  };
  visit(doc);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const CJK = /[぀-ヿ㐀-鿿豈-﫿가-힯]/g;

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

/* ------------------------------------------------------------- markdown */

export function escapeMd(s: string): string {
  return s.replace(/([\\`*_~[\]])/g, "\\$1");
}

/** Marks wrap the words, never the spaces around them — `** word **` is not bold. */
function wrap(t: string, fence: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(t);
  if (!m || !m[2]) return t;
  return `${m[1]}${fence}${m[2]}${fence}${m[3]}`;
}

export type MdContext = {
  /** How far a page's own headings step down, so they nest beneath its title. */
  shift: number;
  /** The current title of a linked page, when the exporter knows it. */
  titleOf?: (id: string) => string | null;
};

function linkedTitle(ctx: MdContext, id: unknown, fallback: unknown): string {
  const known = typeof id === "string" ? ctx.titleOf?.(id) : null;
  if (known) return known;
  return typeof fallback === "string" && fallback ? fallback : "Untitled";
}

function mdInline(nodes: JNode[] | undefined, ctx: MdContext): string {
  let out = "";
  for (const n of nodes ?? []) {
    if (n.type === "hardBreak") {
      out += "  \n";
      continue;
    }
    if (n.type === "pageMention") {
      out += `@${escapeMd(linkedTitle(ctx, n.attrs?.id, n.attrs?.label))}`;
      continue;
    }
    if (n.type === "taskRef") {
      out += `☐ ${escapeMd(typeof n.attrs?.title === "string" ? n.attrs.title : "Task")}`;
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

function mdListItem(item: JNode, indent: string, marker: string, ctx: MdContext): string {
  const [first, ...rest] = item.content ?? [];
  const lead = first && TEXTBLOCKS.has(first.type) ? mdInline(first.content, ctx) : "";
  const pad = indent + " ".repeat(marker.length);
  const tail = (first && !TEXTBLOCKS.has(first.type) ? [first, ...rest] : rest)
    .map((b) => mdBlock(b, pad, ctx))
    .filter(Boolean);
  return [`${indent}${marker}${lead}`, ...tail].join("\n");
}

function mdTable(n: JNode, indent: string, ctx: MdContext): string {
  const rows = (n.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? [])
        .map((b) => mdInline(b.content, ctx))
        .join(" ")
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ")
        .trim()
    )
  );
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length), 1);
  const line = (cells: string[]) =>
    `${indent}| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  return [line(rows[0]), `${indent}|${" --- |".repeat(width)}`, ...rows.slice(1).map(line)].join("\n");
}

function mdBlock(n: JNode, indent: string, ctx: MdContext): string {
  switch (n.type) {
    case "paragraph":
      return indent + guardLineStart(mdInline(n.content, ctx));
    case "heading": {
      const level = Math.min(6, int(n.attrs?.level, 1, 3, 2) + ctx.shift);
      return `${indent}${"#".repeat(level)} ${mdInline(n.content, ctx)}`;
    }
    case "blockquote":
    case "callout": {
      const inner = (n.content ?? []).map((b) => mdBlock(b, "", ctx)).join("\n\n");
      // an icon is a picture on the page; Markdown keeps only an emoji
      const mark = n.type === "callout" ? String(n.attrs?.emoji ?? "💭") : "";
      const lead = mark && !isIconKey(mark) ? `${mark} ` : "";
      return (lead + inner)
        .split("\n")
        .map((line) => `${indent}> ${line}`.trimEnd())
        .join("\n");
    }
    case "bulletList":
      return (n.content ?? []).map((li) => mdListItem(li, indent, "- ", ctx)).join("\n");
    case "orderedList": {
      const start = int(n.attrs?.start, 1, 99_999, 1);
      return (n.content ?? []).map((li, i) => mdListItem(li, indent, `${start + i}. `, ctx)).join("\n");
    }
    case "taskList":
      return (n.content ?? [])
        .map((li) => mdListItem(li, indent, li.attrs?.checked === true ? "- [x] " : "- [ ] ", ctx))
        .join("\n");
    case "codeBlock": {
      const lang = typeof n.attrs?.language === "string" ? n.attrs.language : "";
      return `${indent}\`\`\`${lang}\n${inlineText(n.content)}\n${indent}\`\`\``;
    }
    case "linkPreview": {
      const url = typeof n.attrs?.url === "string" ? n.attrs.url : "";
      const title = typeof n.attrs?.title === "string" && n.attrs.title ? n.attrs.title : url;
      return url ? `${indent}[${escapeMd(title)}](${url})` : "";
    }
    case "horizontalRule":
      return `${indent}---`;
    case "entryTime":
      return `${indent}_— ${String(n.attrs?.time ?? "")}_`;
    case "details": {
      const [summary, content] = n.content ?? [];
      const body = (content?.content ?? []).map((b) => mdBlock(b, "", ctx)).join("\n\n");
      return [
        `${indent}<details>`,
        `${indent}<summary>${mdInline(summary?.content, ctx)}</summary>`,
        "",
        body,
        "",
        `${indent}</details>`,
      ].join("\n");
    }
    case "table":
      return mdTable(n, indent, ctx);
    case "pageLink":
      return `${indent}📄 ${escapeMd(linkedTitle(ctx, n.attrs?.id, null))}`;
    default:
      return (n.content ?? []).map((b) => mdBlock(b, indent, ctx)).join("\n\n");
  }
}

/** A run of blocks as Markdown, blank-line separated, empty blocks left out. */
export function blocksToMarkdown(blocks: JNode[] | undefined, ctx: MdContext): string {
  return (blocks ?? [])
    .map((b) => mdBlock(b, "", ctx))
    .filter((s) => s.trim().length > 0)
    .join("\n\n");
}
