import { Extension, Node, mergeAttributes, ReactNodeViewRenderer, type Editor } from "@tiptap/react";
import Mention, { type MentionOptions } from "@tiptap/extension-mention";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { looksLikeMarkdown, markdownToBlocks } from "@/lib/markdown-blocks";
import { notesStore } from "@/lib/notes-client";
import type { NoteMeta } from "@/lib/notes-shared";
import { PageLinkView, PageMentionView, TaskRefView } from "./node-views";

/**
 * The notes editor's own pieces: links to other pages (inline and as blocks),
 * live Kairo tasks, block moves, and Markdown that arrives by paste.
 */

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    pageLink: {
      insertPageLink: (id: string) => ReturnType;
    };
    taskRef: {
      insertTaskRef: (id: string, title: string) => ReturnType;
    };
  }
}

/* ------------------------------------------------------------ menu store */

export type MenuState<T> = {
  open: boolean;
  hidden: boolean;
  items: T[];
  index: number;
  query: string;
  rect: (() => DOMRect | null) | null;
  pick: ((item: T) => void) | null;
};

/** The same tiny store the slash menu uses, for any list a suggestion opens. */
export function createMenuStore<T>() {
  const closed: MenuState<T> = { open: false, hidden: false, items: [], index: 0, query: "", rect: null, pick: null };
  let state = closed;
  const listeners = new Set<() => void>();
  const set = (next: Partial<MenuState<T>>) => {
    state = { ...state, ...next };
    for (const l of listeners) l();
  };
  return {
    get: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set,
    close: () => set(closed),
    move: (delta: number) => {
      if (state.items.length === 0) return;
      set({ index: (state.index + delta + state.items.length) % state.items.length });
    },
  };
}
export type MenuStore<T> = ReturnType<typeof createMenuStore<T>>;

function menuRenderer<T>(store: MenuStore<T>) {
  return () => ({
    onStart: (p: SuggestionProps<T, T>) =>
      store.set({
        open: true,
        hidden: false,
        items: p.items,
        index: 0,
        query: p.query,
        rect: p.clientRect ?? null,
        pick: (item: T) => p.command(item),
      }),
    onUpdate: (p: SuggestionProps<T, T>) => {
      const prev = store.get();
      store.set({
        items: p.items,
        index: p.query === prev.query ? Math.min(prev.index, Math.max(0, p.items.length - 1)) : 0,
        query: p.query,
        rect: p.clientRect ?? null,
        pick: (item: T) => p.command(item),
      });
    },
    onExit: () => store.close(),
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      const s = store.get();
      if (!s.open || s.hidden) return false;
      if (event.key === "ArrowDown") {
        store.move(1);
        return true;
      }
      if (event.key === "ArrowUp") {
        store.move(-1);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = s.items[s.index];
        if (!item) return false;
        s.pick?.(item);
        return true;
      }
      if (event.key === "Escape") {
        store.set({ hidden: true });
        return true;
      }
      return false;
    },
  });
}

/* ---------------------------------------------------------- page mention */

export type MentionItem = { kind: "page"; page: NoteMeta } | { kind: "new"; title: string };

type MentionStorage = {
  /** The page being edited: it isn't offered as a link to itself, and new pages go beneath it. */
  pageId: string | null;
  /** Creates a sub-page; set by the page, which knows how to talk to the tree. */
  createPage: ((title: string) => Promise<NoteMeta | null>) | null;
};

const mentionStorage = (editor: Editor) =>
  (editor.storage as unknown as { pageMention: MentionStorage }).pageMention;

