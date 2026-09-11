"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { NodeSelection } from "@tiptap/pm/state";
import { useEditorState, type Editor, type Range } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { HIGHLIGHTS, highlightVar, type HighlightName } from "@/lib/journal-shared";
import type { SlashItem, SlashStore } from "./extensions";

/**
 * Everything that floats over the page: the slash menu, the selection bubble,
 * and the writing dock. None of it is visible until it's useful — a blank page
 * with a toolbar across the top is a form to fill in, not a place to write.
 */

export const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/* ------------------------------------------------------------ slash items */

export function buildSlashItems(opts: {
  prompt: () => string;
  wins: () => Promise<string[]>;
  notify: (message: string) => void;
}): SlashItem[] {
  const clear = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

  return [
    { id: "text", group: "Write", icon: "¶", title: "Text", hint: "Just keep writing", keywords: ["paragraph", "plain", "p"],
      run: (e, r) => clear(e, r).setParagraph().run() },
    { id: "h1", group: "Write", icon: "H1", title: "Big heading", hint: "A title for part of the day", keywords: ["heading", "title", "h1", "#"],
      run: (e, r) => clear(e, r).setNode("heading", { level: 1 }).run() },
    { id: "h2", group: "Write", icon: "H2", title: "Heading", hint: "Break the page into parts", keywords: ["heading", "subtitle", "h2", "##"],
      run: (e, r) => clear(e, r).setNode("heading", { level: 2 }).run() },
    { id: "h3", group: "Write", icon: "H3", title: "Small heading", hint: "A quiet label", keywords: ["heading", "h3", "###"],
      run: (e, r) => clear(e, r).setNode("heading", { level: 3 }).run() },
    { id: "quote", group: "Write", icon: "❝", title: "Quote", hint: "Something someone said", keywords: ["blockquote", "cite", ">"],
      run: (e, r) => clear(e, r).toggleBlockquote().run() },
    { id: "thought", group: "Write", icon: "💭", title: "Thought", hint: "Set a thought apart", keywords: ["callout", "note", "aside", "idea"],
      run: (e, r) => clear(e, r).setCallout("💭").run() },
    { id: "spark", group: "Write", icon: "✨", title: "Highlight of the day", hint: "The moment worth finding again", keywords: ["callout", "best", "moment", "highlight"],
      run: (e, r) => clear(e, r).setCallout("✨").run() },
    { id: "grateful", group: "Write", icon: "🙏", title: "Grateful for", hint: "Something that helped", keywords: ["gratitude", "thanks", "callout"],
      run: (e, r) => clear(e, r).setCallout("🙏").run() },

    { id: "bullets", group: "Structure", icon: "•", title: "Bulleted list", hint: "Loose thoughts, in a row", keywords: ["list", "ul", "bullet", "-"],
      run: (e, r) => clear(e, r).toggleBulletList().run() },
    { id: "numbers", group: "Structure", icon: "1.", title: "Numbered list", hint: "Things in order", keywords: ["list", "ol", "ordered", "1"],
      run: (e, r) => clear(e, r).toggleOrderedList().run() },
    { id: "checklist", group: "Structure", icon: "☑", title: "Checklist", hint: "Tick-boxes on the page", keywords: ["todo", "task", "check", "[]"],
      run: (e, r) => clear(e, r).toggleTaskList().run() },
    { id: "divider", group: "Structure", icon: "✱", title: "Divider", hint: "A breath between parts", keywords: ["hr", "line", "separator", "---"],
      run: (e, r) => clear(e, r).setHorizontalRule().run() },
    { id: "code", group: "Structure", icon: "</>", title: "Code", hint: "Monospaced, untouched", keywords: ["codeblock", "pre", "```"],
      run: (e, r) => clear(e, r).toggleCodeBlock().run() },

    { id: "time", group: "Kairo", icon: "🕐", title: "The time", hint: "Mark when you came back", keywords: ["timestamp", "now", "clock", "stamp"],
      run: (e, r) => clear(e, r).insertEntryTime(nowHHMM()).run() },
    { id: "prompt", group: "Kairo", icon: "?", title: "A prompt", hint: "A question to write toward", keywords: ["question", "inspire", "stuck", "idea"],
      run: (e, r) =>
        clear(e, r)
          .insertContent([
            { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: opts.prompt() }] }] },
            { type: "paragraph" },
          ])
          .run() },
    { id: "good", group: "Kairo", icon: "3", title: "Three good things", hint: "Small, ordinary, true", keywords: ["gratitude", "good", "three", "list"],
      run: (e, r) =>
        clear(e, r)
          .insertContent([
            { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Three good things" }] },
            { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
          ])
          .run() },
    { id: "wins", group: "Kairo", icon: "✓", title: "What I finished", hint: "Pull in this day's wins from Kairo", keywords: ["wins", "done", "tasks", "log", "finished"],
      run: async (e, r) => {
        clear(e, r).run();
        const lines = await opts.wins();
        if (lines.length === 0) {
          opts.notify("Nothing was finished in Kairo on this day.");
          return;
        }
        e.chain()
          .focus()
          .insertContent([
            {
              type: "callout",
              attrs: { emoji: "✅" },
              content: [
                { type: "paragraph", content: [{ type: "text", text: "What I finished", marks: [{ type: "bold" }] }] },
                {
                  type: "taskList",
                  content: lines.map((text) => ({
                    type: "taskItem",
                    attrs: { checked: true },
                    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
                  })),
                },
              ],
            },
            { type: "paragraph" },
          ])
          .run();
      } },
  ];
}

