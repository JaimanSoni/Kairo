"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { parseQuickAdd } from "@/lib/nlp";
import { useApp, visibleLists } from "../store";
import { Kbd } from "../ui";
import {
  blockAt,
  deleteBlock,
  duplicateBlock,
  endBlockDrag,
  moveBlock,
  startBlockDrag,
  textOfBlock,
  turnInto,
  type BlockKind,
} from "./extensions";

/**
 * The handle beside each block, on a pointer that can hover: "+" adds a block
 * below, and the grip drags the block somewhere else or, clicked, opens what
 * can be done to it. ProseMirror moves the block itself — the grip only tells
 * it which block is being carried.
 */

type Spot = { pos: number; top: number; left: number };

const ITEM_TYPES = new Set(["listItem", "taskItem"]);

export function BlockHandle({ editor, area }: { editor: Editor; area: React.RefObject<HTMLDivElement | null> }) {
  const [hover, setHover] = useState<Spot | null>(null);
  const [menu, setMenu] = useState<Spot | null>(null);
  const frame = useRef(0);
  const carrying = useRef(false);

  useEffect(() => {
    if (menu) return;
    const onMove = (e: MouseEvent) => {
      if (carrying.current) return;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const wrap = area.current;
        if (!wrap || !editor.isEditable || editor.isDestroyed) {
          setHover(null);
          return;
        }
        const rect = wrap.getBoundingClientRect();
        // the gutter left of the page counts too, or the handle could never be reached
        if (e.clientY < rect.top || e.clientY > rect.bottom || e.clientX < rect.left - 80 || e.clientX > rect.right + 16) {
          setHover(null);
          return;
        }
        const view = editor.view;
        const x = Math.min(Math.max(e.clientX, rect.left + 6), rect.right - 6);
        const found = view.posAtCoords({ left: x, top: e.clientY });
        if (!found) return;
        const block = blockAt(view.state.doc, found.inside >= 0 ? found.inside : found.pos);
        const dom = block ? view.nodeDOM(block.pos) : null;
        if (!block || !(dom instanceof HTMLElement)) {
          setHover(null);
          return;
        }
        const r = dom.getBoundingClientRect();
        const css = getComputedStyle(dom);
        const line = parseFloat(css.lineHeight) || 26;
        const top = Math.round(r.top + (parseFloat(css.paddingTop) || 0) + Math.min(line, r.height) / 2 - 12);
        const indent = ITEM_TYPES.has(block.node.type.name) ? Math.max(0, r.left - rect.left - 18) : 0;
        const left = Math.max(4, Math.round(rect.left + indent - 50));
        setHover((h) => (h && h.pos === block.pos && h.top === top && h.left === left ? h : { pos: block.pos, top, left }));
      });
    };
    const onLeave = () => setHover(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onLeave, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onLeave);
      document.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(frame.current);
    };
  }, [editor, area, menu]);

  const spot = menu ?? hover;
  if (!spot) return null;

  const addBelow = () => {
    const node = editor.state.doc.nodeAt(spot.pos);
    if (!node) return;
    const end = spot.pos + node.nodeSize;
    const fresh = ITEM_TYPES.has(node.type.name)
      ? { type: node.type.name, ...(node.type.name === "taskItem" ? { attrs: { checked: false } } : {}), content: [{ type: "paragraph" }] }
      : { type: "paragraph" };
    const inner = ITEM_TYPES.has(node.type.name) ? end + 2 : end + 1;
    editor.chain().focus().insertContentAt(end, fresh).setTextSelection(inner).insertContent("/").run();
    setHover(null);
  };

  return createPortal(
    <>
      <div
        style={{ position: "fixed", top: spot.top, left: spot.left }}
        className="z-[62] flex items-center"
        onMouseDown={(e) => e.preventDefault()}
      >
        <button
          type="button"
          onClick={addBelow}
          aria-label="Add a block below"
          title="Add a block below"
          className="grid size-6 place-items-center rounded-md text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          draggable
          aria-label="Drag to move, or click for options"
          title="Drag to move · click for options"
          onClick={() => setMenu(spot)}
          onDragStart={(e) => {
            if (startBlockDrag(editor, spot.pos, e.dataTransfer)) carrying.current = true;
          }}
          onDragEnd={() => {
            carrying.current = false;
            endBlockDrag(editor);
            setHover(null);
          }}
          className="grid h-6 w-5 cursor-grab place-items-center rounded-md text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink active:cursor-grabbing"
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
            <circle cx="3" cy="3" r="1.2" />
            <circle cx="7" cy="3" r="1.2" />
            <circle cx="3" cy="7" r="1.2" />
            <circle cx="7" cy="7" r="1.2" />
            <circle cx="3" cy="11" r="1.2" />
            <circle cx="7" cy="11" r="1.2" />
          </svg>
        </button>
      </div>
      {menu && <BlockMenu editor={editor} spot={menu} onClose={() => setMenu(null)} />}
    </>,
    document.body
  );
}