function mentionItems(editor: Editor, query: string): MentionItem[] {
  const q = query.trim().toLowerCase();
  const self = mentionStorage(editor).pageId;
  const pages = notesStore
    .all()
    .filter((p) => p.id !== self && (!q || (p.title || "untitled").toLowerCase().includes(q)))
    .sort((a, b) => {
      const as = (a.title || "untitled").toLowerCase().startsWith(q) ? 1 : 0;
      const bs = (b.title || "untitled").toLowerCase().startsWith(q) ? 1 : 0;
      return bs - as || b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 8)
    .map((page) => ({ kind: "page" as const, page }));
  return q ? [...pages, { kind: "new", title: query.trim().slice(0, 200) }] : pages;
}

/**
 * Inserts the chosen page. A new page is created first, beneath the page being
 * written, and the "@query" it replaces is only swapped if it's still there —
 * a person who kept typing while it was made keeps what they typed.
 */
async function pickMention(editor: Editor, range: { from: number; to: number }, item: MentionItem) {
  let page: NoteMeta | null = item.kind === "page" ? item.page : null;
  if (item.kind === "new") {
    const before = editor.state.doc.textBetween(range.from, range.to);
    page = (await mentionStorage(editor).createPage?.(item.title)) ?? null;
    if (!page) return;
    const still = range.to <= editor.state.doc.content.size && editor.state.doc.textBetween(range.from, range.to) === before;
    if (!still) {
      editor.chain().focus().insertContent([{ type: "pageMention", attrs: { id: page.id, label: page.title } }, { type: "text", text: " " }]).run();
      return;
    }
  }
  if (!page) return;
  editor
    .chain()
    .focus()
    .insertContentAt(range, [
      { type: "pageMention", attrs: { id: page.id, label: page.title || "Untitled" } },
      { type: "text", text: " " },
    ])
    .run();
}

export function createPageMention(store: MenuStore<MentionItem>) {
  const shared = {
    items: ({ query, editor }: { query: string; editor: Editor }) => mentionItems(editor, query),
    command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: MentionItem }) => {
      void pickMention(editor, range, props);
    },
    allowedPrefixes: [" "],
    allow: ({ state, range }: { state: Editor["state"]; range: { from: number } }) => {
      const parent = state.doc.resolve(range.from).parent.type.name;
      return parent !== "codeBlock" && parent !== "detailsSummary";
    },
    render: menuRenderer(store),
  };

  return Mention.extend<MentionOptions, MentionStorage>({
    name: "pageMention",
    addStorage() {
      return { pageId: null, createPage: null };
    },
    addNodeView() {
      return ReactNodeViewRenderer(PageMentionView, { as: "span" });
    },
  }).configure({
    HTMLAttributes: { class: "nt-mention" },
    deleteTriggerWithBackspace: false,
    renderText: ({ node }) => `@${String(node.attrs.label ?? "")}`,
    renderHTML: ({ node }) => [
      "span",
      { "data-type": "pageMention", "data-id": node.attrs.id, "data-label": node.attrs.label, class: "nt-mention" },
      `@${String(node.attrs.label ?? "")}`,
    ],
    suggestions: [
      { ...shared, char: "@", pluginKey: new PluginKey("pageMentionAt") },
      { ...shared, char: "[[", pluginKey: new PluginKey("pageMentionBrackets") },
    ] as never,
  });
}

/* -------------------------------------------------------------- sub-page */

/** A sub-page, drawn as a card that opens it. The tree holds the live title. */
export const PageLink = Node.create({
  name: "pageLink",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-id"),
        renderHTML: (attrs) => ({ "data-id": attrs.id }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-page-link]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-page-link": "" })];
  },

  renderText({ node }) {
    return notesStore.get(String(node.attrs.id))?.title || "Untitled";
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageLinkView);
  },

  addCommands() {
    return {
      insertPageLink:
        (id) =>
        ({ chain }) =>
          chain().insertContent([{ type: this.name, attrs: { id } }, { type: "paragraph" }]).run(),
    };
  },
});

/* ------------------------------------------------------------ Kairo task */

/** A Kairo task inside a page: tick it here, and it's ticked everywhere. */
export const TaskRef = Node.create({
  name: "taskRef",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-id"),
        renderHTML: (attrs) => ({ "data-id": attrs.id }),
      },
      title: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-title") ?? el.textContent ?? "",
        renderHTML: (attrs) => ({ "data-title": attrs.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-task-ref]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-task-ref": "" }), String(node.attrs.title ?? "")];
  },

  renderText({ node }) {
    return String(node.attrs.title ?? "");
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskRefView, { as: "span" });
  },

  addCommands() {
    return {
      insertTaskRef:
        (id, title) =>
        ({ chain }) =>
          chain().insertContent([{ type: this.name, attrs: { id, title } }, { type: "text", text: " " }]).run(),
    };
  },
});

