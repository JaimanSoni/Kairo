"use client";

import { useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { fullDate, fmtMinutes, localDayOf, parseDateStr, weekdayName } from "@/lib/dates";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "20 Sep": the date in the corner of a phone. */
const shortDate = (date: string) => `${Number(date.slice(8))} ${MONTH_SHORT[parseDateStr(date).getMonth()]}`;
import { parseQuickAdd } from "@/lib/nlp";
import Link from "next/link";
import { byOrder, hiddenListIds, useApp, visibleLists } from "./store";
import { Icon3d } from "./img3d";
import { FreshStart } from "./fresh-start";
import { AgentWork } from "./agent-work";
import { StepRow } from "./step-row";
import { TaskItem } from "./task-item";
import { EmptyState, IconLock, IconPlus } from "./ui";
import { ShareWithBestie } from "./bestie-share";
import { CloseTheDay, useHour } from "./day/close-day";
import dynamic from "next/dynamic";

/** The garden's plants come with their own art; Today shouldn't wait for it. */
const TodayGardenStrip = dynamic(() => import("./garden/today-strip"), { ssr: false });

const DAY_CAPACITY_MIN = 6 * 60; // soft cap — a suggestion, never a wall

/** Morning, afternoon or evening, by the browser's clock; plain "Today" until it's known. */
function greetingFor(hour: number, name: string | undefined): string {
  if (hour < 0) return "Today";
  const part = hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name?.split(" ")[0];
  return first && first !== "Friend" ? `${part}, ${first}` : part;
}

export function TodayView() {
  const { state, updateTask, reopenSweep } = useApp();
  const today = state.today;
  const hour = useHour();
  const guest = Boolean(state.user.guest);
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
        // repeating tasks roll themselves forward (see the store); the sweep
        // is only for one-off plans that need an actual decision
        .filter((t) => t.status === "planned" && t.plannedFor && t.plannedFor < today && !t.repeat)
        .sort(byOrder),
    [all, today]
  );

  const todayTasks = useMemo(
    () => all.filter((t) => t.plannedFor === today && t.status === "planned").sort(byOrder),
    [all, today]
  );

  const doneToday = useMemo(
    () =>
      all
        .filter((t) => t.status === "done" && t.completedAt && localDayOf(t.completedAt) === today)
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [all, today]
  );

  const inboxPreview = useMemo(
    () => all.filter((t) => t.status === "inbox").sort(byOrder).slice(0, 5),
    [all]
  );

  /* steps scheduled for today (or overdue) whose parent isn't already on today's list */
  const plannedSteps = useMemo(
    () =>
      all
        .filter((t) => t.status !== "done" && !(t.plannedFor === today && t.status === "planned"))
        .flatMap((t) =>
          t.subtasks
            .filter((s) => !s.done && s.plannedFor && s.plannedFor <= today)
            .map((s) => ({ task: t, step: s }))
        )
        .sort((a, b) => (a.step.plannedFor ?? "").localeCompare(b.step.plannedFor ?? "")),
    [all, today]
  );

  const totalEstimate = todayTasks.reduce((sum, t) => sum + (t.estimateMin ?? 0), 0);
  const overCapacity = totalEstimate > DAY_CAPACITY_MIN;

  const dayWon = todayTasks.length === 0 && plannedSteps.length === 0 && doneToday.length > 0;

  /*
   * What may appear on a shared card.
   *
   * Stricter than the rest of Today: `doneToday` hides locked lists that are
   * still locked, but unlocking one to work on it is not consent to put it in
   * an image someone sends to a friend. Locked means locked here, unlock state
   * or not — and the count of what was withheld is surfaced so the omission is
   * never silent.
   */
  const shareable = useMemo(() => {
    const lockedIds = new Set(state.lists.filter((l) => l.locked).map((l) => l.id));
    const open = doneToday.filter((t) => !(t.listId && lockedIds.has(t.listId)));
    return {
      titles: open.map((t) => t.title),
      count: open.length,
      withheld: doneToday.length - open.length,
    };
  }, [doneToday, state.lists]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-4 sm:px-6 sm:pt-8">
      {/* header: on a phone the greeting sits high, with the date in the corner beside it */}
      <header className="anim-rise mb-5 sm:mb-6">
        <div className="flex items-start justify-between gap-3 sm:items-baseline">
          <h1 className="min-w-0 font-display text-[2rem] leading-tight sm:text-4xl" data-greeting>
            {greetingFor(hour, state.user.name)}
          </h1>
          <span className="mt-1.5 shrink-0 text-right text-xs leading-tight text-ink-soft sm:mt-0 sm:text-sm" data-today-date>
            <span className="block font-semibold text-ink sm:hidden">{weekdayName(today)}</span>
            <span className="sm:hidden">{shortDate(today)}</span>
            <span className="hidden sm:inline">{fullDate(today)}</span>
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
          {totalEstimate > 0 && (
            <span className={overCapacity ? "font-medium text-sun-deep" : ""}>
              holds ~{fmtMinutes(totalEstimate)}
              {overCapacity ? ", that's a lot. Trim one?" : " · fits ✓"}
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
              title="Tasks in locked lists. Unlock them in Lists"
            >
              <span className="flex items-center gap-1">
                <IconLock size={11} /> {lockedTodayCount} hidden
              </span>
            </Link>
          )}
        </div>
      </header>

      {/* yesterday's leftovers, settled at the top of the day rather than over it;
          never while locked, when their titles would read out past the lock */}
      {carryover.length > 0 && !state.sweepDismissed && !state.appLocked && <FreshStart carryover={carryover} />}

      {/* what is being done for you while you're elsewhere; nothing at all when nothing is */}
      <AgentWork />

      {!state.appLocked && state.user.spaces.garden && <TodayGardenStrip />}

      {/* One list, in the order you put it in. Starred tasks stay in place
          rather than being hoisted, so dragging a card somewhere actually
          keeps it there — the star is a marker on the card, not a sort. */}
      {todayTasks.length > 0 && <DraggableList tasks={todayTasks} context="today" />}

      {/* add row — today, or straight to the inbox to decide later */}
      <TodayCapture today={today} hasTasks={todayTasks.length > 0} />

      {/* steps planned onto today from bigger tasks */}
      {plannedSteps.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            ↳ Steps today · {plannedSteps.length}
          </div>
          <div className="space-y-1.5">
            {plannedSteps.map(({ task, step }) => (
              <StepRow key={`${task.id}:${step.id}`} task={task} step={step} />
            ))}
          </div>
        </section>
      )}

      {/* empty / celebration states */}
      {todayTasks.length === 0 && !dayWon && (
        <div className="mt-6">
          {inboxPreview.length > 0 ? (
            <section className="anim-rise rounded-2xl border border-line bg-paper-deep/50 p-5">
              <h3 className="text-sm font-semibold">Plan today from your inbox</h3>
              <p className="mb-3 mt-0.5 text-xs text-ink-soft">
                Pull in only what fits. The rest will wait, happily.
              </p>
              <div className="space-y-2">
                {inboxPreview.map((t) => (
                  <div key={t.clientId ?? t.id} className="flex items-center gap-2">
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
                body="Capture what's on your mind (press N), or enjoy the silence, that's productivity too."
              />
            )
          )}
        </div>
      )}

      {/* Quiet on purpose: no green card, no count. What's finished is listed
          right below, so the popper and two words are the whole celebration. */}
      {dayWon && (
        <div className="anim-rise mt-8 text-center">
          <Icon3d name="party" size={52} className="mx-auto" />
          <div className="font-display mt-2 text-3xl">Day won.</div>
          {/* without the evening card (a guest, or the journal put away) the share stays here */}
          {(guest || !state.user.spaces.journal) && shareable.count > 0 && (
            <ShareWithBestie
              done={shareable.titles}
              doneCount={shareable.count}
              dateLabel={fullDate(today)}
              name={state.user.name?.split(" ")[0] || "Someone"}
              picture={state.user.picture}
              hiddenCount={shareable.withheld}
            />
          )}
        </div>
      )}

      {/* the end of the day: how it felt, what got done, and the page to write it on */}
      {!guest && !state.appLocked && state.user.spaces.journal && (
        <CloseTheDay
          today={today}
          doneCount={doneToday.length}
          dayWon={dayWon}
          share={
            shareable.count > 0 ? (
              <ShareWithBestie
                variant="pill"
                done={shareable.titles}
                doneCount={shareable.count}
                dateLabel={fullDate(today)}
                name={state.user.name?.split(" ")[0] || "Someone"}
                picture={state.user.picture}
                hiddenCount={shareable.withheld}
              />
            ) : undefined
          }
        />
      )}

      {/* done today */}
      {doneToday.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Done today · {doneToday.length}
          </div>
          <div className="space-y-2 opacity-80">
            {doneToday.map((t) => (
              <TaskItem key={t.clientId ?? t.id} task={t} context="today" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * One capture box, two destinations.
 *
 * Not everything you think of on a Tuesday morning belongs in Tuesday. The
 * switch lets a thought go to the inbox without leaving Today or committing
 * to a day — which is the whole point of having an inbox.
 */
function TodayCapture({ today, hasTasks }: { today: string; hasTasks: boolean }) {
  const [dest, setDest] = useState<"today" | "inbox">("today");
  const toInbox = dest === "inbox";

  return (
    <AddRow
      // remount on switch so the draft can't be submitted to the wrong place
      key={dest}
      placeholder={
        toInbox
          ? "Capture it, decide the day later…"
          : hasTasks
            ? "Add to today…"
            : "What would make today good?"
      }
      plannedFor={toInbox ? null : today}
      status={toInbox ? "inbox" : undefined}
      trailing={
        <span className="flex shrink-0 items-center rounded-full bg-paper-deep p-0.5 text-[11px] font-semibold">
          {(["today", "inbox"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDest(d)}
              aria-pressed={dest === d}
              data-tip={d === "today" ? "Add to today" : "Add to the inbox, undated"}
              className={`rounded-full px-2.5 py-1 capitalize transition-colors ${
                dest === d ? "bg-card text-ink shadow-sm" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              {d}
            </button>
          ))}
        </span>
      }
    />
  );
}

/* ---------- drag-to-reorder list ---------- */

export function DraggableList({ tasks, context }: { tasks: Task[]; context: "today" | "calendar" | "backlog" }) {
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
          key={t.clientId ?? t.id}
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
  day,
  listId,
  status,
  trailing,
}: {
  placeholder: string;
  /** Where the task goes when the words don't name a day. A day typed into the words wins. */
  plannedFor?: string | null;
  /**
   * This row is a day (a calendar column): the task lands on it whatever the
   * words say, and a day named in them stays part of the title.
   */
  day?: string;
  listId?: string | null;
  status?: Task["status"];
  /** Rendered inside the row, after the input — e.g. a destination switch. */
  trailing?: React.ReactNode;
}) {
  const { state, addTask } = useApp();
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    const parsed = parseQuickAdd(text, visibleLists(state), day ? { day } : undefined);
    if (!day && plannedFor !== undefined && !parsed.plannedFor) parsed.plannedFor = plannedFor;
    if (listId !== undefined && !parsed.listId) parsed.listId = listId ?? null;
    addTask(parsed, status ? { status } : undefined);
    setText("");
  };

  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-ink-faint/70 bg-card/50 py-2 pl-2.5 pr-3.5 transition-colors focus-within:border-sun">
      {/* onMouseDown preventDefault keeps the caret in the input, so clicking
          the plus submits and leaves you ready to type the next one */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={submit}
        aria-label="Add task"
        data-tip="Add task"
        className={`grid size-7 shrink-0 place-items-center rounded-lg transition-colors ${
          text.trim()
            ? "text-sun-deep hover:bg-sun-soft"
            : "text-ink-faint hover:bg-paper-deep hover:text-ink-soft"
        }`}
      >
        <IconPlus size={16} />
      </button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-ink-faint sm:text-[15px]"
      />
      {trailing}
    </div>
  );
}
