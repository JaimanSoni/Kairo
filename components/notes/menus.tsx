"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useEditorState, type Editor, type Range } from "@tiptap/react";
import { parseQuickAdd } from "@/lib/nlp";
import { Divider, Tool } from "../editor/bubble";
import type { SlashItem } from "../editor/slash";
import { useCoarsePointer, useKeyboardInset } from "../editor/viewport";
import { useApp, visibleLists } from "../store";
import { blockAt, moveBlock, type MenuStore, type MentionItem } from "./extensions";
import { titleOf } from "./actions";
import { pathOf } from "./format";
import {
  GlyphBullets,
  GlyphCallout,
  GlyphCode,
  GlyphDate,
  GlyphDivider,
  GlyphDown,
  GlyphHeading,
  GlyphLinkPage,
  GlyphNumbers,
  GlyphPage,
  GlyphQuote,
  GlyphRedo,
  GlyphTable,
  GlyphTask,
  GlyphText,
  GlyphTodo,
  GlyphToggle,
  GlyphUndo,
  GlyphUp,
} from "./glyphs";
import { PageIcon } from "./pickers";
import { IconPlus } from "../ui";

/* ------------------------------------------------------------ slash items */

export function buildNoteSlashItems(opts: {
  /** Makes a sub-page of this page and returns its id. */
  newSubPage: () => Promise<string | null>;
  openPage: (id: string) => void;
  /** Opens the task prompt where the caret is. */
  askTask: () => void;
  todayLabel: () => string;
}): SlashItem[] {
  const clear = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);
  const BASIC = "Basic blocks";
  const PAGES = "Pages";
  const KAIRO = "From Kairo";

  return [
    { id: "text", group: BASIC, icon: <GlyphText />, title: "Text", hint: "Just start writing", keywords: ["paragraph", "plain", "p"],
      run: (e, r) => clear(e, r).setParagraph().run() },
    { id: "h1", group: BASIC, icon: <GlyphHeading level={1} />, title: "Heading 1", hint: "Big section heading", keywords: ["heading", "title", "h1", "#"],
      run: (e, r) => clear(e, r).setNode("heading", { level: 1 }).run() },
    { id: "h2", group: BASIC, icon: <GlyphHeading level={2} />, title: "Heading 2", hint: "Medium section heading", keywords: ["heading", "subtitle", "h2", "##"],
      run: (e, r) => clear(e, r).setNode("heading", { level: 2 }).run() },
    { id: "h3", group: BASIC, icon: <GlyphHeading level={3} />, title: "Heading 3", hint: "Small section heading", keywords: ["heading", "h3", "###"],
      run: (e, r) => clear(e, r).setNode("heading", { level: 3 }).run() },
    { id: "todo", group: BASIC, icon: <GlyphTodo />, title: "To-do list", hint: "Track things with a checkbox", keywords: ["todo", "checkbox", "check", "task", "[]"],
      run: (e, r) => clear(e, r).toggleTaskList().run() },
    { id: "bullets", group: BASIC, icon: <GlyphBullets />, title: "Bulleted list", hint: "A simple list", keywords: ["list", "ul", "bullet", "-"],
      run: (e, r) => clear(e, r).toggleBulletList().run() },
    { id: "numbers", group: BASIC, icon: <GlyphNumbers />, title: "Numbered list", hint: "A list in order", keywords: ["list", "ol", "ordered", "1"],
      run: (e, r) => clear(e, r).toggleOrderedList().run() },
    { id: "toggle", group: BASIC, icon: <GlyphToggle />, title: "Toggle list", hint: "Tuck details away inside", keywords: ["toggle", "collapse", "details", "fold", "accordion"],
      run: (e, r) => clear(e, r).setDetails().run() },
    { id: "quote", group: BASIC, icon: <GlyphQuote />, title: "Quote", hint: "Something someone said", keywords: ["blockquote", "cite", ">"],
      run: (e, r) => clear(e, r).toggleBlockquote().run() },
    { id: "callout", group: BASIC, icon: <GlyphCallout />, title: "Callout", hint: "Make something stand out", keywords: ["callout", "note", "info", "tip", "warning"],
      run: (e, r) => clear(e, r).setCallout("sparkle").run() },
    { id: "divider", group: BASIC, icon: <GlyphDivider />, title: "Divider", hint: "Split the page", keywords: ["hr", "line", "separator", "---"],
      run: (e, r) => clear(e, r).setHorizontalRule().run() },
    { id: "code", group: BASIC, icon: <GlyphCode />, title: "Code block", hint: "Code, coloured by language", keywords: ["code", "codeblock", "pre", "```", "snippet", "javascript", "python", "sql", "syntax"],
      run: (e, r) => clear(e, r).toggleCodeBlock().run() },
    { id: "table", group: BASIC, icon: <GlyphTable />, title: "Table", hint: "Rows and columns", keywords: ["table", "grid", "spreadsheet", "columns"],
      run: (e, r) => clear(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },

    { id: "page", group: PAGES, icon: <GlyphPage />, title: "Page", hint: "A new page inside this one", keywords: ["page", "subpage", "child", "new"],
      run: async (e, r) => {
        clear(e, r).run();
        const id = await opts.newSubPage();
        if (!id) return;
        e.chain().focus().insertPageLink(id).run();
        opts.openPage(id);
      } },
    { id: "link", group: PAGES, icon: <GlyphLinkPage />, title: "Link to page", hint: "Mention another page", keywords: ["link", "mention", "reference", "@", "[["],
      run: (e, r) => clear(e, r).insertContent("@").run() },

    { id: "task", group: KAIRO, icon: <GlyphTask />, title: "Kairo task", hint: "A real task, ticked here or anywhere", keywords: ["task", "kairo", "todo", "remind", "plan"],
      run: (e, r) => {
        clear(e, r).run();
        opts.askTask();
      } },
    { id: "date", group: KAIRO, icon: <GlyphDate />, title: "Today's date", hint: "Stamp the date", keywords: ["date", "today", "now", "day"],
      run: (e, r) => clear(e, r).insertContent(opts.todayLabel()).run() },
  ];
}

