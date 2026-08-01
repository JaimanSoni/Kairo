"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, friendlyDay, fmtMinutes } from "@/lib/dates";
import { byOrder, hiddenListIds, useApp } from "./store";
import { CalendarView } from "./calendar-view";
import { StepRow } from "./step-row";
import { TaskItem } from "./task-item";
import { AddRow } from "./today-view";
import { Icon3d } from "./img3d";
import { EmptyState, Modal } from "./ui";

type CalendarSectionMode = "week" | "month";

/**
 * The Calendar section. Month view by default for the bigger picture, with
 * the week as a calm spread of 7 day-rows you can drop tasks onto and the
 * inbox alongside for pulling work into days.
 */
export function CalendarSection() {
  const { state, updateTask } = useApp();
  const today = state.today;
  const hidden = useMemo(() => hiddenListIds(state), [state]);
  const all = useMemo(
    () =>
      Object.values(state.tasks).filter(
        (t) => !(t.listId && hidden.has(t.listId)),
      ),
    [state.tasks, hidden],
  );
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [view, setView] = useState<CalendarSectionMode>("month");
  const [syncSoon, setSyncSoon] = useState(false);

  /* remembered preference — read after mount so SSR and hydration agree */
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem("kairo-calendar-view");
        if (saved === "week") setView("week");
      } catch {}
    });
  }, []);

  const pickView = (v: CalendarSectionMode) => {
    setView(v);
    try {
      localStorage.setItem("kairo-calendar-view", v);
    } catch {}
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const byDay = (day: string) =>
    all
      .filter((t) => t.plannedFor === day && t.status === "planned")
      .sort(byOrder);

  /* steps planned onto a day whose parent isn't on that day itself */
  const stepsByDay = (day: string) =>
    all
      .filter((t) => t.status !== "done" && t.plannedFor !== day)
      .flatMap((t) =>
        t.subtasks
          .filter((s) => !s.done && s.plannedFor === day)
          .map((s) => ({ task: t, step: s })),
      );

  const inbox = all.filter((t) => t.status === "inbox").sort(byOrder);

  const later = all
    .filter(
      (t) => t.status === "planned" && t.plannedFor && t.plannedFor > days[6],
    )
    .sort((a, b) => (a.plannedFor ?? "").localeCompare(b.plannedFor ?? ""));

  const dropOn = (day: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task-id");
    if (id) updateTask(id, { plannedFor: day, status: "planned" });
    setDragOverDay(null);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-8 sm:px-6">
      <header className="anim-rise mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Calendar</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSyncSoon(true)}
            className="flex h-9 items-center gap-2 rounded-full border border-line bg-card px-3.5 text-xs font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C40.9 35.5 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z" />
            </svg>
            Sync from Google Calendar
          </button>
          <div className="flex rounded-full border border-line bg-paper-deep p-0.5">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => pickView(v)}
                aria-pressed={view === v}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  view === v ? "bg-card text-ink shadow-sm" : "text-ink-faint hover:text-ink-soft"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      {syncSoon && (
        <Modal onClose={() => setSyncSoon(false)}>
          <div className="p-6 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-paper-deep">
              <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C40.9 35.5 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z" />
              </svg>
            </div>
            <h2 className="font-display mt-4 text-2xl">Coming soon</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-ink-soft">
              Google Calendar sync is on the way. Your events will appear right beside your tasks.
            </p>
            <button
              onClick={() => setSyncSoon(false)}
              className="mt-5 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper"
            >
              Ok
            </button>
          </div>
        </Modal>
      )}

      {view === "month" && <CalendarView />}

      <div className={view === "month" ? "hidden" : "grid gap-8 lg:grid-cols-[1fr_320px]"}>
        {/* the week */}
        <div className="min-w-0 space-y-5">
          {days.map((day) => {
            const tasks = byDay(day);
            const daySteps = stepsByDay(day);
            const load = tasks.reduce((s, t) => s + (t.estimateMin ?? 0), 0);
            return (
              <section
                key={day}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverDay(day);
                }}
                onDragLeave={() =>
                  setDragOverDay((d) => (d === day ? null : d))
                }
                onDrop={dropOn(day)}
                className={`rounded-2xl border p-4 transition-colors ${
                  dragOverDay === day
                    ? "border-sun bg-sun-soft/40"
                    : day === today
                      ? "border-sun/40 bg-card"
                      : "border-line bg-card/60"
                }`}
              >
                <div className="mb-2.5 flex items-baseline justify-between">
                  <h2
                    className={`text-sm font-bold ${day === today ? "text-sun-deep" : ""}`}
                  >
                    {friendlyDay(day, today)}
                  </h2>
                  {load > 0 && (
                    <span className="text-xs text-ink-faint">
                      ~{fmtMinutes(load)}
                    </span>
                  )}
                </div>
                {tasks.length > 0 || daySteps.length > 0 ? (
                  <div className="space-y-2">
                    {tasks.map((t) => (
                      <TaskItem
                        key={t.clientId ?? t.id}
                        task={t}
                        context="calendar"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/task-id", t.id);
                        }}
                      />
                    ))}
                    {daySteps.map(({ task, step }) => (
                      <StepRow
                        key={`${task.id}:${step.id}`}
                        task={task}
                        step={step}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-line/80 px-3 py-2 text-xs text-ink-faint">
                    nothing yet, drop something here
                  </div>
                )}
                <AddRow placeholder="Add…" plannedFor={day} />
              </section>
            );
          })}

          {later.length > 0 && (
            <section className="rounded-2xl border border-line bg-card/60 p-4">
              <h2 className="mb-2.5 text-sm font-bold text-ink-soft">
                Further out
              </h2>
              <div className="space-y-2">
                {later.map((t) => (
                  <TaskItem key={t.clientId ?? t.id} task={t} context="calendar" />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* inbox tray */}
        <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-line bg-paper-deep/60 p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-bold">
              <Icon3d name="inbox" size={18} /> Inbox · {inbox.length}
            </h2>
            <p className="mb-3 mt-0.5 text-xs text-ink-soft">
              Drag onto a day when you mean it.
            </p>
            {inbox.length > 0 ? (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {inbox.map((t) => (
                  <TaskItem
                    key={t.clientId ?? t.id}
                    task={t}
                    context="backlog"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/task-id", t.id);
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="bird"
                title="Inbox zero"
                body="It happens. Enjoy it."
              />
            )}
            <AddRow placeholder="Capture…" plannedFor={null} />
          </div>
        </aside>
      </div>
    </div>
  );
}