export function filterSlash(items: SlashItem[], query: string): SlashItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return items;
  return items.filter((i) => i.title.toLowerCase().includes(q) || i.keywords.some((k) => k.startsWith(q)));
}

/* ------------------------------------------------------------- slash menu */

export function SlashMenu({ store }: { store: SlashStore }) {
  const s = useSyncExternalStore(store.subscribe, store.get, store.get);
  const ref = useRef<HTMLDivElement>(null);

  // Placed by writing to the node, not by state: the position is a fact about
  // the DOM, and routing it through a render would draw the menu once in the
  // wrong place before correcting itself.
  useLayoutEffect(() => {
    const el = ref.current;
    const rect = s.rect?.();
    if (!el || !rect) return;
    const vv = window.visualViewport;
    const bottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    let top = rect.bottom + 8;
    if (top + h > bottom - 8) top = Math.max(8, rect.top - h - 8);
    const left = Math.max(8, Math.min(rect.left - 12, window.innerWidth - w - 8));
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    el.style.visibility = "visible";
    el.querySelector<HTMLElement>(`[data-index="${s.index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [s]);

  if (!s.open || s.hidden) return null;

  let n = -1;
  const groups = (["Write", "Structure", "Kairo"] as const)
    .map((g) => ({ g, items: s.items.filter((i) => i.group === g) }))
    .filter((x) => x.items.length > 0);

  return createPortal(
    <div
      ref={ref}
      role="listbox"
      aria-label="Insert a block"
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      className="anim-pop no-scrollbar z-[80] max-h-[min(22rem,60vh)] w-72 overflow-y-auto rounded-2xl border border-line bg-card/95 p-1.5 shadow-2xl shadow-ink/10 backdrop-blur"
      onMouseDown={(e) => e.preventDefault() /* keep the caret in the page */}
    >
      {s.items.length === 0 ? (
        <p className="px-3 py-3 text-sm text-ink-faint">No blocks match &ldquo;{s.query}&rdquo;</p>
      ) : (
        groups.map(({ g, items }) => (
          <div key={g} className="mb-1 last:mb-0">
            <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">
              {g === "Kairo" ? "From Kairo" : g}
            </div>
            {items.map((item) => {
              n++;
              const i = n;
              const active = i === s.index;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-index={i}
                  onMouseEnter={() => store.set({ index: i })}
                  onClick={() => s.pick?.(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    active ? "bg-sun-soft" : "hover:bg-paper-deep"
                  }`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-lg border text-sm font-semibold ${
                      active ? "border-sun/40 bg-card text-sun-deep" : "border-line bg-paper text-ink-soft"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-ink-faint">{item.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>,
    document.body
  );
}

/* ------------------------------------------------------ selection bubble */

function Tool({
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
      className={`grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-sm transition-colors ${
        active ? "bg-sun-soft text-sun-deep" : "text-ink-soft hover:bg-paper-deep hover:text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** Adds a scheme a person left off, and refuses anything that isn't a web or mail link. */
function normaliseUrl(raw: string): string | null {
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

export function SelectionBubble({ editor }: { editor: Editor }) {
  const on = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      highlight: (e.getAttributes("highlight").color as string | undefined) ?? (e.isActive("highlight") ? "default" : null),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
    }),
  });
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("");
  const [bad, setBad] = useState(false);

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

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e, state, from, to }) =>
        from !== to && !e.isActive("codeBlock") && !(state.selection instanceof NodeSelection)
      }
      className="z-[75]"
    >
      <div className="anim-pop flex items-center gap-0.5 rounded-xl border border-line bg-card/95 p-1 shadow-xl shadow-ink/10 backdrop-blur">
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
            <span className="mx-0.5 h-5 w-px bg-line" />
            <Tool label="Big heading" active={on.h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
              <span className="text-xs font-bold">H1</span>
            </Tool>
            <Tool label="Heading" active={on.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <span className="text-xs font-bold">H2</span>
            </Tool>
            <Tool label="Quote" active={on.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              ❝
            </Tool>
            <span className="mx-0.5 h-5 w-px bg-line" />
            {HIGHLIGHTS.map((name: HighlightName) => {
              const color = highlightVar(name);
              const active = on.highlight === color;
              return (
                <button
                  key={name}
                  type="button"
                  aria-label={`Highlight ${name}`}
                  title={`Highlight`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    active
                      ? editor.chain().focus().unsetHighlight().run()
                      : editor.chain().focus().setHighlight({ color }).run()
                  }
                  className="grid size-8 place-items-center rounded-lg hover:bg-paper-deep"
                >
                  <span
                    className={`block size-4 rounded-full border border-ink/10 transition-transform ${active ? "scale-110 ring-2 ring-sun ring-offset-1 ring-offset-card" : ""}`}
                    style={{ background: color }}
                  />
                </button>
              );
            })}
            <span className="mx-0.5 h-5 w-px bg-line" />
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
          </>
        )}
      </div>
    </BubbleMenu>
  );
}

/* ------------------------------------------------------------ writing dock */

const noopSubscribe = () => () => {};

/** How far the on-screen keyboard has pushed up from the bottom, in px. */
function useKeyboardInset(): number {
  return useSyncExternalStore(
    (cb) => {
      const vv = window.visualViewport;
      vv?.addEventListener("resize", cb);
      vv?.addEventListener("scroll", cb);
      window.addEventListener("resize", cb);
      return () => {
        vv?.removeEventListener("resize", cb);
        vv?.removeEventListener("scroll", cb);
        window.removeEventListener("resize", cb);
      };
    },
    () => {
      const vv = window.visualViewport;
      return vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    },
    () => 0
  );
}

function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false
  );
}

/**
 * The writing dock.
 *
 * On a phone it rides on top of the keyboard, because that is the only part
 * of the screen a thumb can reach while typing. On a desktop it sits low and
 * centred, and steps back while you type — the keyboard is already doing its
 * job there, and a toolbar that stays lit is one more thing to look at.
 */
export function WritingDock({
  editor,
  listening,
  onVoice,
  voiceSupported,
  typing,
  onFocusMode,
  focusMode,
}: {
  editor: Editor;
  listening: boolean;
  onVoice: () => void;
  voiceSupported: boolean;
  typing: boolean;
  onFocusMode: () => void;
  focusMode: boolean;
}) {
  const inset = useKeyboardInset();
  const coarse = useCoarsePointer();
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      focused: e.isFocused,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      bullet: e.isActive("bulletList"),
      tasks: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      h2: e.isActive("heading", { level: 2 }),
    }),
  });

  // on a phone the dock only exists while writing; the keyboard is its anchor
  if (coarse && !st.focused && !listening) return null;

  const openSlash = () => {
    const { from } = editor.state.selection;
    const before = from > 1 ? editor.state.doc.textBetween(from - 1, from, "\n", "\n") : "";
    // the slash menu only opens after a space or at a line's start
    const insert = before && !/\s/.test(before) ? " /" : "/";
    editor.chain().focus().insertContent(insert).run();
  };

  return (
    <div
      className={`fixed inset-x-0 z-[60] flex justify-center px-3 transition-opacity duration-300 md:px-0 ${
        !coarse && typing && !listening ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      // With the keyboard up the dock rides on it. Without one (a tablet with a
      // hardware keyboard, or the moment before it opens) it clears the tab bar
      // instead of sitting on top of it.
      style={{ bottom: coarse ? (inset > 0 ? inset + 8 : "calc(4.75rem + env(safe-area-inset-bottom))") : 20 }}
    >
      <div className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-line bg-card/95 p-1 shadow-xl shadow-ink/10 backdrop-blur">
        <Tool label="Insert a block" onClick={openSlash}>
          <span className="font-semibold">/</span>
        </Tool>
        <Tool label="Heading" active={st.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <span className="text-xs font-bold">H</span>
        </Tool>
        <Tool label="Checklist" active={st.tasks} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          ☑
        </Tool>
        <Tool label="Bulleted list" active={st.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •
        </Tool>
        <Tool label="Quote" active={st.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          ❝
        </Tool>
        <Tool label="Mark the time" onClick={() => editor.chain().focus().insertEntryTime(nowHHMM()).run()}>
          🕐
        </Tool>
        {voiceSupported && (
          <Tool label={listening ? "Stop dictating" : "Dictate"} active={listening} onClick={onVoice}>
            {listening ? <span className="size-2.5 rounded-sm bg-clay" /> : "🎙"}
          </Tool>
        )}
        <span className="mx-0.5 h-5 w-px shrink-0 bg-line" />
        <Tool label="Undo" onClick={() => editor.chain().focus().undo().run()} className={st.canUndo ? "" : "opacity-35"}>
          ↶
        </Tool>
        <Tool label="Redo" onClick={() => editor.chain().focus().redo().run()} className={st.canRedo ? "" : "opacity-35"}>
          ↷
        </Tool>
        {!coarse && (
          <Tool label={focusMode ? "Leave focus mode" : "Focus mode"} active={focusMode} onClick={onFocusMode}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="2.2" fill="currentColor" />
              <path d="M2 5V3a1 1 0 011-1h2M11 2h2a1 1 0 011 1v2M14 11v2a1 1 0 01-1 1h-2M5 14H3a1 1 0 01-1-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Tool>
        )}
        {coarse && (
          <Tool label="Done" onClick={() => editor.commands.blur()}>
            <span className="text-xs font-semibold text-sun-deep">Done</span>
          </Tool>
        )}
      </div>
    </div>
  );
}