const TURN_INTO: { kind: BlockKind; label: string; icon: string }[] = [
  { kind: "text", label: "Text", icon: "¶" },
  { kind: "h1", label: "Heading 1", icon: "H1" },
  { kind: "h2", label: "Heading 2", icon: "H2" },
  { kind: "h3", label: "Heading 3", icon: "H3" },
  { kind: "todo", label: "To-do list", icon: "☑" },
  { kind: "bullet", label: "Bulleted list", icon: "•" },
  { kind: "numbered", label: "Numbered list", icon: "1." },
  { kind: "toggle", label: "Toggle list", icon: "▸" },
  { kind: "quote", label: "Quote", icon: "❝" },
  { kind: "callout", label: "Callout", icon: "💡" },
  { kind: "code", label: "Code", icon: "</>" },
];

function BlockMenu({ editor, spot, onClose }: { editor: Editor; spot: Spot; onClose: () => void }) {
  const { state, addTask, showToast } = useApp();
  const [turning, setTurning] = useState(false);
  const node = editor.state.doc.nodeAt(spot.pos);
  const words = textOfBlock(editor.state.doc, spot.pos);
  const canTurn = Boolean(node && !node.isAtom && node.type.name !== "table");
  const canTask = Boolean(words?.text.trim()) && node?.type.name !== "codeBlock";

  const run = (fn: () => void) => {
    onClose();
    fn();
  };

  const makeTask = async () => {
    onClose();
    const before = textOfBlock(editor.state.doc, spot.pos);
    if (!before?.text.trim()) return;
    const raw = before.text.trim().slice(0, 500);
    const parsed = parseQuickAdd(raw, visibleLists(state));
    const title = parsed.title || raw;
    const id = await addTask({ ...parsed, title });
    if (!id) {
      showToast({ message: "Couldn't make that task." });
      return;
    }
    // the words become the task, if they're still the words that were there
    const now = textOfBlock(editor.state.doc, spot.pos);
    if (now && now.text === before.text) {
      editor.chain().focus().insertContentAt({ from: now.from, to: now.to }, [{ type: "taskRef", attrs: { id, title } }]).run();
    }
    showToast({ message: `Added “${title}” to Kairo.` });
  };

  const row = (label: string, icon: React.ReactNode, onClick: () => void, hint?: string, danger = false) => (
    <button
      key={label}
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
        danger ? "text-clay hover:bg-clay-soft" : "text-ink-soft hover:bg-paper-deep hover:text-ink"
      }`}
    >
      <span className="grid w-5 place-items-center text-xs font-semibold" aria-hidden>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {hint && <Kbd>{hint}</Kbd>}
    </button>
  );

  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = mac ? "⌘" : "Ctrl+";

  return (
    <>
      <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-[63] cursor-default" onClick={onClose} />
      <div
        role="menu"
        aria-label="Block options"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        style={{ position: "fixed", top: Math.min(spot.top + 28, window.innerHeight - 360), left: spot.left }}
        className="anim-pop z-[64] w-60 rounded-xl border border-line bg-card p-1 shadow-2xl shadow-ink/10"
      >
        {turning ? (
          <>
            {row("Back", "‹", () => setTurning(false))}
            <div className="my-1 h-px bg-line" />
            {TURN_INTO.map((t) => row(t.label, t.icon, () => run(() => turnInto(editor, spot.pos, t.kind))))}
          </>
        ) : (
          <>
            {canTurn && row("Turn into", "↻", () => setTurning(true))}
            {canTask && row("Make it a Kairo task", "✓", () => void makeTask())}
            {(canTurn || canTask) && <div className="my-1 h-px bg-line" />}
            {row("Duplicate", "⧉", () => run(() => duplicateBlock(editor, spot.pos)), `${mod}D`)}
            {row("Move up", "↑", () => run(() => moveBlock(editor, spot.pos, -1)), `${mod}⇧↑`)}
            {row("Move down", "↓", () => run(() => moveBlock(editor, spot.pos, 1)), `${mod}⇧↓`)}
            <div className="my-1 h-px bg-line" />
            {row("Delete", "🗑", () => run(() => deleteBlock(editor, spot.pos)), undefined, true)}
          </>
        )}
      </div>
    </>
  );
}
