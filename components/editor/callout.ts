import { Node, mergeAttributes } from "@tiptap/react";
import { isIconKey, pageIconKey } from "@/lib/icons";

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (emoji: string) => ReturnType;
      /** Changes the icon of the callout at a position. */
      setCalloutEmoji: (pos: number, emoji: string) => ReturnType;
    };
  }
}

type CalloutOptions = {
  /** Draw every callout with an icon: an emoji written before icons shows its closest one. */
  icons: boolean;
};

/**
 * A soft box with a mark: for the thing worth finding again. The mark is one
 * of Kairo's icons by key (notes) or an emoji (the journal); the attribute
 * keeps its first name so pages written before icons still open.
 */
export const Callout = Node.create<CalloutOptions>({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addOptions() {
    return { icons: false };
  },

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
    const mark = String(node.attrs.emoji);
    const icon = this.options.icons ? (pageIconKey(mark) ?? "sparkle") : isIconKey(mark) ? mark : null;
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-callout": "", class: "jr-callout" }),
      [
        "span",
        { class: "jr-callout-emoji", contenteditable: "false" },
        icon ? ["img", { src: `/img/${icon}.png`, alt: "", draggable: "false", class: "jr-callout-icon" }] : mark,
      ],
      ["div", { class: "jr-callout-body" }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (emoji) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { emoji }),
      setCalloutEmoji:
        (pos, emoji) =>
        ({ tr, state, dispatch }) => {
          const node = state.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, emoji });
          return true;
        },
    };
  },
});