/* ------------------------------------------------------------ mention menu */

export function MentionMenu({ store }: { store: MenuStore<MentionItem> }) {
  const s = useSyncExternalStore(store.subscribe, store.get, store.get);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const rect = s.rect?.();
    if (!el || !rect) return;
    const vv = window.visualViewport;
    const bottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
    let top = rect.bottom + 8;
    if (top + el.offsetHeight > bottom - 8) top = Math.max(8, rect.top - el.offsetHeight - 8);
    el.style.top = `${top}px`;
    el.style.left = `${Math.max(8, Math.min(rect.left - 12, window.innerWidth - el.offsetWidth - 8))}px`;
    el.style.visibility = "visible";
    el.querySelector<HTMLElement>(`[data-index="${s.index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [s]);

  if (!s.open || s.hidden) return null;

  return createPortal(
    <div
      ref={ref}
      role="listbox"
      aria-label="Link to a page"
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      className="anim-pop no-scrollbar z-[80] max-h-[min(20rem,55vh)] w-80 overflow-y-auto rounded-2xl border border-line bg-card/95 p-1.5 shadow-2xl shadow-ink/10 backdrop-blur"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">Link to page</div>
      {s.items.length === 0 && <p className="px-3 py-3 text-sm text-ink-faint">Type a page&apos;s name</p>}
      {s.items.map((item, i) => {
        const active = i === s.index;
        return (
          <button
            key={item.kind === "page" ? item.page.id : "new"}
            type="button"
            role="option"
            aria-selected={active}
            data-index={i}
            onMouseEnter={() => store.set({ index: i })}
            onClick={() => s.pick?.(item)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition-colors ${active ? "bg-sun-soft" : "hover:bg-paper-deep"}`}
          >
            <span className="grid w-5 shrink-0 place-items-center" aria-hidden>
              {item.kind === "page" ? <PageIcon icon={item.page.icon} size={18} /> : <IconPlus size={13} className="text-sun-deep" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {item.kind === "page" ? titleOf(item.page) : <>New page “<b>{item.title}</b>”</>}
              </span>
              {item.kind === "page" && pathOf(item.page.id) && <span className="block truncate text-xs text-ink-faint">{pathOf(item.page.id)}</span>}
              {item.kind === "new" && <span className="block truncate text-xs text-ink-faint">Made inside this page</span>}
            </span>
          </button>
        );
      })}
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------ task prompt */

