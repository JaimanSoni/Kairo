"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { List, Task } from "@/lib/types";
import { addDays, friendlyDay, fmtMinutes, fullDate, toDateStr } from "@/lib/dates";
import { byOrder, hiddenListIds, useApp } from "./store";
import { StepRow } from "./step-row";
import { TaskItem } from "./task-item";
import { AddRow } from "./today-view";
import { Modal } from "./ui";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_CAPACITY_MIN = 6 * 60;

/* stable per-list colors, tuned to read on light and dark surfaces */
const LIST_COLORS = [
  "#0c9384", // teal
  "#4e93c9", // sky
  "#8d7bd4", // lilac
  "#d96354", // rose
  "#d8a03e", // amber
  "#4ca75b", // grass
  "#c960a5", // pink
  "#5a6acf", // indigo
  "#2fa5b8", // cyan
  "#a97b50", // clay-brown
];

/** Past this much horizontal travel, a release changes month. */
const SWIPE_COMMIT_PX = 70;
/** A flick counts even when short — px per ms. */
const SWIPE_FLICK = 0.4;
const SLIDE_OUT_MS = 170;
const SLIDE_IN_MS = 210;

/**
 * Month-swiping for touch screens.
 *
 * `frame` clips, `track` moves. The axis is locked on the first meaningful
 * movement so a vertical scroll is never stolen, and once we own the gesture
 * we preventDefault to stop the page scrolling underneath. A committed swipe
 * carries the old month out, swaps, then brings the new one in from the other
 * side, so the direction of travel matches the direction of time.
 */
function useMonthSwipe(
  frame: React.RefObject<HTMLDivElement | null>,
  track: React.RefObject<HTMLDivElement | null>,
  onSwipe: (delta: number) => void
) {
  // the gesture listeners are bound once; this keeps them calling the newest
  // callback without re-binding mid-swipe (assigned in an effect, not render)
  const swipeRef = useRef(onSwipe);
  useEffect(() => {
    swipeRef.current = onSwipe;
  });

  useEffect(() => {
    const frameEl = frame.current;
    const trackEl = track.current;
    if (!frameEl || !trackEl) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let startX = 0, startY = 0, dx = 0, lastX = 0, lastT = 0, velocity = 0;
    let axis: "" | "x" | "y" = "";
    let active = false, raf = 0, settling = false;
    let swipedAt = 0;

    const paint = (x: number, ms: number) => {
      trackEl.style.transition = ms && !reduced ? `transform ${ms}ms cubic-bezier(0.22,0.61,0.36,1)` : "none";
      trackEl.style.transform = `translate3d(${x}px,0,0)`;
    };

    const onStart = (e: TouchEvent) => {
      if (settling || e.touches.length !== 1) return;
      active = true;
      axis = "";
      dx = 0;
      velocity = 0;
      startX = lastX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastT = e.timeStamp;
      paint(0, 0);
    };

    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const x = e.touches[0].clientX - startX;
      const y = e.touches[0].clientY - startY;

      if (!axis) {
        if (Math.abs(x) < 10 && Math.abs(y) < 10) return;
        // bias toward vertical: scrolling the page must stay easy
        axis = Math.abs(x) > Math.abs(y) * 1.3 ? "x" : "y";
        if (axis === "y") {
          active = false;
          return;
        }
      }

      if (e.cancelable) e.preventDefault();
      const dt = e.timeStamp - lastT || 1;
      velocity = velocity * 0.6 + ((e.touches[0].clientX - lastX) / dt) * 0.4;
      lastX = e.touches[0].clientX;
      lastT = e.timeStamp;
      dx = x;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          paint(dx, 0);
        });
      }
    };

    const onEnd = () => {
      if (!active) return;
      active = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (axis !== "x") return;

      swipedAt = performance.now(); // swallow the click this gesture would fire
      const width = frameEl.offsetWidth || 1;
      const commit = Math.abs(dx) > SWIPE_COMMIT_PX || Math.abs(velocity) > SWIPE_FLICK;
      if (!commit) {
        paint(0, 200);
        return;
      }

      const delta = dx < 0 ? 1 : -1; // drag left reveals the next month
      settling = true;
      paint(delta === 1 ? -width : width, SLIDE_OUT_MS);
      window.setTimeout(
        () => {
          swipeRef.current(delta);
          paint(delta === 1 ? width : -width, 0);
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              paint(0, SLIDE_IN_MS);
              settling = false;
            })
          );
        },
        reduced ? 0 : SLIDE_OUT_MS
      );
    };

    // a swipe that starts on a day cell must not also select that day
    const onClick = (e: MouseEvent) => {
      if (performance.now() - swipedAt < 350) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    frameEl.addEventListener("touchstart", onStart, { passive: true });
    frameEl.addEventListener("touchmove", onMove, { passive: false });
    frameEl.addEventListener("touchend", onEnd);
    frameEl.addEventListener("touchcancel", onEnd);
    frameEl.addEventListener("click", onClick, true);
    return () => {
      frameEl.removeEventListener("touchstart", onStart);
      frameEl.removeEventListener("touchmove", onMove);
      frameEl.removeEventListener("touchend", onEnd);
      frameEl.removeEventListener("touchcancel", onEnd);
      frameEl.removeEventListener("click", onClick, true);
    };
  }, [frame, track]);
}

