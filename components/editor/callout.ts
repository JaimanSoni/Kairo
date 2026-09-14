import { Node, mergeAttributes } from "@tiptap/react";

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (emoji: string) => ReturnType;
      /** Changes the emoji of the callout at a position. */
      setCalloutEmoji: (pos: number, emoji: string) => ReturnType;
    };
  }
}

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