/* ---------------------------------------------------------------- blocks */

const ITEMS = new Set(["listItem", "taskItem"]);
/** Blocks directly inside these get their own handle; everything else moves with its parent. */
const CONTAINERS = new Set(["doc", "detailsContent"]);

/**
 * The movable block at a position: a list item, a block inside a toggle, or a
 * top-level block. A paragraph inside a quote or a table cell moves with the
 * quote or the table, the way a person thinks of them.
 */
export function blockAt(doc: PMNode, at: number): { pos: number; node: PMNode } | null {
  const $p = doc.resolve(Math.max(0, Math.min(at, doc.content.size)));
  const after = $p.nodeAfter;
  // a position just before a block (what a pointer over it reports) names that block
  if (after && (ITEMS.has(after.type.name) || (after.isBlock && CONTAINERS.has($p.parent.type.name)))) {
    return { pos: $p.pos, node: after };
  }
  for (let d = $p.depth; d >= 1; d--) {
    const node = $p.node(d);
    const parent = $p.node(d - 1);
    if (ITEMS.has(node.type.name) || CONTAINERS.has(parent.type.name)) return { pos: $p.before(d), node };
  }
  if (after && after.isBlock) return { pos: $p.pos, node: after };
  return null;
}

export function moveBlock(editor: Editor, pos: number, dir: -1 | 1): boolean {
  const { state } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node) return false;
  const $pos = state.doc.resolve(pos);
  const index = $pos.index();
  const target = index + dir;
  if (target < 0 || target >= $pos.parent.childCount) return false;
  const sibling = $pos.parent.child(target);
  const offset = Math.max(0, Math.min(state.selection.from - pos, node.nodeSize - 1));

  const tr = state.tr.delete(pos, pos + node.nodeSize);
  const at = dir < 0 ? pos - sibling.nodeSize : pos + sibling.nodeSize;
  tr.insert(at, node);
  try {
    tr.setSelection(TextSelection.near(tr.doc.resolve(at + Math.max(1, offset))));
  } catch {
    /* an atom has nowhere to put a caret; the move still happened */
  }
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export function duplicateBlock(editor: Editor, pos: number): boolean {
  const { state } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node) return false;
  const at = pos + node.nodeSize;
  const tr = state.tr.insert(at, node.copy(node.content));
  try {
    tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1)));
  } catch {
    /* fine without a caret */
  }
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export function deleteBlock(editor: Editor, pos: number): boolean {
  const { state } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node) return false;
  editor.view.dispatch(state.tr.delete(pos, pos + node.nodeSize).scrollIntoView());
  editor.commands.focus();
  return true;
}

type Carry = { dragging: unknown };

/**
 * Picks a block up for dragging from outside the page. ProseMirror's own drop
 * handling reads `view.dragging`: the slice being carried, and the node to
 * remove once it lands — so setting it is all a handle has to do.
 */
export function startBlockDrag(editor: Editor, pos: number, data: DataTransfer): boolean {
  const view = editor.view;
  const node = view.state.doc.nodeAt(pos);
  if (!node) return false;
  const selection = NodeSelection.create(view.state.doc, pos);
  view.dispatch(view.state.tr.setSelection(selection));
  (view as unknown as Carry).dragging = { slice: selection.content(), move: true, node: selection };
  data.effectAllowed = "copyMove";
  data.setData("text/plain", node.textContent.slice(0, 500));
  const dom = view.nodeDOM(pos);
  if (dom instanceof HTMLElement) data.setDragImage(dom, 12, 12);
  return true;
}

/** A drag that ended outside the page forgets what it carried, the way ProseMirror's own does. */
export function endBlockDrag(editor: Editor): void {
  const view = editor.view as unknown as Carry;
  const was = view.dragging;
  setTimeout(() => {
    if (view.dragging === was) view.dragging = null;
  }, 50);
}

export type BlockKind = "text" | "h1" | "h2" | "h3" | "bullet" | "numbered" | "todo" | "toggle" | "quote" | "callout" | "code";

