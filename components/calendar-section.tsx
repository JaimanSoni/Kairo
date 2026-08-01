"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, friendlyDay, fmtMinutes } from "@/lib/dates";
import { byOrder, hiddenListIds, useApp } from "./store";
import { CalendarView } from "./calendar-view";
import { StepRow } from "./step-row";
import { TaskItem } from "./task-item";
import { AddRow } from "./today-view";
import { Icon3d } from "./img3d";
import { EmptyState } from "./ui";

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
      </header>

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
