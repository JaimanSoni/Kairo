/**
 * The notes content model, shared by the server, the editor, the assistant
 * tools and the export.
 *
 * A note is a page in a tree: it can hold sub-pages, and its body is built
 * from blocks — the ones every Kairo editor has, plus toggles, tables, links
 * to other pages and live Kairo tasks.
 */

import {
  BASE_MARKS,
  BASE_NODES,
  blocksToMarkdown,
  createNormalizer,
  escapeMd,
  int,
  isObj,
  TEXT_COLOR_RE,
  type AttrRule,
  type JNode,
} from "./doc-model";
import { pageIconKey } from "./icons";

/* ---------------------------------------------------------------- limits */

export const NOTE_TITLE_MAX = 200;
/** Serialised JSON. Notes run longer than diary pages: specs, wikis, reading notes. */
export const NOTE_DOC_MAX_BYTES = 800_000;
/** Every page an account holds, trash included. Enough for a life's notes, not for a scraper. */
export const MAX_NOTES = 5000;
/** How deep pages may nest. Notion allows more; nobody navigates past this. */
export const MAX_NOTE_DEPTH = 20;
/** A duplicate copies a page with its sub-pages, up to this many at once. */
export const MAX_DUPLICATE = 200;
/** Trash empties itself of anything older than this. */
export const TRASH_DAYS = 30;

export class NoteContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoteContentError";
  }
}

/* ----------------------------------------------------------------- types */

export type NoteFont = "sans" | "serif" | "mono";
export const NOTE_FONTS: NoteFont[] = ["sans", "serif", "mono"];

/** A page as the tree, the home and search know it — everything but the body. */
export type NoteMeta = {
  id: string;
  parentId: string | null;
  /** Order among siblings. Only its relation to other ranks means anything. */
  rank: number;
  title: string;
  icon: string | null;
  cover: string | null;
  favorite: boolean;
  fullWidth: boolean;
  smallText: boolean;
  font: NoteFont;
  /** Locked pages can be read but not edited until unlocked. */
  locked: boolean;
  words: number;
  createdAt: string;
  updatedAt: string;
};

/** A whole page, as the editor loads it. */
export type NotePage = NoteMeta & {
  doc: JNode;
  /** Bumped on every body save. A save carries the version it started from. */
  version: number;
  trashedAt: string | null;
};

export type NoteRef = { id: string; title: string; icon: string | null };

export type TrashItem = NoteRef & {
  trashedAt: string;
  /** The page and every sub-page that went to the trash with it. */
  pages: number;
  /** Where it lived, when that page still exists. */
  parentTitle: string | null;
};

export type NoteSearchHit = NoteRef & {
  parentId: string | null;
  snippet: string;
  updatedAt: string;
};

export type NoteMetaPatch = Partial<
  Pick<NoteMeta, "title" | "icon" | "cover" | "favorite" | "fullWidth" | "smallText" | "font" | "locked">
>;

export const isNoteId = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{24}$/.test(v);

/* ---------------------------------------------------------------- covers */

/**
 * Covers are named gradients, not uploads. A key is all a page stores, so a
 * cover can be redrawn — or a palette retuned — without touching a single page.
 */
export const COVERS: { key: string; label: string; css: string }[] = [
  { key: "lagoon", label: "Lagoon", css: "linear-gradient(120deg, #0c9384 0%, #4e93c9 100%)" },
  { key: "dawn", label: "Dawn", css: "linear-gradient(120deg, #f6d365 0%, #fda085 100%)" },
  { key: "bloom", label: "Bloom", css: "linear-gradient(120deg, #a18cd1 0%, #fbc2eb 100%)" },
  { key: "mint", label: "Mint", css: "linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)" },
  { key: "ember", label: "Ember", css: "linear-gradient(120deg, #ff9a8b 0%, #ff6a88 55%, #ff99ac 100%)" },
  { key: "forest", label: "Forest", css: "linear-gradient(120deg, #134e5e 0%, #71b280 100%)" },
  { key: "dusk", label: "Dusk", css: "linear-gradient(120deg, #2b5876 0%, #4e4376 100%)" },
  { key: "sand", label: "Sand", css: "linear-gradient(120deg, #e6b980 0%, #eacda3 100%)" },
  {
    key: "aurora",
    label: "Aurora",
    css: "radial-gradient(circle at 18% 30%, rgba(125,226,209,.9) 0, transparent 45%), radial-gradient(circle at 82% 70%, rgba(201,96,165,.85) 0, transparent 50%), linear-gradient(120deg, #1d3b53, #0c9384)",
  },
  { key: "graphite", label: "Graphite", css: "linear-gradient(120deg, #232526 0%, #414345 100%)" },
];

export const coverCss = (key: string | null): string | null => COVERS.find((c) => c.key === key)?.css ?? null;

/* ------------------------------------------------------------ cleaning */

export function cleanNoteTitle(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, NOTE_TITLE_MAX) : "";
}