/**
 * "/task" asks for the task in place. What's typed goes through the same
 * quick-add reading as Capture — "pay rent friday" lands on Friday — and the
 * page gets a live chip for it.
 */
export function TaskPrompt({ editor, pos, onClose }: { editor: Editor; pos: number; onClose: () => void }) {
  const { state, addTask, showToast } = useApp();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLFormElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const at = Math.min(pos, editor.state.doc.content.size);
    const c = editor.view.coordsAtPos(at);
    el.style.top = `${Math.min(c.bottom + 8, window.innerHeight - el.offsetHeight - 8)}px`;
    el.style.left = `${Math.max(8, Math.min(c.left - 12, window.innerWidth - el.offsetWidth - 8))}px`;
    el.style.visibility = "visible";
  }, [editor, pos]);

  const submit = async () => {
    const raw = value.trim();
    if (!raw || busy) return;
    setBusy(true);
    const parsed = parseQuickAdd(raw, visibleLists(state));
    const title = parsed.title || raw;
    const id = await addTask({ ...parsed, title });
    setBusy(false);
    if (!id) {
      showToast({ message: "Couldn't make that task." });
      return;
    }
    const at = Math.min(pos, editor.state.doc.content.size);
    editor.chain().focus().insertContentAt(at, [{ type: "taskRef", attrs: { id, title } }, { type: "text", text: " " }]).run();
    onClose();
  };

  return createPortal(
    <>
      <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-[78] cursor-default" onClick={onClose} />
      <form
        ref={ref}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
        className="anim-pop z-[79] flex w-[min(24rem,calc(100vw-1rem))] items-center gap-2 rounded-2xl border border-line bg-card p-1.5 pl-3 shadow-2xl shadow-ink/10"
      >
        <span className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-sun text-[10px] text-sun" aria-hidden />
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
              editor.commands.focus();
            }
          }}
          placeholder="A task… “call the bank tomorrow 10am”"
          aria-label="New Kairo task"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
        />
        <button type="submit" disabled={!value.trim() || busy} className="shrink-0 rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-paper disabled:opacity-40">
          {busy ? "…" : "Add"}
        </button>
      </form>
    </>,
    document.body
  );
}

/* -------------------------------------------------------------- table bar */

