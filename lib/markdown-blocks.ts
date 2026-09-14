import { safeHref, type JMark, type JNode } from "./doc-model";

/**
 * The small, forgiving Markdown people and assistants naturally write, turned
 * into editor blocks: paragraphs, headings, quotes, lists, checkboxes, code
 * fences, dividers and — where the page allows them — tables. Anything else
 * arrives as plain text, which is never wrong, just unformatted.
 *
 * Used by the assistant tools that write pages, and by the notes editor when
 * Markdown is pasted in.
 */

export type MarkdownOptions = {
  /** Journal pages have no tables; there a table stays as its lines of text. */
  tables?: boolean;
};

const INLINE_RE = /(`[^`\n]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\[[^\]\n]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function inline(s: string): JNode[] {
  const out: JNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (text: string, marks?: JMark[]) => {
    if (text) out.push(marks ? { type: "text", text, marks } : { type: "text", text });
  };
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(s))) {
    if (m.index > last) push(s.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("`")) {
      push(token.slice(1, -1), [{ type: "code" }]);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      push(token.slice(2, -2), [{ type: "bold" }]);
    } else if (token.startsWith("~~")) {
      push(token.slice(2, -2), [{ type: "strike" }]);
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const href = link ? safeHref(link[2]) : null;
      if (link && href) push(link[1], [{ type: "link", attrs: { href } }]);
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

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.replace(/\\\|/g, "|").trim());
}

export function markdownToBlocks(md: string, options: MarkdownOptions = {}): JNode[] {
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

  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    let m: RegExpExecArray | null;

    if ((m = /^\s*```\s*([a-z0-9+#.-]{0,24})\s*$/i.exec(line))) {
      endPara();
      endList();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      const text = code.join("\n");
      blocks.push({
        type: "codeBlock",
        attrs: { language: m[1] || null },
        ...(text ? { content: [{ type: "text", text }] } : {}),
      });
      continue;
    }

    if (options.tables && TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
      endPara();
      endList();
      const header = tableCells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i])) rows.push(tableCells(lines[i++]));
      i--;
      const width = Math.min(20, Math.max(header.length, ...rows.map((r) => r.length)));
      const cell = (type: "tableHeader" | "tableCell", text: string): JNode => ({
        type,
        attrs: { colspan: 1, rowspan: 1, colwidth: null },
        content: [paragraph([text])],
      });
      const row = (type: "tableHeader" | "tableCell", cells: string[]): JNode => ({
        type: "tableRow",
        content: Array.from({ length: width }, (_, c) => cell(type, cells[c] ?? "")),
      });
      blocks.push({ type: "table", content: [row("tableHeader", header), ...rows.map((r) => row("tableCell", r))] });
      continue;
    }

    if (!line.trim()) {
      endPara();
      endList();
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      endPara();
      endList();
      blocks.push({ type: "horizontalRule" });
    } else if ((m = /^(#{1,6})\s+(.+)$/.exec(line))) {
      endPara();
      endList();
      blocks.push({ type: "heading", attrs: { level: Math.min(3, m[1].length) }, content: inline(m[2]) });
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      endPara();
      endList();
      blocks.push({ type: "blockquote", content: [paragraph([m[1]])] });
    } else if ((m = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/.exec(line))) {
      item("taskList", m[2], m[1].toLowerCase() === "x");
    } else if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) {
      item("bulletList", m[1]);
    } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
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

/** Whether pasted text reads as Markdown worth converting, rather than prose that happens to contain a dash. */
export function looksLikeMarkdown(text: string): boolean {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2 && !/^(#{1,3}\s|```)/.test(text)) return false;
  let signals = 0;
  for (const line of lines) {
    if (/^(#{1,6}\s|\s*[-*+]\s\[[ xX]\]\s|\s*[-*+]\s|\s*\d+[.)]\s|>\s|```|\s*\|.*\|\s*$)/.test(line)) signals++;
    if (/\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)/.test(line)) signals++;
  }
  return signals >= 2;
}
