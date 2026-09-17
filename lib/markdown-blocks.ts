import { safeHref, type JMark, type JNode } from "./doc-model";

/**
 * The small, forgiving Markdown people and assistants naturally write, turned
 * into editor blocks: paragraphs, headings, quotes, lists (nested as written),
 * checkboxes, code fences, dividers, pictures and — where the page allows them
 * — tables. Anything else arrives as plain text, which is never wrong, just
 * unformatted.
 *
 * Used by the assistant tools that write pages, and by the notes editor when
 * Markdown is pasted in: copying a page out of Notion, a README off GitHub or
 * an answer out of a chat all put Markdown on the clipboard, and this is what
 * turns it back into real blocks.
 */

export type MarkdownOptions = {
  /** Journal pages have no tables; there a table stays as its lines of text. */
  tables?: boolean;
};

type ListKind = "bulletList" | "orderedList" | "taskList";

const INLINE_RE =
  /(`[^`\n]+`|\*\*\*[^*]+\*\*\*|___[^_]+___|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|!?\[[^\]\n]*\]\([^)\s]+\)|<https?:\/\/[^>\s]+>|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function inline(s: string): JNode[] {
  const out: JNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (text: string, marks?: JMark[]) => {
    // a backslash before a marker meant "print this", so it goes away here
    const clean = text.replace(/\\([\\`*_~[\]()#>!-])/g, "$1");
    if (clean) out.push(marks ? { type: "text", text: clean, marks } : { type: "text", text: clean });
  };
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(s))) {
    if (m.index > last) push(s.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("`")) {
      push(token.slice(1, -1), [{ type: "code" }]);
    } else if (token.startsWith("***") || token.startsWith("___")) {
      push(token.slice(3, -3), [{ type: "bold" }, { type: "italic" }]);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      push(token.slice(2, -2), [{ type: "bold" }]);
    } else if (token.startsWith("~~")) {
      push(token.slice(2, -2), [{ type: "strike" }]);
    } else if (token.startsWith("<")) {
      const href = safeHref(token.slice(1, -1));
      if (href) push(token.slice(1, -1), [{ type: "link", attrs: { href } }]);
      else push(token);
    } else if (token.startsWith("[") || token.startsWith("![")) {
      // a picture inside a line of text has no block of its own to sit in: its words stay, linked
      const link = /^!?\[([^\]]*)\]\(([^)\s]+)\)$/.exec(token);
      const href = link ? safeHref(link[2]) : null;
      if (link && href) push(link[1] || href, [{ type: "link", attrs: { href } }]);
      else push(token);
    } else {
      push(token.slice(1, -1), [{ type: "italic" }]);
    }
    last = m.index + token.length;
  }
  if (last < s.length) push(s.slice(last));
  return out;
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

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/;
const IMAGE_LINE = /^\s*!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})\s*([a-z0-9+#.-]{0,24})\s*$/i;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
/** A bullet: Markdown dashes and stars, and the bullet characters a rich editor pastes. */
const BULLET = /^(\s*)(?:[-*+]|[•‣▪◦])\s+(.*)$/;
const TODO = /^(\s*)(?:[-*+]|[•‣▪◦])?\s*\[( |x|X)\]\s+(.*)$/;
const NUMBER = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;

const indentOf = (raw: string) => raw.replace(/\t/g, "    ").match(/^ */)![0].length;

type Line = { raw: string; text: string };

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.replace(/\\\|/g, "|").trim());
}

/**
 * One list, and everything nested under it. Deeper lines become a list inside
 * the item above them, exactly as they were written; a plain line that is
 * indented under an item joins that item.
 */
function readList(lines: Line[], start: number, options: MarkdownOptions): { node: JNode; next: number } {
  const first = lines[start];
  const baseIndent = indentOf(first.raw);
  const kindOf = (line: string): { kind: ListKind; body: string; checked?: boolean; start?: number } | null => {
    let m: RegExpExecArray | null;
    if ((m = TODO.exec(line))) return { kind: "taskList", body: m[3], checked: m[2].toLowerCase() === "x" };
    if ((m = BULLET.exec(line))) return { kind: "bulletList", body: m[2] };
    if ((m = NUMBER.exec(line))) return { kind: "orderedList", body: m[3], start: Number(m[2]) };
    return null;
  };

  const head = kindOf(first.raw)!;
  const kind = head.kind;
  const items: JNode[] = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.text.trim()) {
      // a blank line ends the list unless the next line carries on inside it
      const next = lines[i + 1];
      if (!next || !next.text.trim() || (indentOf(next.raw) <= baseIndent && !kindOf(next.raw))) break;
      i++;
      continue;
    }
    const indent = indentOf(line.raw);
    if (indent < baseIndent) break;
    const parsed = kindOf(line.raw);
    if (!parsed || indent > baseIndent + 1) {
      if (items.length === 0) break;
      // deeper: a list of its own, tucked inside the item above
      if (parsed) {
        const inner = readList(lines, i, options);
        (items[items.length - 1].content ??= []).push(inner.node);
        i = inner.next;
        continue;
      }
      // a wrapped line: part of the item above
      const item = items[items.length - 1];
      const para = item.content?.[0];
      if (para?.type === "paragraph") {
        para.content = [...(para.content ?? []), { type: "hardBreak" }, ...inline(line.text.trim())];
      }
      i++;
      continue;
    }
    if (parsed.kind !== kind) break;
    items.push({
      type: kind === "taskList" ? "taskItem" : "listItem",
      ...(kind === "taskList" ? { attrs: { checked: parsed.checked === true } } : {}),
      content: [paragraph([parsed.body])],
    });
    i++;
  }

  const node: JNode =
    kind === "orderedList" ? { type: "orderedList", attrs: { start: head.start ?? 1 }, content: items } : { type: kind, content: items };
  return { node, next: i };
}