/**
 * One of Kairo's icons, by key, or nothing. An emoji, from an older page or an
 * assistant, becomes its closest icon: a page icon is never a smuggled string.
 */
export function cleanIcon(v: unknown): string | null {
  return pageIconKey(v);
}

export function cleanCover(v: unknown): string | null {
  return typeof v === "string" && COVERS.some((c) => c.key === v) ? v : null;
}

const label = (v: unknown, max = NOTE_TITLE_MAX): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/* ------------------------------------------------------------ sanitiser */

const cell: AttrRule = (a) => {
  const colspan = int(a.colspan, 1, 20, 1);
  const widths =
    Array.isArray(a.colwidth) &&
    a.colwidth.length === colspan &&
    a.colwidth.every((w) => typeof w === "number" && Number.isInteger(w) && w >= 24 && w <= 2400)
      ? (a.colwidth as number[])
      : null;
  return { colspan, rowspan: int(a.rowspan, 1, 100, 1), colwidth: widths };
};

/** Checks a note from the editor and rebuilds it from known parts. */
export const normalizeNoteDoc = createNormalizer({
  nodes: {
    ...BASE_NODES,
    details: (a) => ({ open: a.open === true }),
    detailsSummary: null,
    detailsContent: null,
    table: null,
    tableRow: null,
    tableHeader: cell,
    tableCell: cell,
    // a link to another page, inline; the label is only a fallback, the tree has the live title
    pageMention: (a) => ({ id: isNoteId(a.id) ? a.id : null, label: label(a.label) }),
    // a sub-page, as a block
    pageLink: (a) => ({ id: isNoteId(a.id) ? a.id : null }),
    // a Kairo task, live: the title is kept so the page still reads if the task goes
    taskRef: (a) => ({ id: isNoteId(a.id) ? a.id : null, title: label(a.title, 500) }),
  },
  marks: {
    ...BASE_MARKS,
    textStyle: (a) => (typeof a.color === "string" && TEXT_COLOR_RE.test(a.color) ? { color: a.color } : null),
  },
  maxBytes: NOTE_DOC_MAX_BYTES,
  maxDepth: 40,
  maxNodes: 60_000,
  fail: (message) => new NoteContentError(message),
});

/** Every page this body links to, by mention or sub-page block. */
export function linksIn(doc: JNode): string[] {
  const found = new Set<string>();
  const visit = (n: JNode) => {
    if ((n.type === "pageMention" || n.type === "pageLink") && isObj(n.attrs) && isNoteId(n.attrs.id)) {
      found.add(n.attrs.id);
    }
    for (const c of n.content ?? []) visit(c);
  };
  visit(doc);
  return [...found].slice(0, 500);
}

/** Rewrites page ids inside a body — for a duplicate, whose links point at its own copies. */
export function remapLinks(doc: JNode, map: Map<string, string>): JNode {
  const visit = (n: JNode): JNode => {
    const next: JNode = { ...n };
    if ((n.type === "pageMention" || n.type === "pageLink") && typeof n.attrs?.id === "string" && map.has(n.attrs.id)) {
      next.attrs = { ...n.attrs, id: map.get(n.attrs.id) };
    }
    if (n.content) next.content = n.content.map(visit);
    return next;
  };
  return visit(doc);
}

/* ------------------------------------------------------------- markdown */

export function noteToMarkdown(
  page: Pick<NotePage, "title" | "icon" | "doc">,
  opts: { depth?: number; titleOf?: (id: string) => string | null; path?: string[] } = {}
): string {
  const depth = Math.min(5, Math.max(1, opts.depth ?? 1));
  const heading = `${"#".repeat(depth)} ${escapeMd(page.title || "Untitled")}`;
  const parts = [heading];
  if (opts.path?.length) parts.push(`_${opts.path.map((p) => escapeMd(p || "Untitled")).join(" / ")}_`);
  const body = blocksToMarkdown(page.doc.content, { shift: depth, titleOf: opts.titleOf });
  if (body) parts.push(body);
  return parts.join("\n\n");
}

export function notesToMarkdown(
  pages: { page: Pick<NotePage, "id" | "title" | "icon" | "doc">; path: string[] }[],
  owner: string,
  exportedOn: string
): string {
  const titles = new Map(pages.map(({ page }) => [page.id, page.title || "Untitled"]));
  const head = [
    `# ${owner ? `${owner}'s notes` : "Notes"}`,
    `_Exported from Kairo on ${exportedOn} · ${pages.length} ${pages.length === 1 ? "page" : "pages"}_`,
  ].join("\n\n");
  if (pages.length === 0) return `${head}\n`;
  const body = pages
    .map(({ page, path }) => noteToMarkdown(page, { depth: 2, path, titleOf: (id) => titles.get(id) ?? null }))
    .join("\n\n---\n\n");
  return `${head}\n\n---\n\n${body}\n`;
}