/** Row and column tools, floating above whichever table the caret is in. */
export function TableBar({ editor }: { editor: Editor }) {
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({ inTable: e.isEditable && e.isActive("table"), from: e.state.selection.from }),
  });
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !st.inTable) return;
    const place = () => {
      let node: Node | null = editor.view.domAtPos(Math.min(st.from, editor.state.doc.content.size)).node;
      if (node && !(node instanceof HTMLElement)) node = node.parentElement;
      const table = (node as HTMLElement | null)?.closest("table");
      if (!table) return;
      const r = table.getBoundingClientRect();
      el.style.top = `${Math.max(8, r.top - el.offsetHeight - 6)}px`;
      el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - el.offsetWidth - 8))}px`;
      el.style.visibility = r.bottom < 0 || r.top > window.innerHeight ? "hidden" : "visible";
    };
    place();
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [editor, st]);

  if (!st.inTable) return null;

  return createPortal(
    <div
      ref={ref}
      role="toolbar"
      aria-label="Table"
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      onMouseDown={(e) => e.preventDefault()}
      className="anim-pop no-scrollbar z-[74] flex max-w-[calc(100vw-1rem)] items-center gap-0.5 overflow-x-auto rounded-xl border border-line bg-card/95 p-1 text-xs shadow-xl shadow-ink/10 backdrop-blur"
    >
      <Tool label="Add a row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
        <span className="px-1 text-xs font-semibold">+ Row</span>
      </Tool>
      <Tool label="Add a column to the right" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        <span className="px-1 text-xs font-semibold">+ Column</span>
      </Tool>
      <Divider />
      <Tool label="Delete this row" onClick={() => editor.chain().focus().deleteRow().run()}>
        <span className="px-1 text-xs">− Row</span>
      </Tool>
      <Tool label="Delete this column" onClick={() => editor.chain().focus().deleteColumn().run()}>
        <span className="px-1 text-xs">− Column</span>
      </Tool>
      <Divider />
      <Tool label="Header row on or off" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
        <span className="px-1 text-xs">Header</span>
      </Tool>
      <Tool label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
        <span className="px-1 text-xs text-clay">Delete</span>
      </Tool>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------ phone dock */

/**
 * On a phone there's no hover, so no block handle: the dock carries the block
 * tools instead, riding on top of the keyboard.
 */
export function NotesDock({ editor }: { editor: Editor }) {
  const inset = useKeyboardInset();
  const coarse = useCoarsePointer();
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      focused: e.isFocused,
      editable: e.isEditable,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      bullet: e.isActive("bulletList"),
      todo: e.isActive("taskList"),
      h2: e.isActive("heading", { level: 2 }),
    }),
  });
  if (!coarse || !st.focused || !st.editable) return null;

  const insertTrigger = (char: string) => {
    const { from } = editor.state.selection;
    const before = from > 1 ? editor.state.doc.textBetween(from - 1, from, "\n", "\n") : "";
    editor.chain().focus().insertContent(before && !/\s/.test(before) ? ` ${char}` : char).run();
  };
  const move = (dir: -1 | 1) => {
    const b = blockAt(editor.state.doc, editor.state.selection.from);
    if (b) moveBlock(editor, b.pos, dir);
  };

  return (
    <div
      className="fixed inset-x-0 z-[60] flex justify-center px-3"
      style={{ bottom: inset > 0 ? inset + 8 : "calc(4.75rem + env(safe-area-inset-bottom))" }}
    >
      <div
        onMouseDown={(e) => e.preventDefault()}
        className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-line bg-card/95 p-1 shadow-xl shadow-ink/10 backdrop-blur"
      >
        <Tool label="Insert a block" onClick={() => insertTrigger("/")}>
          <span className="font-semibold">/</span>
        </Tool>
        <Tool label="Link to a page" onClick={() => insertTrigger("@")}>
          <span className="font-semibold">@</span>
        </Tool>
        <Tool label="Heading" active={st.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <span className="text-xs font-bold">H</span>
        </Tool>
        <Tool label="To-do list" active={st.todo} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <GlyphTodo />
        </Tool>
        <Tool label="Bulleted list" active={st.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <GlyphBullets />
        </Tool>
        <Divider />
        <Tool label="Move block up" onClick={() => move(-1)}>
          <GlyphUp />
        </Tool>
        <Tool label="Move block down" onClick={() => move(1)}>
          <GlyphDown />
        </Tool>
        <Tool label="Undo" onClick={() => editor.chain().focus().undo().run()} className={st.canUndo ? "" : "opacity-35"}>
          <GlyphUndo />
        </Tool>
        <Tool label="Redo" onClick={() => editor.chain().focus().redo().run()} className={st.canRedo ? "" : "opacity-35"}>
          <GlyphRedo />
        </Tool>
        <Tool label="Done" onClick={() => editor.commands.blur()}>
          <span className="text-xs font-semibold text-sun-deep">Done</span>
        </Tool>
      </div>
    </div>
  );
}