function colorForList(listId: string | null, lists: List[]): string | null {
  if (!listId) return null;
  const idx = lists.findIndex((l) => l.id === listId);
  return idx === -1 ? null : LIST_COLORS[idx % LIST_COLORS.length];
}

/**
 * Month calendar for Upcoming: grid for overview, a day panel for detail.
 * Desktop shows task chips per cell and a side panel; mobile shows dots and
 * opens the day as a draggable sheet — the Google Calendar month-view model,
 * plus Kairo's capacity honesty per day.
 */
export function CalendarView() {
  const { state, updateTask } = useApp();
  const today = state.today;
  const hidden = useMemo(() => hiddenListIds(state), [state]);
  const all = useMemo(
    () => Object.values(state.tasks).filter((t) => !(t.listId && hidden.has(t.listId))),
    [state.tasks, hidden]
  );

  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selected, setSelected] = useState<string>(today);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  /* grid geometry — Monday-first, whole weeks, no trailing empty week */
  const [gy, gm] = month.split("-").map(Number);
  const firstOfMonth = new Date(gy, gm - 1, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(gy, gm, 0).getDate();
  const cellCount = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const gridStart = addDays(toDateStr(firstOfMonth), -startOffset);
  const days = Array.from({ length: cellCount }, (_, i) => addDays(gridStart, i));

  /* per-day data for the visible range */
  const { plannedByDay, doneByDay, stepsByDay } = useMemo(() => {
    const planned = new Map<string, Task[]>();
    const done = new Map<string, Task[]>();
    const steps = new Map<string, number>();
    for (const t of all) {
      if (t.status === "planned" && t.plannedFor) {
        if (!planned.has(t.plannedFor)) planned.set(t.plannedFor, []);
        planned.get(t.plannedFor)!.push(t);
      }
      if (t.status === "done" && t.completedAt) {
        const day = t.completedAt.slice(0, 10);
        if (!done.has(day)) done.set(day, []);
        done.get(day)!.push(t);
      }
      if (t.status !== "done") {
        for (const s of t.subtasks) {
          if (s.plannedFor && !s.done && t.plannedFor !== s.plannedFor) {
            steps.set(s.plannedFor, (steps.get(s.plannedFor) ?? 0) + 1);
          }
        }
      }
    }
    for (const list of planned.values()) list.sort(byOrder);
    return { plannedByDay: planned, doneByDay: done, stepsByDay: steps };
  }, [all]);

  const moveMonth = (delta: number) => {
    const d = new Date(gy, gm - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const frameRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  useMonthSwipe(frameRef, trackRef, moveMonth);
  const goToday = () => {
    setMonth(today.slice(0, 7));
    setSelected(today);
  };

  const pick = (day: string) => {
    setSelected(day);
    if (window.innerWidth < 1024) setSheetOpen(true);
  };

  const dropOn = (day: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task-id");
    if (id) updateTask(id, { plannedFor: day, status: "planned" });
    setDragOver(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        {/* month header */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl">
            {MONTHS[gm - 1]} <span className="text-ink-faint">{gy}</span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={goToday}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-sun hover:text-sun-deep"
            >
              Today
            </button>
            <button
              onClick={() => moveMonth(-1)}
              aria-label="Previous month"
              className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-paper-deep"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={() => moveMonth(1)}
              aria-label="Next month"
              className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-paper-deep"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* weekday header */}
        <div className="grid grid-cols-7 border-b border-line pb-1">
          {DOW.map((d) => (
            <span key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              <span className="sm:hidden">{d.charAt(0)}</span>
              <span className="hidden sm:inline">{d}</span>
            </span>
          ))}
        </div>

        {/* grid — the frame clips, the track slides under a swipe */}
        <div
          ref={frameRef}
          className="overflow-hidden rounded-b-2xl border-x border-b border-line bg-card"
          style={{ touchAction: "pan-y" }}
        >
          <div ref={trackRef} className="grid grid-cols-7 will-change-transform">
          {days.map((day, i) => {
            const inMonth = day.slice(0, 7) === month;
            const isToday = day === today;
            const isSelected = day === selected;
            const past = day < today;
            const weekend = [5, 6].includes(i % 7);
            const tasks = plannedByDay.get(day) ?? [];
            const doneTasks = doneByDay.get(day) ?? [];
            const stepCount = stepsByDay.get(day) ?? 0;
            const load = tasks.reduce((s, t) => s + (t.estimateMin ?? 0), 0);
            const visible = [...tasks, ...doneTasks];
            const overflow = Math.max(0, visible.length - 3);

            return (
              <div
                key={day}
                role="button"
                tabIndex={0}
                onClick={() => pick(day)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && pick(day)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(day);
                }}
                onDragLeave={() => setDragOver((d) => (d === day ? null : d))}
                onDrop={dropOn(day)}
                className={`min-h-14 cursor-pointer border-t border-line p-1 transition-colors sm:min-h-24 sm:p-1.5 ${
                  i % 7 !== 0 ? "border-l" : ""
                } ${
                  dragOver === day
                    ? "bg-sun-soft/60"
                    : isSelected
                      ? "bg-sun-soft/35"
                      : weekend
                        ? "bg-paper-deep/25"
                        : ""
                } ${!inMonth ? "opacity-40" : past ? "opacity-70" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`grid size-6 place-items-center rounded-full text-xs tabular-nums ${
                      isToday
                        ? "bg-sun font-bold text-on-accent"
                        : isSelected
                          ? "font-bold text-sun-deep"
                          : "text-ink-soft"
                    }`}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {load > 0 && (
                    <span
                      className={`hidden text-[9px] tabular-nums sm:inline ${
                        load > DAY_CAPACITY_MIN ? "font-semibold text-sun-deep" : "text-ink-faint"
                      }`}
                      title={load > DAY_CAPACITY_MIN ? "Holds more than 6h — heavy day" : undefined}
                    >
                      {fmtMinutes(load)}
                    </span>
                  )}
                </div>

                {/* desktop: text chips */}
                <div className="mt-0.5 hidden space-y-0.5 sm:block">
                  {visible.slice(0, 3).map((t) => {
                    const color = colorForList(t.listId, state.lists);
                    return (
                      <div
                        key={t.clientId ?? t.id}
                        draggable={t.status !== "done"}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/task-id", t.id);
                        }}
                        className={`flex items-center gap-1 truncate rounded px-1 py-px text-[10px] leading-tight ${
                          t.status === "done"
                            ? "bg-moss-soft text-moss line-through"
                            : t.spotlight
                              ? "bg-sun-soft font-medium text-sun-deep"
                              : "bg-paper-deep text-ink-soft"
                        }`}
                        title={t.title}
                      >
                        {color && (
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        )}
                        <span className="truncate">
                          {t.spotlight && t.status !== "done" ? "✦ " : ""}
                          {t.title}
                        </span>
                      </div>
                    );
                  })}
                  {(overflow > 0 || stepCount > 0) && (
                    <div className="px-1 text-[9px] text-ink-faint">
                      {overflow > 0 ? `+${overflow} more` : ""}
                      {overflow > 0 && stepCount > 0 ? " · " : ""}
                      {stepCount > 0 ? `↳ ${stepCount}` : ""}
                    </div>
                  )}
                </div>

                {/* mobile: dots, colored by list */}
                <div className="mt-1 flex flex-wrap justify-center gap-0.5 sm:hidden">
                  {visible.slice(0, 4).map((t) => {
                    const color = colorForList(t.listId, state.lists);
                    return (
                      <span
                        key={t.clientId ?? t.id}
                        className={`size-1.5 rounded-full ${
                          t.status === "done" ? "bg-moss" : color ? "" : "bg-ink-faint"
                        }`}
                        style={
                          t.status !== "done" && color ? { backgroundColor: color } : undefined
                        }
                      />
                    );
                  })}
                  {visible.length > 4 && <span className="text-[8px] leading-none text-ink-faint">+</span>}
                </div>
              </div>
            );
          })}
          </div>
        </div>
        {/* legend — which color is which list */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {state.lists
            .filter((l) => !hidden.has(l.id))
            .map((l) => (
              <span key={l.id} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colorForList(l.id, state.lists) ?? undefined }}
                />
                {l.name}
              </span>
            ))}
          <span className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            <span className="size-2 shrink-0 rounded-full bg-ink-faint" /> no list
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            <span className="size-2 shrink-0 rounded-full bg-moss" /> done
          </span>
          <span className="hidden items-center gap-1.5 text-[11px] text-ink-soft sm:flex">
            <span className="text-sun" aria-hidden>✦</span> must-win
          </span>
        </div>
        <p className="mt-2 hidden text-[11px] text-ink-faint sm:block">
          Drag a task onto a day to reschedule it. Click a day for details.
        </p>
      </div>

      {/* day detail — side panel on desktop */}
      <aside className="hidden min-w-0 lg:sticky lg:top-8 lg:block lg:self-start">
        <div className="rounded-2xl border border-line bg-paper-deep/50 p-4">
          <DayPanel day={selected} plannedByDay={plannedByDay} doneByDay={doneByDay} all={all} today={today} />
        </div>
      </aside>

      {/* day detail — sheet on mobile */}
      {sheetOpen && (
        <Modal onClose={() => setSheetOpen(false)}>
          <div className="p-5">
            <DayPanel day={selected} plannedByDay={plannedByDay} doneByDay={doneByDay} all={all} today={today} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function DayPanel({
  day,
  plannedByDay,
  doneByDay,
  all,
  today,
}: {
  day: string;
  plannedByDay: Map<string, Task[]>;
  doneByDay: Map<string, Task[]>;
  all: Task[];
  today: string;
}) {
  const tasks = plannedByDay.get(day) ?? [];
  const doneTasks = doneByDay.get(day) ?? [];
  const daySteps = all
    .filter((t) => t.status !== "done" && t.plannedFor !== day)
    .flatMap((t) =>
      t.subtasks.filter((s) => !s.done && s.plannedFor === day).map((s) => ({ task: t, step: s }))
    );
  const load = tasks.reduce((s, t) => s + (t.estimateMin ?? 0), 0);

  return (
    <>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">{friendlyDay(day, today)}</h3>
        <span className="text-xs text-ink-faint">{fullDate(day)}</span>
      </div>
      {load > 0 && (
        <p className={`mb-2 text-xs ${load > DAY_CAPACITY_MIN ? "font-medium text-sun-deep" : "text-ink-soft"}`}>
          holds ~{fmtMinutes(load)}
          {load > DAY_CAPACITY_MIN ? " — that's a lot" : " · fits ✓"}
        </p>
      )}

      {tasks.length === 0 && daySteps.length === 0 && doneTasks.length === 0 && (
        <p className="mb-2 rounded-xl border border-dashed border-line px-3 py-3 text-xs text-ink-faint">
          Nothing planned — a quiet day is a feature.
        </p>
      )}

      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskItem key={t.clientId ?? t.id} task={t} context="upcoming" />
        ))}
        {daySteps.map(({ task, step }) => (
          <StepRow key={`${task.id}:${step.id}`} task={task} step={step} />
        ))}
      </div>

      {doneTasks.length > 0 && (
        <div className="mt-3 space-y-2 opacity-80">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            Done · {doneTasks.length}
          </div>
          {doneTasks.map((t) => (
            <TaskItem key={t.clientId ?? t.id} task={t} context="upcoming" />
          ))}
        </div>
      )}

      {day >= today && <AddRow placeholder={`Add to ${friendlyDay(day, today)}…`} plannedFor={day} />}
    </>
  );
}
