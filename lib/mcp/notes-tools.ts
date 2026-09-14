import { docToText, type JNode } from "../doc-model";
import { markdownToBlocks } from "../markdown-blocks";
import { createNote, getNote, listTree, saveNoteDoc, searchNotes } from "../notes";
import { cleanIcon, isNoteId, NoteContentError, noteToMarkdown, type NoteMeta } from "../notes-shared";
import { SITE_URL } from "../site";
import { canWrite, type McpContext } from "./context";
import { ToolFail } from "./fail";
import { json, text, type JsonSchema } from "./protocol";
import { optInt, optString, reqString, type Args } from "./args";
import type { Tool } from "./tools";

/**
 * Notes, over MCP — for keys that were created with them ticked.
 *
 * Search, read, create and append. No delete and no rewrite: "save this to my
 * notes" and "what did I write about the launch?" are the jobs, and an
 * assistant that misreads a sentence should never be able to empty a page.
 */

function obj(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
  return { type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false };
}

const pageRef = {
  pageId: { type: "string", description: "The page's id, as returned by notes_search or notes_create." } as JsonSchema,
  title: { type: "string", maxLength: 200, description: "The page's exact title, when you don't have its id." } as JsonSchema,
};

const untitled = (p: { title: string }) => p.title || "Untitled";
const urlOf = (id: string) => `${SITE_URL}/notes/${id}`;

type Tree = { pages: NoteMeta[]; byId: Map<string, NoteMeta> };

async function loadTree(ctx: McpContext): Promise<Tree> {
  const pages = await listTree(ctx.userId);
  return { pages, byId: new Map(pages.map((p) => [p.id, p])) };
}

function pathOf(tree: Tree, id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>([id]);
  let at = tree.byId.get(id)?.parentId ? tree.byId.get(tree.byId.get(id)!.parentId!) : undefined;
  while (at && !seen.has(at.id)) {
    out.unshift(untitled(at));
    seen.add(at.id);
    at = at.parentId ? tree.byId.get(at.parentId) : undefined;
  }
  return out;
}

/** A page named by id or by title. A title that fits several pages is a question for the user, not a guess. */
function resolvePage(tree: Tree, args: Args, idKey = "pageId", titleKey = "title"): NoteMeta {
  const id = optString(args, idKey, 64)?.trim();
  if (id) {
    if (!isNoteId(id)) throw new ToolFail(`${idKey} isn't a page id. Use notes_search to find the page.`);
    const page = tree.byId.get(id);
    if (!page) throw new ToolFail(`No page with id ${id}. It may be in the trash or deleted.`);
    return page;
  }
  const title = optString(args, titleKey, 200)?.trim().toLowerCase();
  if (!title) throw new ToolFail(`Give ${idKey} or ${titleKey}.`);
  const exact = tree.pages.filter((p) => untitled(p).toLowerCase() === title);
  const found = exact.length ? exact : tree.pages.filter((p) => untitled(p).toLowerCase().includes(title));
  if (found.length === 1) return found[0];
  if (found.length === 0) throw new ToolFail(`No page is called "${title}". Use notes_search to look for it.`);
  const options = found
    .slice(0, 8)
    .map((p) => `${untitled(p)} (${[...pathOf(tree, p.id), untitled(p)].join(" / ")}) — id ${p.id}`)
    .join("; ");
  throw new ToolFail(`Several pages match "${title}": ${options}. Ask which one, then pass its pageId.`);
}

function blocksFrom(markdown: string): JNode[] {
  const blocks = markdownToBlocks(markdown, { tables: true });
  if (blocks.length === 0) throw new ToolFail("There's nothing to write.");
  return blocks;
}

/* ---------------------------------------------------------------- tools */

