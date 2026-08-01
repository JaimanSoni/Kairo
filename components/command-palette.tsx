"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { navigateApp } from "./app-views";
import type { Task } from "@/lib/types";
import { friendlyDay } from "@/lib/dates";
import { hiddenListIds, useApp, visibleLists } from "./store";
import { Chip, Kbd, Modal } from "./ui";

type PaletteItem =
  | { kind: "action"; id: string; label: string; hint?: string; run: () => void }
  | { kind: "task"; id: string; task: Task }
  | { kind: "list"; id: string; label: string; emoji: string };

/** 0 = no match; higher = better. */
function score(text: string, q: string): number {
  const t = text.toLowerCase();
  if (!t.includes(q)) return 0;
  if (t.startsWith(q)) return 3;
  if (t.includes(` ${q}`)) return 2;
  return 1;
}

/**
 * ⌘K — search everything, go anywhere, do the common things.
 * Client-side over the store, so results are instant as you type.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { state, setEditing, setOmnibar, lockApp } = useApp();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const query = q.trim().toLowerCase();
  const hidden = useMemo(() => hiddenListIds(state), [state]);

  const actions = useMemo<PaletteItem[]>(() => {
    const base: { id: string; label: string; hint?: string; run: () => void }[] = [
      { id: "capture", label: "Capture a task", hint: "N", run: () => setOmnibar(true) },
      { id: "go-today", label: "Go to Today", hint: "1", run: () => navigateApp("/today") },
      { id: "go-calendar", label: "Go to Calendar", hint: "2", run: () => navigateApp("/calendar") },
      { id: "go-lists", label: "Go to Lists", hint: "3", run: () => navigateApp("/lists") },
      { id: "go-log", label: "Go to Log", hint: "4", run: () => navigateApp("/log") },
      ...(state.user.appLockEnabled
        ? [{ id: "lock", label: "Lock Kairo now", run: lockApp }]
        : []),
    ];
    return base
      .filter((a) => !query || a.label.toLowerCase().includes(query))
      .map((a) => ({ kind: "action" as const, ...a }));
  }, [query, setOmnibar, lockApp, state.user.appLockEnabled]);

  const taskItems = useMemo<PaletteItem[]>(() => {
    const candidates = Object.values(state.tasks).filter(
      (t) => !t.id.startsWith("temp-") && !(t.listId && hidden.has(t.listId))
    );
    let picked: Task[];
    if (!query) {
      // empty query: the freshest live tasks as a jumping-off point
      picked = candidates
        .filter((t) => t.status !== "done")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5);
    } else {
      picked = candidates
        .map((t) => ({ t, s: Math.max(score(t.title, query), score(t.note, query) - 0.5) }))
        .filter((x) => x.s > 0)
        .sort(
          (a, b) =>
            b.s - a.s ||
            Number(a.t.status === "done") - Number(b.t.status === "done") ||
            b.t.createdAt.localeCompare(a.t.createdAt)
        )
        .slice(0, 8)
        .map((x) => x.t);
    }
    return picked.map((t) => ({ kind: "task" as const, id: t.id, task: t }));
  }, [state.tasks, hidden, query]);

  const listItems = useMemo<PaletteItem[]>(() => {
    if (!query) return [];
    return visibleLists(state)
      .filter((l) => score(l.name, query) > 0)
      .slice(0, 3)
      .map((l) => ({ kind: "list" as const, id: l.id, label: l.name, emoji: l.emoji }));
  }, [state, query]);

  const items = useMemo(
    () => [...taskItems, ...listItems, ...actions],
    [taskItems, listItems, actions]
  );

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const run = (item: PaletteItem) => {
    onClose();
    if (item.kind === "action") item.run();
    else if (item.kind === "task") setEditing(item.id);
    else navigateApp("/lists");
  };

  const groupLabel = (idx: number): string | null => {
    if (idx === 0 && taskItems.length > 0) return query ? "Tasks" : "Recent";
    if (idx === taskItems.length && listItems.length > 0) return "Lists";
    if (idx === taskItems.length + listItems.length && actions.length > 0) return "Actions";
    return null;
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-3">
        <div className="flex items-center gap-2.5 border-b border-line px-2 pb-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-ink-faint">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0); // selection restarts with every keystroke
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(items.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter" && items[sel]) {
                run(items[sel]);
              }
            }}
            placeholder="Search tasks, lists… or jump anywhere"
            className="w-full bg-transparent text-base outline-none placeholder:text-ink-faint"
            autoFocus
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} className="no-scrollbar max-h-[50vh] overflow-y-auto overscroll-contain pt-2">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-faint">
              Nothing matches “{q}”.
            </p>
          )}
          {items.map((item, idx) => {
            const label = groupLabel(idx);
            return (
              <div key={`${item.kind}:${item.id}`}>
                {label && (
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                    {label}
                  </div>
                )}
                <button
                  data-idx={idx}
                  onClick={() => run(item)}
                  onMouseEnter={() => setSel(idx)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left ${
                    sel === idx ? "bg-sun-soft" : ""
                  }`}
                >
                  {item.kind === "task" ? (
                    <>
                      <span
                        className={`size-2 shrink-0 rounded-full ${
                          item.task.status === "done"
                            ? "bg-moss"
                            : item.task.spotlight
                              ? "bg-sun"
                              : "bg-ink-faint"
                        }`}
                      />
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          item.task.status === "done" ? "text-ink-faint line-through" : ""
                        }`}
                      >
                        {item.task.title}
                      </span>
                      {item.task.plannedFor && item.task.status === "planned" && (
                        <Chip tone="sun">{friendlyDay(item.task.plannedFor, state.today)}</Chip>
                      )}
                      {item.task.status === "inbox" && <Chip>inbox</Chip>}
                      {item.task.status === "someday" && <Chip>someday</Chip>}
                    </>
                  ) : item.kind === "list" ? (
                    <>
                      <span className="shrink-0 text-sm" aria-hidden>📁</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                      <Chip>list</Chip>
                    </>
                  ) : (
                    <>
                      <span className="shrink-0 text-sun" aria-hidden>→</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                      {item.hint && <Kbd>{item.hint}</Kbd>}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 border-t border-line px-2 pt-2.5 text-[11px] text-ink-faint sm:flex">
          <span><Kbd>↑↓</Kbd> navigate</span>
          <span><Kbd>enter</Kbd> open</span>
          <span><Kbd>⌘K</Kbd> toggle</span>
        </div>
      </div>
    </Modal>
  );
}
