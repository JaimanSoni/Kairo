import { Extension, Node, mergeAttributes } from "@tiptap/react";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { fmtTime12 } from "@/lib/dates";

/**
 * The journal editor's own pieces: the timestamp divider, and the plugin that
 * drops one in when you come back to a page. The callout and the slash menu
 * are shared with notes, in ../editor.
 */

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    entryTime: {
      /** Drops a "— 4:32 PM" divider and a fresh paragraph after it. */
      insertEntryTime: (time: string) => ReturnType;
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