const notesSearch: Tool = {
  name: "notes_search",
  title: "Search notes",
  notes: true,
  write: false,
  annotations: { readOnlyHint: true },
  description:
    "Find pages in the user's Kairo notes. With a query, returns pages whose title or text contains it, with the passage it was found in. Without one, returns the most recently edited pages and the top-level pages. Only call this when the user asks about their notes.",
  inputSchema: obj({
    query: { type: "string", maxLength: 100, description: "Words to look for. Case doesn't matter." },
    limit: { type: "integer", minimum: 1, maximum: 30, description: "Default 15." },
  }),
  run: async (ctx, _scope, args) => {
    const limit = optInt(args, "limit", 1, 30) ?? 15;
    const query = optString(args, "query", 100)?.trim();
    const tree = await loadTree(ctx);

    if (query) {
      const hits = await searchNotes(ctx.userId, query, limit);
      return json({
        query,
        count: hits.length,
        results: hits.map((h) => ({
          pageId: h.id,
          title: untitled(h),
          ...(h.icon ? { icon: h.icon } : {}),
          path: pathOf(tree, h.id).join(" / ") || null,
          passage: h.snippet,
          url: urlOf(h.id),
        })),
      });
    }

    const recent = [...tree.pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
    const top = tree.pages.filter((p) => !p.parentId || !tree.byId.has(p.parentId)).slice(0, 40);
    return json({
      pages: tree.pages.length,
      recentlyEdited: recent.map((p) => ({
        pageId: p.id,
        title: untitled(p),
        path: pathOf(tree, p.id).join(" / ") || null,
        words: p.words,
        edited: p.updatedAt,
      })),
      topLevel: top.map((p) => ({ pageId: p.id, title: untitled(p), ...(p.icon ? { icon: p.icon } : {}) })),
    });
  },
};

const notesRead: Tool = {
  name: "notes_read",
  title: "Read a note",
  notes: true,
  write: false,
  annotations: { readOnlyHint: true },
  description:
    "Read one page of the user's Kairo notes as Markdown, with where it lives and the pages inside it. Name it by pageId, or by its exact title.",
  inputSchema: obj(pageRef),
  run: async (ctx, _scope, args) => {
    const tree = await loadTree(ctx);
    const meta = resolvePage(tree, args);
    const found = await getNote(ctx.userId, meta.id);
    if (!found || found.page.trashedAt) throw new ToolFail("That page is in the trash.");
    const kids = tree.pages.filter((p) => p.parentId === meta.id);
    const parts = [
      noteToMarkdown(found.page, { path: pathOf(tree, meta.id), titleOf: (id) => tree.byId.get(id)?.title ?? null }),
    ];
    if (kids.length) parts.push(`**Pages inside:** ${kids.map((k) => `${untitled(k)} (id ${k.id})`).join(", ")}`);
    if (found.backlinks.length) parts.push(`**Linked from:** ${found.backlinks.map((b) => untitled(b)).join(", ")}`);
    parts.push(`_pageId ${meta.id} · ${urlOf(meta.id)}_`);
    return text(parts.join("\n\n"));
  },
};

const notesCreate: Tool = {
  name: "notes_create",
  title: "Create a note",
  notes: true,
  write: true,
  description:
    "Create a new page in the user's Kairo notes — only when they ask you to save or write something there. The content is Markdown: '# ' headings, '- ' bullets, '1. ' numbers, '- [ ] ' checkboxes, '> ' quotes, ``` code fences and | tables | become real blocks. Put it inside another page with parentId, or parentTitle.",
  inputSchema: obj(
    {
      title: { type: "string", maxLength: 200, description: "The page's title." },
      content: { type: "string", maxLength: 50000, description: "The body, as Markdown. May be empty." },
      parentId: { type: "string", description: "Create it inside this page." },
      parentTitle: { type: "string", maxLength: 200, description: "Create it inside the page with this exact title." },
      icon: { type: "string", maxLength: 16, description: "One emoji for the page, if it suits." },
    },
    ["title"]
  ),
  run: async (ctx, _scope, args) => {
    if (!canWrite(ctx)) throw new ToolFail("This connection is read-only, so it can't create notes.");
    const title = reqString(args, "title", 200);
    const content = optString(args, "content", 50_000) ?? "";
    let parent: NoteMeta | null = null;
    let tree: Tree | null = null;
    if (args.parentId !== undefined || args.parentTitle !== undefined) {
      tree = await loadTree(ctx);
      parent = resolvePage(tree, args, "parentId", "parentTitle");
    }
    const blocks = content.trim() ? blocksFrom(content) : [{ type: "paragraph" }];
    try {
      const result = await createNote(ctx.userId, {
        parentId: parent?.id ?? null,
        title,
        icon: cleanIcon(optString(args, "icon", 16)),
        doc: { type: "doc", content: blocks },
      });
      if (!result.ok) throw new ToolFail(result.error);
      const path = parent && tree ? [...pathOf(tree, parent.id), untitled(parent)] : [];
      return json({
        created: untitled(result.page),
        pageId: result.page.id,
        path: path.join(" / ") || null,
        words: result.page.words,
        url: urlOf(result.page.id),
      });
    } catch (err) {
      if (err instanceof NoteContentError) throw new ToolFail(err.message);
      throw err;
    }
  },
};

const notesAppend: Tool = {
  name: "notes_append",
  title: "Add to a note",
  notes: true,
  write: true,
  description:
    "Add Markdown to the end of an existing page in the user's Kairo notes, leaving what's there untouched. Name the page by pageId, or by its exact title.",
  inputSchema: obj({ ...pageRef, content: { type: "string", maxLength: 50000, description: "What to add, as Markdown." } }, ["content"]),
  run: async (ctx, _scope, args) => {
    if (!canWrite(ctx)) throw new ToolFail("This connection is read-only, so it can't write in notes.");
    const tree = await loadTree(ctx);
    const meta = resolvePage(tree, args);
    const blocks = blocksFrom(reqString(args, "content", 50_000));

    // one retry: if the page was saved in the app while this call was in
    // flight, add to the newer version instead of overwriting it
    for (let attempt = 0; attempt < 2; attempt++) {
      const found = await getNote(ctx.userId, meta.id);
      if (!found || found.page.trashedAt) throw new ToolFail("That page is in the trash.");
      if (found.page.locked) throw new ToolFail("That page is locked in Kairo. Ask the user to unlock it first.");
      const existing = found.page.doc.content ?? [];
      const blank = docToText(found.page.doc).trim().length === 0 && existing.every((b) => b.type === "paragraph");
      try {
        const result = await saveNoteDoc(
          ctx.userId,
          meta.id,
          { type: "doc", content: blank ? blocks : [...existing, ...blocks] },
          found.page.version,
          false
        );
        if (result.ok) {
          return json({ appendedTo: untitled(meta), pageId: meta.id, words: result.page.words, url: urlOf(meta.id) });
        }
        if (result.reason === "locked") throw new ToolFail("That page is locked in Kairo.");
        if (result.reason === "trashed" || result.reason === "missing") throw new ToolFail("That page is in the trash.");
      } catch (err) {
        if (err instanceof NoteContentError) throw new ToolFail(err.message);
        throw err;
      }
    }
    throw new ToolFail("That page kept changing while writing to it. Try again in a moment.");
  },
};

export const NOTES_TOOLS: Tool[] = [notesSearch, notesRead, notesCreate, notesAppend];