export function markdownToBlocks(md: string, options: MarkdownOptions = {}): JNode[] {
  const blocks: JNode[] = [];
  const lines: Line[] = md.replace(/\r\n?/g, "\n").split("\n").map((raw) => ({ raw, text: raw.trimEnd() }));
  let para: string[] = [];

  const endPara = () => {
    if (para.length) blocks.push(paragraph(para));
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const { raw, text } = lines[i];
    let m: RegExpExecArray | null;

    if ((m = FENCE.exec(text))) {
      endPara();
      const marker = m[1][0];
      const code: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${marker}{3,}\\s*$`).test(lines[i].text)) code.push(lines[i++].raw);
      const body = code.join("\n");
      blocks.push({ type: "codeBlock", attrs: { language: m[2] || null }, ...(body ? { content: [{ type: "text", text: body }] } : {}) });
      continue;
    }

    if ((m = IMAGE_LINE.exec(text))) {
      endPara();
      blocks.push({ type: "image", attrs: { src: m[2], alt: m[1] || null, width: 100 } });
      continue;
    }

    if (options.tables && TABLE_ROW.test(text) && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1].text)) {
      endPara();
      const header = tableCells(text);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i].text)) rows.push(tableCells(lines[i++].text));
      i--;
      const width = Math.min(20, Math.max(header.length, ...rows.map((r) => r.length)));
      const cell = (type: "tableHeader" | "tableCell", value: string): JNode => ({
        type,
        attrs: { colspan: 1, rowspan: 1, colwidth: null },
        content: [paragraph([value])],
      });
      const row = (type: "tableHeader" | "tableCell", cells: string[]): JNode => ({
        type: "tableRow",
        content: Array.from({ length: width }, (_, c) => cell(type, cells[c] ?? "")),
      });
      blocks.push({ type: "table", content: [row("tableHeader", header), ...rows.map((r) => row("tableCell", r))] });
      continue;
    }

    if (!text.trim()) {
      endPara();
      continue;
    }

    if (RULE.test(text)) {
      endPara();
      blocks.push({ type: "horizontalRule" });
      continue;
    }

    if ((m = HEADING.exec(text))) {
      endPara();
      blocks.push({ type: "heading", attrs: { level: Math.min(3, m[1].length) }, content: inline(m[2]) });
      continue;
    }

    if (QUOTE.test(text)) {
      endPara();
      // every line of the quote, together, rather than one quote per line
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i].text)) quoted.push(QUOTE.exec(lines[i++].text)![1]);
      i--;
      const inner = markdownToBlocks(quoted.join("\n"), options);
      blocks.push({ type: "blockquote", content: inner.length ? inner : [paragraph([""])] });
      continue;
    }

    if (TODO.test(raw) || BULLET.test(raw) || NUMBER.test(raw)) {
      endPara();
      const { node, next } = readList(lines, i, options);
      blocks.push(node);
      i = next - 1;
      continue;
    }

    para.push(text.trim());
  }
  endPara();
  return blocks;
}

/** Whether pasted text reads as Markdown worth converting, rather than prose that happens to contain a dash. */
export function looksLikeMarkdown(text: string): boolean {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2 && !/^(#{1,3}\s|```)/.test(text)) return false;
  let signals = 0;
  for (const line of lines) {
    if (/^(#{1,6}\s|\s*[-*+•‣▪◦]\s\[[ xX]\]\s|\s*[-*+•‣▪◦]\s|\s*\d+[.)]\s|>\s|```|\s*\|.*\|\s*$)/.test(line)) signals++;
    if (/\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|!\[[^\]]*\]\([^)]+\)/.test(line)) signals++;
  }
  return signals >= 2;
}
