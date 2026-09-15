"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { navigateApp } from "./app-views";
import { notesStore } from "@/lib/notes-client";
import type { NoteMeta } from "@/lib/notes-shared";
import { journalApi } from "@/lib/journal-client";
import type { SearchHit } from "@/lib/journal";
import { gardenStore } from "@/lib/habits-client";
import type { HabitView } from "@/lib/habits-shared";
import { useNoteActions } from "./notes/actions";
import type { Task } from "@/lib/types";
import { friendlyDay } from "@/lib/dates";
import { longDate } from "@/lib/journal-shared";
import { hiddenListIds, useApp, visibleLists } from "./store";
import { Chip, IconJournal, IconSprout, Kbd, Modal } from "./ui";
import { ListMark } from "./img3d";
import { PageIcon } from "./notes/pickers";
import { openCaptureAs } from "./omnibar";
import { WeatherIcon } from "./day/weather";

type PaletteItem =
  | { kind: "action"; id: string; label: string; hint?: string; run: () => void }
  | { kind: "task"; id: string; task: Task }
  | { kind: "list"; id: string; label: string; emoji: string }
  | { kind: "note"; id: string; page: NoteMeta }
  | { kind: "journal"; id: string; hit: SearchHit }
  | { kind: "habit"; id: string; habit: HabitView };

const GROUPS: Record<PaletteItem["kind"], string> = {
  task: "Tasks",
  list: "Lists",
  note: "Notes",
  journal: "Journal",
  habit: "Habits",
  action: "Actions",
};

/** 0 = no match; higher = better. */
function score(text: string, q: string): number {
  const t = text.toLowerCase();
  if (!t.includes(q)) return 0;
  if (t.startsWith(q)) return 3;
  if (t.includes(` ${q}`)) return 2;
  return 1;
}

