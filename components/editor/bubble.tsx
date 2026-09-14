"use client";

import { useMemo, useState } from "react";
import { NodeSelection } from "@tiptap/pm/state";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  HIGHLIGHTS,
  highlightVar,
  TEXT_COLORS,
  textColorVar,
  type HighlightName,
  type TextColorName,
} from "@/lib/doc-model";

export { useCoarsePointer, useKeyboardInset } from "./viewport";

/** A toolbar button that never steals the caret from the page. */
export function Tool({
  active,
  label,
  onClick,
  children,
  className = "",
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-lg px-1.5 text-sm transition-colors ${
        active ? "bg-sun-soft text-sun-deep" : "text-ink-soft hover:bg-paper-deep hover:text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export const Divider = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-line" />;

/** Adds a scheme a person left off, and refuses anything that isn't a web or mail link. */
export function normaliseUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : s.includes("@") && !s.includes("/") ? `mailto:${s}` : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------ selection bubble */

/**
 * The toolbar that appears over selected words. Every editor gets the same
 * core — bold to links, headings, highlights — and may add colours, inline
 * code, and tools of its own at the end.
 */
export function SelectionBubble({
  editor,
  colors = false,
  code = false,
  extra,
}: {
  editor: Editor;
  /** Text colours alongside the highlights. */
  colors?: boolean;
  /** Inline code. */
  code?: boolean;
  /** Editor-specific tools, drawn after the link button. */
  extra?: React.ReactNode;
}) {
  const on = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      highlight: (e.getAttributes("highlight").color as string | undefined) ?? (e.isActive("highlight") ? "default" : null),
      color: (e.getAttributes("textStyle").color as string | undefined) ?? null,
      href: (e.getAttributes("link").href as string | undefined) ?? "",
    }),
  });
  const [linking, setLinking] = useState(false);
  const [painting, setPainting] = useState(false);
  const [url, setUrl] = useState("");
  const [bad, setBad] = useState(false);
  // stable, so the plugin isn't handed new options on every render
  const bubbleOptions = useMemo(
    () => ({
      onHide: () => {
        setPainting(false);
        setLinking(false);
      },
    }),
    []
  );

  const applyLink = () => {
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinking(false);
      return;
    }
    const href = normaliseUrl(url);
    if (!href) {
      setBad(true);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinking(false);
  };

  const swatches = HIGHLIGHTS.map((name: HighlightName) => {
    const color = highlightVar(name);
    const active = on.highlight === color;
    return (
      <button
        key={name}
        type="button"
        aria-label={`Highlight ${name}`}
        title="Highlight"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() =>
          active ? editor.chain().focus().unsetHighlight().run() : editor.chain().focus().setHighlight({ color }).run()
        }
        className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-paper-deep"
      >
        <span
          className={`block size-4 rounded-full border border-ink/10 transition-transform ${active ? "scale-110 ring-2 ring-sun ring-offset-1 ring-offset-card" : ""}`}
          style={{ background: color }}
        />
      </button>
    );
  });

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e, state, from, to }) =>
        e.isEditable && from !== to && !e.isActive("codeBlock") && !(state.selection instanceof NodeSelection)
      }
      className="z-[75]"
      options={bubbleOptions}
    >
      <div className="anim-pop no-scrollbar flex max-w-[calc(100vw-1.5rem)] items-center gap-0.5 overflow-x-auto rounded-xl border border-line bg-card/95 p-1 shadow-xl shadow-ink/10 backdrop-blur">
        {linking ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              applyLink();
            }}
          >
            <input
              autoFocus
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setBad(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setLinking(false);
                  editor.commands.focus();
                }
              }}
              placeholder="Paste a link"
              aria-label="Link address"
              className={`h-8 w-56 rounded-lg border bg-paper px-2.5 text-sm outline-none ${bad ? "border-clay" : "border-line focus:border-sun"}`}
            />
            <Tool label="Apply link" onClick={applyLink}>
              ↵
            </Tool>
          </form>
        ) : painting ? (
          <>
            <Tool label="Back" onClick={() => setPainting(false)}>
              ‹
            </Tool>
            <span className="px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">Text</span>
            {TEXT_COLORS.map((name: TextColorName) => {
              const color = textColorVar(name);
              const active = on.color === color;
              return (
                <button
                  key={name}
                  type="button"
                  aria-label={`Text ${name}`}
                  title={`Text ${name}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    active ? editor.chain().focus().unsetColor().run() : editor.chain().focus().setColor(color).run()
                  }
                  className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold hover:bg-paper-deep ${active ? "bg-sun-soft" : ""}`}
                  style={{ color }}
                >
                  A
                </button>
              );
            })}
            <Divider />
            <span className="px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">Mark</span>
            {swatches}
          </>
        ) : (
          <>
            <Tool label="Bold" active={on.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
              <b>B</b>
            </Tool>
            <Tool label="Italic" active={on.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <i className="font-display">I</i>
            </Tool>
            <Tool label="Underline" active={on.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
              <span className="underline underline-offset-2">U</span>
            </Tool>
            <Tool label="Strikethrough" active={on.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
              <s>S</s>
            </Tool>
            {code && (
              <Tool label="Inline code" active={on.code} onClick={() => editor.chain().focus().toggleCode().run()}>
                <span className="font-mono text-xs">{"</>"}</span>
              </Tool>
            )}
            <Divider />
            <Tool label="Big heading" active={on.h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
              <span className="text-xs font-bold">H1</span>
            </Tool>
            <Tool label="Heading" active={on.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <span className="text-xs font-bold">H2</span>
            </Tool>
            <Tool label="Quote" active={on.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              ❝
            </Tool>
            <Divider />
            {colors ? (
              <Tool label="Colour" active={Boolean(on.color || on.highlight)} onClick={() => setPainting(true)}>
                <span className="relative text-sm font-bold">
                  A
                  <span
                    className="absolute -bottom-0.5 left-0 right-0 h-1 rounded-full"
                    style={{ background: on.color ?? "linear-gradient(90deg, var(--tc-rose), var(--tc-amber), var(--tc-sky))" }}
                  />
                </span>
              </Tool>
            ) : (
              <>
                {swatches}
                <Divider />
              </>
            )}
            <Tool
              label={on.link ? "Edit link" : "Add link"}
              active={on.link}
              onClick={() => {
                setUrl(on.href);
                setBad(false);
                setLinking(true);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 014 4l-1 1M9 11.5l-1 1a2.8 2.8 0 01-4-4l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Tool>
            {extra}
          </>
        )}
      </div>
    </BubbleMenu>
  );
}
