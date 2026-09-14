"use client";

import { useState } from "react";
import { COVERS } from "@/lib/notes-shared";
import { EMOJI_GROUPS, randomEmoji, searchEmoji } from "./emoji";

/**
 * The page icon and cover pickers. Both are popovers anchored where they were
 * opened, closed by a click anywhere else or Escape.
 */

function Popover({
  onClose,
  className = "",
  children,
  label,
}: {
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <>
      <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-[70] cursor-default" onClick={onClose} />
      <div
        role="dialog"
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
        className={`anim-pop absolute z-[71] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-2 shadow-2xl shadow-ink/10 ${className}`}
      >
        {children}
      </div>
    </>
  );
}

export function EmojiPicker({
  onPick,
  onRemove,
  onClose,
  className,
}: {
  onPick: (emoji: string) => void;
  onRemove?: () => void;
  onClose: () => void;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const results = searchEmoji(q);

  const cell = (emoji: string) => (
    <button
      key={emoji}
      type="button"
      onClick={() => onPick(emoji)}
      aria-label={`Use ${emoji}`}
      className="grid size-9 place-items-center rounded-lg text-[1.35rem] transition-transform hover:scale-110 hover:bg-paper-deep"
    >
      {emoji}
    </button>
  );

  return (
    <Popover onClose={onClose} className={className} label="Choose an icon">
      <div className="flex items-center gap-1.5 p-1">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search icons"
          aria-label="Search icons"
          className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-sun"
        />
        <button
          type="button"
          onClick={() => onPick(randomEmoji(Math.floor(Math.random() * 10_000)))}
          className="h-9 shrink-0 rounded-xl border border-line px-2.5 text-xs font-medium text-ink-soft hover:border-ink-faint"
          title="Surprise me"
        >
          🎲
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="h-9 shrink-0 rounded-xl border border-line px-2.5 text-xs font-medium text-ink-soft hover:border-clay hover:text-clay"
          >
            Remove
          </button>
        )}
      </div>
      <div className="no-scrollbar mt-1 h-72 overflow-y-auto overscroll-contain px-1 pb-1">
        {q ? (
          results.length ? (
            <div className="grid grid-cols-8 gap-0.5">{results.map(cell)}</div>
          ) : (
            <p className="px-2 py-6 text-center text-sm text-ink-faint">No icon matches “{q}”.</p>
          )
        ) : (
          EMOJI_GROUPS.map((g) => (
            <div key={g.name} className="mb-2">
              <div className="sticky top-0 z-[1] bg-card px-1 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">
                {g.name}
              </div>
              <div className="grid grid-cols-8 gap-0.5">{g.items.map(([e]) => cell(e))}</div>
            </div>
          ))
        )}
      </div>
    </Popover>
  );
}

export function CoverPicker({
  current,
  onPick,
  onRemove,
  onClose,
  className,
}: {
  current: string | null;
  onPick: (key: string) => void;
  onRemove?: () => void;
  onClose: () => void;
  className?: string;
}) {
  return (
    <Popover onClose={onClose} className={className} label="Choose a cover">
      <div className="flex items-center justify-between px-1.5 pb-2 pt-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">Covers</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs font-medium text-ink-soft hover:text-clay">
            Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 p-1">
        {COVERS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick(c.key)}
            aria-label={`${c.label} cover`}
            aria-pressed={current === c.key}
            className={`group relative h-16 overflow-hidden rounded-xl transition-transform hover:scale-[1.02] ${
              current === c.key ? "ring-2 ring-sun ring-offset-2 ring-offset-card" : ""
            }`}
            style={{ background: c.css }}
          >
            <span className="absolute bottom-1.5 left-2 rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              {c.label}
            </span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