/**
 * ⌘K — search everything, go anywhere, do the common things. Tasks, lists,
 * notes and habits are searched on the device as you type; journal pages a
 * moment later, from the server, and never while the journal is locked.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { state, setEditing, setOmnibar, lockApp } = useApp();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const query = q.trim().toLowerCase();
  const hidden = useMemo(() => hiddenListIds(state), [state]);
  const noteActions = useNoteActions();
  const notesTick = useSyncExternalStore(notesStore.subscribe, notesStore.snapshot, () => 0);
  const gardenTick = useSyncExternalStore(gardenStore.subscribe, gardenStore.snapshot, () => 0);
  const guest = Boolean(state.user.guest);
  const userId = state.user.id;
  const [journalHits, setJournalHits] = useState<{ q: string; hits: SearchHit[] }>({ q: "", hits: [] });

  // pages and plants are searchable here too; each loads the first time anyone looks
  useEffect(() => {
    if (guest) return;
    void notesStore.ensureLoaded();
    gardenStore.forUser(userId);
    void gardenStore.ensureLoaded();
  }, [guest, userId]);

  // the journal is searched on the server, a moment after typing stops
  useEffect(() => {
    if (guest || query.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      journalApi.search(query).then((r) => {
        if (!cancelled && r.ok) setJournalHits({ q: query, hits: r.data.results.slice(0, 4) });
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, guest]);

  const actions = useMemo<PaletteItem[]>(() => {
    const base: { id: string; label: string; hint?: string; run: () => void }[] = [
      { id: "capture", label: "Capture a task", hint: "N", run: () => openCaptureAs("task", setOmnibar) },
      ...(guest
        ? []
        : [
            { id: "capture-note", label: "Capture a note", run: () => openCaptureAs("note", setOmnibar) },
            { id: "capture-journal", label: "Add a line to today's journal", run: () => openCaptureAs("journal", setOmnibar) },
          ]),
      { id: "go-today", label: "Go to Today", hint: "1", run: () => navigateApp("/today") },
      { id: "go-calendar", label: "Go to Calendar", hint: "2", run: () => navigateApp("/calendar") },
      { id: "go-lists", label: "Go to Lists", hint: "3", run: () => navigateApp("/lists") },
      { id: "go-log", label: "Go to Log", hint: "4", run: () => navigateApp("/log") },
      { id: "go-journal", label: "Go to Journal", hint: "5", run: () => navigateApp("/journal") },
      { id: "write-today", label: "Write today's journal page", run: () => navigateApp(`/journal/${state.today}`) },
      { id: "go-notes", label: "Go to Notes", hint: "6", run: () => navigateApp("/notes") },
      ...(guest ? [] : [{ id: "new-note", label: "New note", run: () => void noteActions.create() }]),
      { id: "go-garden", label: "Go to Garden", hint: "7", run: () => navigateApp("/garden") },
      ...(guest
        ? []
        : [
            { id: "plant-habit", label: "Plant a habit", run: () => navigateApp("/garden/seeds") },
            { id: "garden-community", label: "Habit leaderboards", run: () => navigateApp("/garden/community") },
          ]),
      ...(state.user.appLockEnabled ? [{ id: "lock", label: "Lock Kairo now", run: lockApp }] : []),
    ];
    return base
      .filter((a) => !query || a.label.toLowerCase().includes(query))
      .map((a) => ({ kind: "action" as const, ...a }));
  }, [query, setOmnibar, lockApp, state.user.appLockEnabled, state.today, guest, noteActions]);

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

  const noteItems = useMemo<PaletteItem[]>(() => {
    if (!query || notesTick < 0) return [];
    return notesStore
      .all()
      .map((page) => ({ page, s: score(page.title || "untitled", query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.page.updatedAt.localeCompare(a.page.updatedAt))
      .slice(0, 5)
      .map(({ page }) => ({ kind: "note" as const, id: page.id, page }));
  }, [query, notesTick]);

  const journalItems = useMemo<PaletteItem[]>(
    () => (query.length >= 2 && journalHits.q === query ? journalHits.hits.map((hit) => ({ kind: "journal" as const, id: hit.date, hit })) : []),
    [query, journalHits]
  );

  const habitItems = useMemo<PaletteItem[]>(() => {
    if (!query || gardenTick < 0 || gardenStore.status() !== "ready") return [];
    return gardenStore
      .habits()
      .map((habit) => ({ habit, s: score(habit.name, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map(({ habit }) => ({ kind: "habit" as const, id: habit.id, habit }));
  }, [query, gardenTick]);

  const items = useMemo(
    () => [...taskItems, ...listItems, ...noteItems, ...journalItems, ...habitItems, ...actions],
    [taskItems, listItems, noteItems, journalItems, habitItems, actions]
  );

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const run = (item: PaletteItem) => {
    onClose();
    if (item.kind === "action") item.run();
    else if (item.kind === "task") setEditing(item.id);
    else if (item.kind === "note") navigateApp(`/notes/${item.id}`);
    else if (item.kind === "journal") navigateApp(`/journal/${item.id}`);
    else if (item.kind === "habit") navigateApp(`/garden/${item.id}`);
    else {
      // the list itself, not just the page: Lists scrolls to it and opens it
      navigateApp(`/lists#list-${item.id}`);
      window.dispatchEvent(new CustomEvent("kairo:show-list", { detail: item.id }));
    }
  };

  const groupLabel = (idx: number): string | null => {
    const item = items[idx];
    if (!item) return null;
    if (idx > 0 && items[idx - 1].kind === item.kind) return null;
    if (item.kind === "task") return query ? "Tasks" : "Recent";
    return GROUPS[item.kind];
  };

  return (
    <Modal onClose={onClose} anchor="top">
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
            placeholder={guest ? "Search tasks and lists… or jump anywhere" : "Search tasks, notes, your journal, habits… or jump anywhere"}
            aria-label="Search Kairo"
            className="w-full bg-transparent text-base outline-none placeholder:text-ink-faint"
            autoFocus
          />
          <Kbd>esc</Kbd>
        </div>

        {/* short enough that the list never reaches under a raised keyboard */}
        <div ref={listRef} className="no-scrollbar max-h-[44dvh] overflow-y-auto overscroll-contain pt-2 sm:max-h-[50vh]">
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
                  data-kind={item.kind}
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
                  ) : item.kind === "note" ? (
                    <>
                      <span className="grid shrink-0 place-items-center" aria-hidden>
                        <PageIcon icon={item.page.icon} size={16} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.page.title || "Untitled"}</span>
                      <Chip>note</Chip>
                    </>
                  ) : item.kind === "journal" ? (
                    <>
                      <span className="grid w-4 shrink-0 place-items-center text-ink-faint" aria-hidden>
                        {item.hit.mood ? <WeatherIcon mood={item.hit.mood} size={15} /> : <IconJournal size={14} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{item.hit.title || longDate(item.hit.date)}</span>
                        <span className="block truncate text-xs text-ink-faint">{item.hit.snippet}</span>
                      </span>
                      <Chip>{friendlyDay(item.hit.date, state.today)}</Chip>
                    </>
                  ) : item.kind === "habit" ? (
                    <>
                      <span className="grid w-4 shrink-0 place-items-center text-moss" aria-hidden>
                        <IconSprout size={15} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.habit.name}</span>
                      <Chip>habit</Chip>
                    </>
                  ) : item.kind === "list" ? (
                    <>
                      <span className="grid shrink-0 place-items-center" aria-hidden>
                        <ListMark value={item.emoji} size={16} />
                      </span>
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
