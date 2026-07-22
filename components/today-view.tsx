"use client";

import { useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { fullDate, fmtMinutes } from "@/lib/dates";
import { parseQuickAdd } from "@/lib/nlp";
import Link from "next/link";
import { byOrder, hiddenListIds, useApp, visibleLists } from "./store";
import { Icon3d } from "./img3d";
import { FreshStart } from "./fresh-start";
import { TaskItem } from "./task-item";
import { EmptyState, IconPlus, IconStar } from "./ui";

const DAY_CAPACITY_MIN = 6 * 60; // soft cap — a suggestion, never a wall

export function TodayView() {
  const { state, updateTask, reopenSweep } = useApp();
  const today = state.today;
  const hidden = useMemo(() => hiddenListIds(state), [state]);
  const all = useMemo(
    () => Object.values(state.tasks).filter((t) => !(t.listId && hidden.has(t.listId))),
    [state.tasks, hidden]
  );

  const lockedTodayCount = useMemo(
    () =>
      Object.values(state.tasks).filter(
        (t) =>
          t.listId &&
          hidden.has(t.listId) &&
          t.status === "planned" &&
          t.plannedFor &&
          t.plannedFor <= today
      ).length,
    [state.tasks, hidden, today]
  );

  const carryover = useMemo(
    () =>
      all
        .filter((t) => t.status === "planned" && t.plannedFor && t.plannedFor < today)
        .sort(byOrder),
    [all, today]
  );

  const todayTasks = useMemo(
    () => all.filter((t) => t.plannedFor === today && t.status === "planned").sort(byOrder),
    [all, today]
  );
  const spotlightTasks = todayTasks.filter((t) => t.spotlight);
  const restTasks = todayTasks.filter((t) => !t.spotlight);

  const doneToday = useMemo(
    () =>
      all
        .filter((t) => t.status === "done" && t.completedAt && t.completedAt.slice(0, 10) === today)
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [all, today]
  );

  const inboxPreview = useMemo(
    () => all.filter((t) => t.status === "inbox").sort(byOrder).slice(0, 5),
    [all]
  );

  const totalEstimate = todayTasks.reduce((sum, t) => sum + (t.estimateMin ?? 0), 0);
  const overCapacity = totalEstimate > DAY_CAPACITY_MIN;

  const dayWon = todayTasks.length === 0 && doneToday.length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-8 sm:px-6">
      {carryover.length > 0 && !state.sweepDismissed && <FreshStart carryover={carryover} />}

      {/* header */}
      <header className="anim-rise mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-4xl">Today</h1>
          <span className="text-sm text-ink-soft">{fullDate(today)}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
          {totalEstimate > 0 && (
            <span className={overCapacity ? "font-medium text-sun-deep" : ""}>
              holds ~{fmtMinutes(totalEstimate)}
              {overCapacity ? " — that's a lot. Trim one?" : " · fits ✓"}
            </span>
          )}
          {carryover.length > 0 && state.sweepDismissed && (
            <button
              onClick={reopenSweep}
              className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 font-medium hover:border-sun hover:text-sun-deep"
            >
              <Icon3d name="sunrise" size={15} /> {carryover.length} from before
            </button>
          )}
          {lockedTodayCount > 0 && (
            <Link
              href="/lists"
              className="rounded-full border border-line bg-card px-3 py-1 font-medium text-ink-faint hover:border-ink-faint hover:text-ink"
              title="Tasks in locked lists — unlock them in Lists"
            >
              🔒 {lockedTodayCount} hidden
            </Link>
          )}
        </div>
      </header>

      {/* spotlight */}
      {(spotlightTasks.length > 0 || restTasks.length > 0) && (
        <section className="mb-6">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sun-deep">
            <IconStar size={12} filled /> Spotlight
            <span className="font-normal normal-case text-ink-faint">— win these 3, the day is won</span>
          </div>
          {spotlightTasks.length > 0 ? (
            <div className="space-y-2">
              {spotlightTasks.map((t) => (
                <TaskItem key={t.id} task={t} context="today" />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-ink-faint">
              Star up to 3 must-wins <IconStar size={12} className="inline text-sun" /> — everything
              else is bonus.
            </div>
          )}
        </section>
      )}

      {/* main list */}
      {restTasks.length > 0 && (
        <DraggableList tasks={restTasks} context="today" />
      )}

      {/* add row */}
      <AddRow
        placeholder={todayTasks.length ? "Add to today…" : "What would make today good?"}
        plannedFor={today}
      />

      {/* empty / celebration states */}
      {todayTasks.length === 0 && !dayWon && (
        <div className="mt-6">
          {inboxPreview.length > 0 ? (
            <section className="anim-rise rounded-2xl border border-line bg-paper-deep/50 p-5">
              <h3 className="text-sm font-semibold">Plan today from your inbox</h3>
              <p className="mb-3 mt-0.5 text-xs text-ink-soft">
                Pull in only what fits. The rest will wait — happily.
              </p>
              <div className="space-y-2">
                {inboxPreview.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <TaskItem task={t} context="backlog" />
                    </div>
                    <button
                      onClick={() => updateTask(t.id, { plannedFor: today, status: "planned" })}
                      className="shrink-0 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold hover:border-sun hover:text-sun-deep"
                    >
                      + Today
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            doneToday.length === 0 && (
              <EmptyState
                icon="sunrise"
                title="A blank day. How rare."
                body="Capture what's on your mind (press N), or enjoy the silence — that's productivity too."
              />
            )
          )}
        </div>
      )}

      {dayWon && (
        <div className="anim-pop mt-6 rounded-2xl border-2 border-moss/40 bg-moss-soft p-6 text-center">
          <div className="text-4xl">🎉</div>
          <div className="font-display mt-1 text-3xl">Day won.</div>
          <p className="mt-1 text-sm text-ink-soft">
            {doneToday.length} {doneToday.length === 1 ? "thing" : "things"} finished. Close the
            laptop — tomorrow is planned tomorrow.
          </p>
        </div>
      )}

      {/* done today */}
      {doneToday.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Done today · {doneToday.length}
          </div>
          <div className="space-y-2 opacity-80">
            {doneToday.map((t) => (
              <TaskItem key={t.id} task={t} context="today" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- drag-to-reorder list ---------- */

export function DraggableList({ tasks, context }: { tasks: Task[]; context: "today" | "upcoming" | "backlog" }) {
  const { reorderTasks } = useApp();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const drop = (index: number) => {
    if (dragId === null) return;
    const ids = tasks.map((t) => t.id);
    const from = ids.indexOf(dragId);
    if (from === -1) return;
    ids.splice(from, 1);
    ids.splice(index > from ? index - 1 : index, 0, dragId);
    reorderTasks(ids);
    setDragId(null);
    setOverIndex(null);
  };

  return (
    <div className="space-y-2" onDragLeave={() => setOverIndex(null)}>
      {tasks.map((t, i) => (
        <TaskItem
          key={t.id}
          task={t}
          context={context}
          draggable
          onDragStart={(e) => {
            setDragId(t.id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/task-id", t.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const before = e.clientY < rect.top + rect.height / 2;
            setOverIndex(before ? i : i + 1);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const before = e.clientY < rect.top + rect.height / 2;
            drop(before ? i : i + 1);
          }}
          dropIndicator={
            dragId && overIndex !== null
              ? overIndex === i
                ? "above"
                : overIndex === i + 1 && i === tasks.length - 1
                  ? "below"
                  : null
              : null
          }
        />
      ))}
    </div>
  );
}

/* ---------- inline add ---------- */

export function AddRow({
  placeholder,
  plannedFor,
  listId,
  status,
}: {
  placeholder: string;
  plannedFor?: string | null;
  listId?: string | null;
  status?: Task["status"];
}) {
  const { state, addTask } = useApp();
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    const parsed = parseQuickAdd(text, visibleLists(state));
    if (plannedFor !== undefined && !parsed.plannedFor) parsed.plannedFor = plannedFor;
    if (listId !== undefined && !parsed.listId) parsed.listId = listId ?? null;
    addTask(parsed, status ? { status } : undefined);
    setText("");
  };

  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-ink-faint/70 bg-card/50 px-3.5 py-2.5 transition-colors focus-within:border-sun">
      <IconPlus size={16} className="shrink-0 text-ink-faint" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={placeholder}
        className="w-full bg-transparent text-base outline-none placeholder:text-ink-faint sm:text-[15px]"
      />
    </div>
  );
}
