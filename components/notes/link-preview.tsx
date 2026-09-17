"use client";

import { useEffect, useState } from "react";
import { Node, NodeViewWrapper, mergeAttributes, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { embedFor, siteOf } from "@/lib/embeds";

/**
 * A pasted link, shown as itself: a card with the page's title, a line about
 * it and its picture, or the thing itself in a frame where the site offers
 * one (a video, a track, a post).
 *
 * What the card says is kept on the block, so a page reads the same offline,
 * in an export, and long after the link has been pasted. The block always
 * knows the URL, so nothing is lost if the fetch fails or the page moves: it
 * falls back to the address, and "Show as link" turns it back into ordinary
 * text whenever the card is not what was wanted.
 */

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    linkPreview: {
      insertLinkPreview: (url: string, layout?: "card" | "embed") => ReturnType;
    };
  }
}

export type PreviewData = { url: string; title: string | null; description: string | null; image: string | null; site: string | null; favicon: string | null };

/** One fetch per link per visit, however many blocks point at it. */
const asked = new Map<string, Promise<PreviewData | null>>();

function lookUp(url: string): Promise<PreviewData | null> {
  const known = asked.get(url);
  if (known) return known;
  const run = fetch(`/api/notes/preview?url=${encodeURIComponent(url)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((body: { preview?: PreviewData } | null) => body?.preview ?? null)
    .catch(() => null);
  asked.set(url, run);
  return run;
}

const ONLY_A_URL = /^(https?:\/\/[^\s<>"]+)$/i;

function Favicon({ src, site }: { src: string | null; site: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className="nt-link-favicon" aria-hidden>
        {site.charAt(0).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="nt-link-favicon" onError={() => setBroken(true)} referrerPolicy="no-referrer" />;
}

function Thumb({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="nt-link-thumb" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}

function LinkPreviewView({ node, updateAttributes, editor, selected, deleteNode, getPos }: ReactNodeViewProps) {
  const url = typeof node.attrs.url === "string" ? node.attrs.url : "";
  const layout = node.attrs.layout === "embed" ? "embed" : "card";
  const embed = embedFor(url);
  const [fetched, setFetched] = useState<PreviewData | null>(null);
  const title = (node.attrs.title as string | null) ?? fetched?.title ?? null;
  const description = (node.attrs.description as string | null) ?? fetched?.description ?? null;
  const image = (node.attrs.image as string | null) ?? fetched?.image ?? null;
  const site = (node.attrs.site as string | null) ?? fetched?.site ?? siteOf(url);
  const favicon = (node.attrs.favicon as string | null) ?? fetched?.favicon ?? null;
  const waiting = !title && !fetched && layout === "card";

  // a card with nothing on it yet asks the server what this link is, once
  useEffect(() => {
    if (!url || node.attrs.title) return;
    let alive = true;
    void lookUp(url).then((data) => {
      if (!alive || !data) return;
      setFetched(data);
      // kept on the block, so the page reads the same next time and in an export
      if (editor.isEditable) updateAttributes({ title: data.title, description: data.description, image: data.image, site: data.site, favicon: data.favicon });
    });
    return () => {
      alive = false;
    };
  }, [url, node.attrs.title, editor, updateAttributes]);

  /** Back to an ordinary line of text with a link in it. */
  const asLink = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .insertContentAt({ from: pos, to: pos + node.nodeSize }, [{ type: "paragraph", content: [{ type: "text", text: title || url, marks: [{ type: "link", attrs: { href: url } }] }] }])
      .run();
  };

  const tools = editor.isEditable && (
    <span className="nt-link-tools" contentEditable={false}>
      {embed && (
        <button type="button" onClick={() => updateAttributes({ layout: layout === "embed" ? "card" : "embed" })} data-preview-toggle>
          {layout === "embed" ? "Show as card" : `Play here`}
        </button>
      )}
      <button type="button" onClick={asLink} data-preview-as-link>
        Show as link
      </button>
      <button type="button" onClick={() => deleteNode()} data-preview-remove aria-label="Remove this link">
        Remove
      </button>
    </span>
  );

  if (layout === "embed" && embed) {
    return (
      <NodeViewWrapperShell selected={selected} url={url} kind="embed">
        <div className={`nt-embed nt-embed-${embed.shape}`}>
          <iframe
            src={embed.src}
            title={title ?? `${embed.provider} embed`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <span className="nt-link-foot">
          <Favicon src={favicon} site={site} />
          <a href={url} target="_blank" rel="noreferrer noopener">
            {title || url}
          </a>
          <span className="nt-link-provider">{embed.provider}</span>
        </span>
        {tools}
      </NodeViewWrapperShell>
    );
  }

  return (
    <NodeViewWrapperShell selected={selected} url={url} kind="card">
      <a href={url} target="_blank" rel="noreferrer noopener" className="nt-link-card" data-preview-open>
        <span className="nt-link-words">
          <span className="nt-link-title">{waiting ? "Reading the page…" : title || url}</span>
          {description && <span className="nt-link-desc">{description}</span>}
          <span className="nt-link-site">
            <Favicon src={favicon} site={site} />
            {site}
          </span>
        </span>
        {image && <Thumb src={image} />}
      </a>
      {tools}
    </NodeViewWrapperShell>
  );
}

function NodeViewWrapperShell({ children, selected, url, kind }: { children: React.ReactNode; selected: boolean; url: string; kind: string }) {
  return (
    <NodeViewWrapper className={`nt-link ${selected ? "is-selected" : ""}`} data-link-preview={kind} data-url={url}>
      {children}
    </NodeViewWrapper>
  );
}

const href = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString().slice(0, 2048) : null;
  } catch {
    return null;
  }
};

export const LinkPreview = Node.create({
  name: "linkPreview",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      url: { default: null, parseHTML: (el) => el.getAttribute("data-url") },
      title: { default: null },
      description: { default: null },
      image: { default: null },
      site: { default: null },
      favicon: { default: null },
      layout: { default: "card" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-link-preview]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-link-preview": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewView);
  },

  addCommands() {
    return {
      insertLinkPreview:
        (url: string, layout: "card" | "embed" = "card") =>
        ({ commands }) => {
          const safe = href(url);
          if (!safe) return false;
          return commands.insertContent({ type: this.name, attrs: { url: safe, layout } });
        },
    };
  },

  addProseMirrorPlugins() {
    const type = this.type;
    return [
      new Plugin({
        key: new PluginKey("linkPreviewPaste"),
        props: {
          handlePaste: (view, event) => {
            const pasted = event.clipboardData?.getData("text/plain")?.trim() ?? "";
            const url = ONLY_A_URL.test(pasted) ? href(pasted) : null;
            if (!url) return false;
            const { selection } = view.state;
            // only where a link would otherwise sit alone: an empty line, nothing selected
            if (!selection.empty) return false;
            const parent = selection.$from.parent;
            if (!parent.isTextblock || parent.type.name !== "paragraph" || parent.content.size > 0) return false;

            const embed = embedFor(url);
            const node = type.create({ url, layout: embed ? "embed" : "card" });
            const from = selection.$from.before();
            view.dispatch(view.state.tr.replaceWith(from, from + parent.nodeSize, node).scrollIntoView());
            return true;
          },
        },
      }),
    ];
  },
});
