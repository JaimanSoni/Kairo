import { Extension, type Editor, type Range } from "@tiptap/react";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import type { ReactNode } from "react";

/**
 * The slash menu's machinery, shared by every Kairo editor. Each editor brings
 * its own items; the plugin and the store are the same.
 */

export type SlashItem = {
  id: string;
  title: string;
  hint: string;
  /** A glyph or line icon, drawn in the menu's icon well. */
  icon: ReactNode;
  /** The heading this item is listed under. Groups appear in the order their first item does. */
  group: string;
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

export function filterSlash(items: SlashItem[], query: string): SlashItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return items;
  return items.filter((i) => i.title.toLowerCase().includes(q) || i.keywords.some((k) => k.startsWith(q)));
}

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
        pluginKey: new PluginKey("slashCommand"),
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
