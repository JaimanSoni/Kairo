"use client";

import { useState } from "react";
import { Node, NodeViewWrapper, mergeAttributes, ReactNodeViewRenderer, type Editor, type ReactNodeViewProps } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { isImageFile, refuseReason, sized, uploadImage, uploadsEnabled } from "@/lib/cloudinary";

/**
 * Pictures in a page: pasted, dropped, or chosen from the slash menu.
 *
 * The bytes go straight from the browser to Cloudinary and the page keeps
 * only the address, so a note is still small and still just text. While one
 * is on its way it shows itself from the file on this machine, with how far
 * it has got — nothing is written into the page until there is a real URL to
 * write, so a page saved mid-upload never keeps half a picture.
 */

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    noteImage: {
      insertImage: (attrs: { src: string; alt?: string | null; width?: number | null }) => ReturnType;
      /** Opens the file picker and uploads whatever is chosen. */
      pickImage: () => ReturnType;
    };
  }
}

const key = new PluginKey("noteImageUploads");

type Pending = { id: number; preview: string; progress: number; name: string };

let nextId = 1;

/* ------------------------------------------------------------ the block */

const WIDTHS = [
  { id: 40, label: "Small" },
  { id: 70, label: "Medium" },
  { id: 100, label: "Full" },
];

function ImageView({ node, updateAttributes, editor, selected, deleteNode }: ReactNodeViewProps) {
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const width = typeof node.attrs.width === "number" ? node.attrs.width : 100;
  const [broken, setBroken] = useState(false);

  return (
    <NodeViewWrapper className={`nt-image ${selected ? "is-selected" : ""}`} data-note-image={src}>
      <span className="nt-image-frame" style={{ maxWidth: `${width}%` }}>
        {broken ? (
          <span className="nt-image-gone">
            That picture could not be loaded.{" "}
            <a href={src} target="_blank" rel="noreferrer noopener">
              Open it
            </a>
          </span>
        ) : (
          <a href={src} target="_blank" rel="noreferrer noopener" data-image-open>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sized(src, 1400)} alt={alt} loading="lazy" onError={() => setBroken(true)} draggable={false} />
          </a>
        )}
        {editor.isEditable && (
          <span className="nt-image-tools" contentEditable={false}>
            {WIDTHS.map((w) => (
              <button key={w.id} type="button" aria-pressed={width === w.id} onClick={() => updateAttributes({ width: w.id })} data-image-width={w.id}>
                {w.label}
              </button>
            ))}
            <button type="button" onClick={() => deleteNode()} data-image-remove>
              Remove
            </button>
          </span>
        )}
      </span>
    </NodeViewWrapper>
  );
}

const href = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().slice(0, 2048) : null;
  } catch {
    return null;
  }
};

/** Uploads a list of files, one placeholder each, and writes each picture in when its URL arrives. */
export function uploadFiles(editor: Editor, files: File[], at: number, onRefuse: (reason: string) => void) {
  let pos = at;
  for (const file of files) {
    const reason = refuseReason(file);
    if (reason) {
      onRefuse(reason);
      continue;
    }
    const id = nextId++;
    const preview = URL.createObjectURL(file);
    editor.view.dispatch(editor.view.state.tr.setMeta(key, { add: { id, pos, preview, name: file.name } }));

    const { done } = uploadImage(file, (fraction) => {
      editor.view.dispatch(editor.view.state.tr.setMeta(key, { progress: { id, fraction } }));
    });
    void done
      .then((uploaded) => {
        const found = key.getState(editor.view.state) as DecorationSet | undefined;
        const spot = found?.find(undefined, undefined, (spec) => spec.id === id)[0]?.from;
        const tr = editor.view.state.tr.setMeta(key, { remove: { id } });
        const node = editor.view.state.schema.nodes.image.create({ src: uploaded.url, alt: file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 200), width: 100 });
        tr.insert(spot ?? editor.view.state.doc.content.size, node);
        editor.view.dispatch(tr);
      })
      .catch((err: Error) => {
        editor.view.dispatch(editor.view.state.tr.setMeta(key, { remove: { id } }));
        onRefuse(err.message);
      })
      .finally(() => URL.revokeObjectURL(preview));
    pos += 1;
  }
}

/** The picture-on-its-way: the local file, greyed, with a bar across the bottom. */
function placeholder(pending: Pending): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "nt-image-uploading";
  wrap.setAttribute("data-uploading", pending.name);
  const img = document.createElement("img");
  img.src = pending.preview;
  img.alt = "";
  wrap.append(img);
  const bar = document.createElement("span");
  bar.className = "nt-image-bar";
  bar.style.width = `${Math.round(pending.progress * 100)}%`;
  wrap.append(bar);
  return wrap;
}

export const NoteImage = Node.create<{ onRefuse: (reason: string) => void }>({
  name: "image",

  addOptions() {
    return { onRefuse: () => undefined };
  },
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null, parseHTML: (el) => el.getAttribute("src") },
      alt: { default: null, parseHTML: (el) => el.getAttribute("alt") },
      width: { default: 100 },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },

  addCommands() {
    return {
      insertImage:
        (attrs) =>
        ({ commands }) => {
          const src = href(attrs.src);
          if (!src) return false;
          return commands.insertContent({ type: this.name, attrs: { src, alt: attrs.alt ?? null, width: attrs.width ?? 100 } });
        },
      pickImage:
        () =>
        ({ editor }) => {
          if (!uploadsEnabled) return false;
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.multiple = true;
          input.addEventListener("change", () => {
            const files = [...(input.files ?? [])];
            if (files.length) uploadFiles(editor, files, editor.state.selection.from, (reason) => this.options.onRefuse(reason));
          });
          input.click();
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set: DecorationSet) {
            let next = set.map(tr.mapping, tr.doc);
            const action = tr.getMeta(key) as { add?: { id: number; pos: number; preview: string; name: string }; progress?: { id: number; fraction: number }; remove?: { id: number } } | undefined;
            if (action?.add) {
              const pending: Pending = { id: action.add.id, preview: action.add.preview, progress: 0, name: action.add.name };
              next = next.add(tr.doc, [Decoration.widget(action.add.pos, () => placeholder(pending), { id: action.add.id, pending })]);
            }
            if (action?.progress) {
              const found = next.find(undefined, undefined, (spec) => spec.id === action.progress!.id)[0];
              if (found) {
                const pending = { ...(found.spec.pending as Pending), progress: action.progress.fraction };
                next = next.remove([found]).add(tr.doc, [Decoration.widget(found.from, () => placeholder(pending), { id: pending.id, pending })]);
              }
            }
            if (action?.remove) {
              next = next.remove(next.find(undefined, undefined, (spec) => spec.id === action.remove!.id));
            }
            return next;
          },
        },
        props: {
          decorations(state) {
            return key.getState(state) as DecorationSet;
          },
          handlePaste: (view, event) => {
            const files = [...(event.clipboardData?.files ?? [])].filter(isImageFile);
            if (files.length === 0 || !uploadsEnabled) return false;
            event.preventDefault();
            uploadFiles(this.editor, files, view.state.selection.from, (reason) => this.options.onRefuse(reason));
            return true;
          },
          handleDrop: (view, event) => {
            const dropped = event instanceof DragEvent ? [...(event.dataTransfer?.files ?? [])].filter(isImageFile) : [];
            if (dropped.length === 0 || !uploadsEnabled) return false;
            event.preventDefault();
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
            uploadFiles(this.editor, dropped, at, (reason) => this.options.onRefuse(reason));
            return true;
          },
        },
      }),
    ];
  },
});