/** Turns a block into another kind, keeping its words. */
export function turnInto(editor: Editor, pos: number, kind: BlockKind): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.isAtom) return false;
  // a caret inside the block's first run of text is where every command acts
  let inner = pos + 1;
  let found = false;
  editor.state.doc.nodesBetween(pos, pos + node.nodeSize, (n, p) => {
    if (found) return false;
    if (n.isTextblock) {
      inner = p + 1;
      found = true;
      return false;
    }
    return true;
  });
  const base = editor.chain().focus().setTextSelection(inner).clearNodes();
  switch (kind) {
    case "text":
      return base.setParagraph().run();
    case "h1":
    case "h2":
    case "h3":
      return base.setNode("heading", { level: Number(kind[1]) }).run();
    case "bullet":
      return base.toggleBulletList().run();
    case "numbered":
      return base.toggleOrderedList().run();
    case "todo":
      return base.toggleTaskList().run();
    case "toggle":
      return base.setDetails().run();
    case "quote":
      return base.setBlockquote().run();
    case "callout":
      return base.setCallout("sparkle").run();
    case "code":
      return base.setCodeBlock().run();
  }
}

/** The words of a block's first line, and where they sit — for turning a line into a Kairo task. */
export function textOfBlock(doc: PMNode, pos: number): { from: number; to: number; text: string } | null {
  const node = doc.nodeAt(pos);
  if (!node) return null;
  let found: { from: number; to: number; text: string } | null = null;
  doc.nodesBetween(pos, pos + node.nodeSize, (n, p) => {
    if (found) return false;
    if (n.isTextblock && n.type.name !== "codeBlock") {
      found = { from: p + 1, to: p + 1 + n.content.size, text: n.textContent };
      return false;
    }
    return true;
  });
  return found;
}

export const BlockKeys = Extension.create({
  name: "noteBlockKeys",
  // ahead of the list and toggle keymaps, which would otherwise take Enter first
  priority: 1000,

  addKeyboardShortcuts() {
    const at = () => blockAt(this.editor.state.doc, this.editor.state.selection.from);
    return {
      // Enter on a toggle's title opens the toggle and carries on inside it
      Enter: () => {
        const { state, view } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty || $from.parent.type.name !== "detailsSummary") return false;
        const depth = $from.depth - 1;
        const details = $from.node(depth);
        if (details.type.name !== "details" || details.childCount < 2) return false;
        const pos = $from.before(depth);
        // open first, as its own step: the toggle pulls a caret out of content it can't see
        if (!details.attrs.open) view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...details.attrs, open: true }));
        const next = view.state;
        const opened = next.doc.nodeAt(pos);
        if (!opened) return true;
        const contentStart = pos + 1 + opened.child(0).nodeSize;
        view.dispatch(next.tr.setSelection(TextSelection.near(next.doc.resolve(contentStart + 1))).scrollIntoView());
        return true;
      },
      "Mod-Shift-ArrowUp": () => {
        const b = at();
        return b ? moveBlock(this.editor, b.pos, -1) : false;
      },
      "Mod-Shift-ArrowDown": () => {
        const b = at();
        return b ? moveBlock(this.editor, b.pos, 1) : false;
      },
      "Mod-d": () => {
        const b = at();
        return b ? duplicateBlock(this.editor, b.pos) : false;
      },
    };
  },
});

/* --------------------------------------------------------- markdown paste */

/**
 * Plain-text Markdown pasted in becomes blocks. Rich pastes — from a web page,
 * a doc, another editor — carry their own formatting and are left to the
 * editor's HTML handling.
 */
export const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          handlePaste(view, event) {
            const data = event.clipboardData;
            if (!data) return false;
            const text = data.getData("text/plain");
            if (!text || !looksLikeMarkdown(text)) return false;
            if (view.state.selection.$from.parent.type.spec.code) return false;
            // Notion, GitHub and the chat assistants put Markdown on the clipboard and
            // HTML beside it. The Markdown is the better copy: it says heading, list and
            // checkbox, where the HTML says font-size and margin. Another Kairo page is
            // the exception — that HTML is already our own blocks, exactly.
            const html = data.getData("text/html");
            if (html && html.includes("data-pm-slice")) return false;
            const blocks = markdownToBlocks(text, { tables: true });
            if (blocks.length === 0) return false;
            editor.chain().focus().insertContent(blocks).run();
            return true;
          },
        },
      }),
    ];
  },
});
