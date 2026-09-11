import { Extension, Node, mergeAttributes, type Editor, type Range } from "@tiptap/react";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { fmtTime12 } from "@/lib/dates";

/**
 * The journal editor's own pieces: two blocks StarterKit doesn't have, the
 * slash menu, and the timestamp that marks coming back to a page.
 */

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    entryTime: {
      /** Drops a "— 4:32 PM" divider and a fresh paragraph after it. */
      insertEntryTime: (time: string) => ReturnType;
    };
    callout: {
      setCallout: (emoji: string) => ReturnType;
    };
  }
}

/* ------------------------------------------------------------ entry time */

/**
 * A quiet divider with the time on it.
 *
 * One page per day means a morning thought and an evening one share a page,
 * and without a marker they run together as if written in one sitting. The
 * divider is an atom — the caret steps over it, it can't be half-deleted —
 * and it holds only a 24-hour time, rendered in the reader's own format.
 */
export const EntryTime = Node.create({
  name: "entryTime",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      time: {
        default: "00:00",
        parseHTML: (el) => el.getAttribute("data-time") ?? "00:00",
        renderHTML: (attrs) => ({ "data-time": attrs.time }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-entry-time]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-entry-time": "", class: "jr-time", contenteditable: "false" }),
      ["span", {}, fmtTime12(String(node.attrs.time))],
    ];
  },

  addCommands() {
    return {
      insertEntryTime:
        (time) =>
        ({ chain }) =>
          chain()
            .insertContent([{ type: this.name, attrs: { time } }, { type: "paragraph" }])
            .run(),
    };
  },
});

/* --------------------------------------------------------------- callout */

/** A soft box with an emoji — for the thing worth finding again. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: "💭",
        parseHTML: (el) => el.getAttribute("data-emoji") ?? "💭",
        renderHTML: (attrs) => ({ "data-emoji": attrs.emoji }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-callout": "", class: "jr-callout" }),
      ["span", { class: "jr-callout-emoji", contenteditable: "false" }, String(node.attrs.emoji)],
      ["div", { class: "jr-callout-body" }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (emoji) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { emoji }),
    };
  },
});

/* ------------------------------------------------------------ slash menu */

export type SlashItem = {
  id: string;
  title: string;
  hint: string;
  /** A glyph, drawn in the menu's icon well. */
  icon: string;
  group: "Write" | "Structure" | "Kairo";
  keywords: string[];
  run: (editor: Editor, range: Range) => void;
};

export type SlashState = {
  open: boolean;
  /** Escape hides the menu without ending the suggestion, so Enter types normally again. */
  hidden: boolean;
  items: SlashItem[];
  index: number;
  query: string;
  rect: (() => DOMRect | null) | null;
  pick: ((item: SlashItem) => void) | null;
};

const CLOSED: SlashState = { open: false, hidden: false, items: [], index: 0, query: "", rect: null, pick: null };

/**
 * The menu's state lives outside ProseMirror, in a tiny store React subscribes
 * to. Rendering the menu through TipTap's own renderer would mount it outside
 * the React tree — away from the theme, the portal root and everything else —
 * so the plugin only reports what it sees, and React draws it.
 */
export function createSlashStore() {
  let state: SlashState = CLOSED;
  const listeners = new Set<() => void>();
  const set = (next: Partial<SlashState>) => {
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
    close: () => set(CLOSED),
    move: (delta: number) => {
      if (state.items.length === 0) return;
      set({ index: (state.index + delta + state.items.length) % state.items.length });
    },
  };
}
export type SlashStore = ReturnType<typeof createSlashStore>;

/**
 * The items live in the extension's storage, which the page fills from an
 * effect. Handing TipTap a closure over React refs instead means reading refs
 * during render — the configuration is rebuilt on every render — and storage
 * is TipTap's own place for state a plugin reads later.
 */
export const SlashCommand = Extension.create<
  { store: SlashStore | null; filter: (items: SlashItem[], query: string) => SlashItem[] },
  { items: SlashItem[] }
>({
  name: "slashCommand",

  addOptions() {
    return { store: null, filter: (items) => items };
  },

  addStorage() {
    return { items: [] };
  },

  addProseMirrorPlugins() {
    const store = this.options.store;
    const filter = this.options.filter;
    const storage = this.storage;
    if (!store) return [];

    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: "/",
        // "and/or" and URLs must never open a menu: only a slash after a space
        // or at the start of a line does
        allowedPrefixes: [" "],
        decorationClass: "jr-slash-query",
        allow: ({ state, range }) => {
          const parent = state.doc.resolve(range.from).parent;
          return parent.type.name !== "codeBlock";
        },
        items: ({ query }) => filter(storage.items, query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => ({
          onStart: (p) =>
            store.set({
              open: true,
              hidden: false,
              items: p.items,
              index: 0,
              query: p.query,
              rect: p.clientRect ?? null,
              pick: (item) => p.command(item),
            }),
          onUpdate: (p) => {
            const prev = store.get();
            store.set({
              items: p.items,
              // a new query is a new list; keep the highlight only while it's the same
              index: p.query === prev.query ? Math.min(prev.index, Math.max(0, p.items.length - 1)) : 0,
              query: p.query,
              rect: p.clientRect ?? null,
              pick: (item) => p.command(item),
            });
          },
          onExit: () => store.close(),
          onKeyDown: ({ event }) => {
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
        }),
      }),
    ];
  },
});

/* --------------------------------------------------------- auto timestamp */

export const autoStampKey = new PluginKey("journalAutoStamp");

/**
 * Coming back to today's page later drops the time in before your first new
 * word — but only when you're continuing at the end. Clicking into an earlier
 * paragraph to fix a typo is editing, not returning, and gets no divider.
 */
export const AutoStamp = Extension.create<{ now: () => string }, { armed: boolean }>({
  name: "journalAutoStamp",

  addOptions() {
    return { now: () => "00:00" };
  },

  addStorage() {
    return { armed: false };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const storage = this.storage;
    return [
      new Plugin({
        key: autoStampKey,
        props: {
          handleTextInput(view, from, _to, text) {
            if (!storage.armed) return false;
            const { state } = view;
            const { schema, doc } = state;
            const last = doc.lastChild;
            if (!last || !schema.nodes.entryTime) return false;

            const $from = doc.resolve(from);
            if ($from.depth < 1 || !$from.parent.isTextblock) return false;
            const lastStart = doc.content.size - last.nodeSize;
            // the caret must sit in the final top-level block, at its very end
            if ($from.before(1) !== lastStart) return false;
            if ($from.parentOffset !== $from.parent.content.size) return false;

            const stamp = schema.nodes.entryTime.create({ time: options.now() });
            const para = schema.nodes.paragraph.create(null, schema.text(text));
            const tr = state.tr;
            if (last.type.name === "paragraph" && last.content.size === 0) {
              tr.replaceWith(lastStart, doc.content.size, [stamp, para]);
            } else {
              tr.insert(doc.content.size, [stamp, para]);
            }
            tr.setSelection(TextSelection.create(tr.doc, tr.doc.content.size - 1));
            view.dispatch(tr.scrollIntoView());
            storage.armed = false;
            return true;
          },
        },
      }),
    ];
  },
});
