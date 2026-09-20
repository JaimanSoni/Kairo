"use client";

import { useEffect, useRef, useState } from "react";
import type { Subtask, Task } from "@/lib/types";
import { addDays, friendlyDay, fmtMinutes, fmtTime12, nextWeekday, parseDateStr, planEpoch, toDateStr, weekdayName } from "@/lib/dates";
import { firstOccurrence, type Repeat } from "@/lib/repeat";
import { parseQuickAdd } from "@/lib/nlp";
import { playComplete } from "@/lib/sound";
import { cancelPush, pushEnabled, schedulePush } from "@/lib/push-client";
import { askPermission } from "./permission-ask";
import { personById, useApp, visibleLists } from "./store";
import { Icon3d, ListMark } from "./img3d";
import { PersonAvatar } from "./person-avatar";
import { SendTaskModal, ShareTaskModal } from "./share-modal";
import { DatePicker } from "./date-picker";
import { DurationWheel } from "./wheel";
import { IconCheck, IconPlus, IconTrash, IconX, Modal } from "./ui";

/**
 * A task, opened.
 *
 * It used to be a form: seven rows named after fields (Planned day, Repeat,
 * Estimate, Deadline…), every one of them reading "None", and nothing to say
 * what any of them did until it was opened. This is the same task and the
 * same data, arranged around what someone actually came to do:
 *
 *   1. The task itself on top: tick it off, rename it, jot a note.
 *   2. One row answers the question almost every visit is about, when, in
 *      one tap, and a plain sentence says what the choice just did.
 *   3. Everything else is a small "add": a time, a reminder, repeat, how
 *      long, a deadline. Once set, it lights up and reads as its value.
 *   4. Lists are right there to tap, because filing a task is one decision,
 *      not a screen.
 *
 * An extra opens as one question at a time, in place of the card, with a line
 * saying what it means, and goes back by itself once it's answered. The card
 * stays this small on purpose: a task with no extras is a perfectly good task.
 */

type Member = { id: string; name: string; email: string; picture?: string };

type Panel = null | "date" | "time" | "remind" | "repeat" | "estimate" | "deadline" | "list" | "assignee";

const WEEK_MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const DAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];

const TIMES: [string, string, string][] = [
  ["09:00", "Morning", "9 AM"],
  ["12:00", "Noon", "12 PM"],
  ["15:00", "Afternoon", "3 PM"],
  ["18:00", "Evening", "6 PM"],
  ["21:00", "Night", "9 PM"],
];

/** A tiny tick under the thumb when something is chosen. */
function tap(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no motor, no problem */
  }
}

function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A repeat, the way someone would say it: "Every day", "Weekdays", "Every Mon, Wed", "Monthly on the 5th". */
function repeatWords(r: Repeat): string {
  if (r.type === "daily") return (r.interval ?? 1) === 1 ? "Every day" : `Every ${r.interval} days`;
  if (r.type === "monthly") return `Monthly on the ${ordinal(r.dayOfMonth ?? 1)}`;
  const days = [...(r.weekdays ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (days.length === 7) return "Every day";
  if (days.join() === "1,2,3,4,5") return "Weekdays";
  return `Every ${days.map((d) => DAY_SHORT[d]).join(", ")}`;
}

/** "Tomorrow 6 PM": a moment, said the way the rest of the card says times. */
function momentLabel(ms: number, today: string): string {
  const d = new Date(ms);
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${friendlyDay(toDateStr(d), today)} ${fmtTime12(hhmm)}`;
}

const ordinal = (n: number) => {
  const r10 = n % 10;
  const r100 = n % 100;
  if (r10 === 1 && r100 !== 11) return `${n}st`;
  if (r10 === 2 && r100 !== 12) return `${n}nd`;
  if (r10 === 3 && r100 !== 13) return `${n}rd`;
  return `${n}th`;
};

export function TaskEditor({ task }: { task: Task }) {
  const { state, updateTask, deleteTask, completeTask, uncompleteTask, setEditing, startFocus, showToast } = useApp();
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note);
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks);
  const [newSub, setNewSub] = useState("");
  const [stepMenu, setStepMenu] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  /** Which way the card last moved, for the slide; and which extra was just answered, for its little pop. */
  const [dir, setDir] = useState<"in" | "back">("in");
  const [flash, setFlash] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  /** "Start" on a task with no length yet asks how long first, then starts. */
  const [startAfter, setStartAfter] = useState(false);
  const [checking, setChecking] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const stepInput = useRef<HTMLInputElement>(null);

  const today = state.today;
  const done = task.status === "done";
  const someday = task.status === "someday";
  const list = task.listId ? state.lists.find((l) => l.id === task.listId) : null;
  const isShared = Boolean(list && (list.memberCount > 0 || list.role === "member"));
  const assignee = personById(state, task.assigneeId);

  /* pull the list's members when the assignee question opens */
  useEffect(() => {
    if (panel !== "assignee" || !task.listId) return;
    let cancelled = false;
    fetch(`/api/lists/${task.listId}/share`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.members) setMembers(d.members as Member[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [panel, task.listId]);

  const go = (p: Exclude<Panel, null>) => {
    setDir("in");
    setPanel(p);
  };
  const back = () => {
    setDir("back");
    setPanel(null);
    setStartAfter(false);
  };
  /** An answer: a tick under the thumb, back to the card, and the extra that changed pops. */
  const answered = (key: string) => {
    tap();
    setFlash(key);
    back();
  };

  /* Escape steps back out of a question before it closes the task. On the
     window, in capture, so it gets there before the sheet's own listener. */
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setDir("back");
      setPanel(null);
      setStartAfter(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [panel]);

  const close = () => {
    const patch: Partial<Task> = {};
    if (title.trim() && title.trim() !== task.title) patch.title = title.trim();
    if (note !== task.note) patch.note = note;
    if (JSON.stringify(subtasks) !== JSON.stringify(task.subtasks)) patch.subtasks = subtasks;
    if (Object.keys(patch).length) updateTask(task.id, patch);
    setEditing(null);
  };

  const complete = () => {
    if (done) {
      uncompleteTask(task.id);
      return;
    }
    setChecking(true);
    playComplete();
    tap(14);
    // let the tick land, then the task leaves for Done
    setTimeout(() => {
      close();
      completeTask(task.id);
    }, 380);
  };

  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    setSubtasks((s) => [...s, { id: crypto.randomUUID(), title: t, done: false }]);
    setNewSub("");
  };

  /* ---------------------------------------------------------------- when */

  const setDay = (date: string | null) => {
    tap();
    updateTask(task.id, {
      plannedFor: date,
      status: done ? "done" : date ? "planned" : "inbox",
      ...(date ? {} : { spotlight: false }),
    });
  };
  /** A time belongs to a day: on a task with none, it means today, the way typing "6pm" does. */
  const setTime = (hhmm: string | null) => {
    updateTask(task.id, {
      plannedTime: hhmm,
      ...(hhmm && (!task.plannedFor || someday) ? { plannedFor: today, status: done ? ("done" as const) : ("planned" as const) } : {}),
    });
  };
  const parkSomeday = () => {
    tap();
    updateTask(task.id, { plannedFor: null, status: "someday", spotlight: false });
  };

  const tomorrow = addDays(today, 1);
  let weekend = nextWeekday(6, today);
  if (weekend === tomorrow) weekend = addDays(weekend, 1); // on a Friday, tomorrow already is Saturday
  const nextWeek = nextWeekday(1, today);
  /** Planned for a day that isn't today or tomorrow: the third segment wears its date. */
  const otherDay = Boolean(task.plannedFor) && !someday && task.plannedFor !== today && task.plannedFor !== tomorrow;

  /** What the choice of day just did, in plain words. */
  const at = task.plannedTime ? ` at ${fmtTime12(task.plannedTime)}` : "";
  const consequence = someday
    ? "Parked. No date, no pressure. It waits under Lists."
    : !task.plannedFor
      ? "No day yet. It waits in your Inbox."
      : task.plannedFor === today
        ? `On today's plan${at}.`
        : task.plannedFor < today
          ? `From ${friendlyDay(task.plannedFor, today)}. It carries over until it's done.`
          : `Moves to ${task.plannedFor === tomorrow ? "tomorrow" : friendlyDay(task.plannedFor, today)}${at}.`;

  /* ------------------------------------------------------------ reminder */

  const setReminder = async (fireAt: number | null): Promise<boolean> => {
    if (fireAt === null) {
      cancelPush(`remind-${task.id}`);
      updateTask(task.id, { reminderAt: null });
      return true;
    }
    if (fireAt <= Date.now() + 30_000) {
      showToast({ message: "That time’s already gone. Pick one still ahead." });
      return false;
    }
    // the ask explains itself before the browser's own box appears, and says
    // how to undo a refusal — a reminder nothing can deliver is worse than none
    if (!(await pushEnabled()) && !(await askPermission("notifications"))) return false;
    updateTask(task.id, { reminderAt: fireAt });
    schedulePush({
      fireAt,
      title: task.title,
      body: "You asked to be nudged about this now.",
      tag: `remind-${task.id}`,
      url: "/today",
      taskId: task.id,
    });
    showToast({ message: `🔔 ${momentLabel(fireAt, today)}` });
    return true;
  };

  const plannedAt = task.plannedFor && task.plannedTime ? planEpoch(task.plannedFor, task.plannedTime) : null;

  /* -------------------------------------------------------------- repeat */

  const anchorDate = task.plannedFor ?? today;
  const applyRepeat = (r: Repeat | null) => {
    tap();
    const patch: Partial<Task> = { repeat: r };
    if (r && !task.plannedFor) {
      patch.plannedFor = firstOccurrence(r, today);
      if (task.status === "inbox" || task.status === "someday") patch.status = "planned";
    }
    updateTask(task.id, patch);
  };
  const toggleWeekday = (d: number) => {
    if (task.repeat?.type !== "weekly") return;
    const cur = task.repeat.weekdays ?? [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b);
    if (next.length === 0) return; // a weekly rule needs at least one day
    applyRepeat({ type: "weekly", weekdays: next });
  };
  const weekdaysOnly = task.repeat?.type === "weekly" && [...(task.repeat.weekdays ?? [])].sort().join() === WEEKDAYS_ONLY.join();

  /* ------------------------------------------------------------- type it */

  const parsed = (() => {
    if (!typed.trim()) return null;
    const p = parseQuickAdd(typed, state.lists);
    // "fri 6pm every week" means every Friday: the parser pins a bare "every week" to today's weekday
    if (p.repeat?.type === "weekly" && p.plannedFor && /\bevery\s+week\b|\bweekly\b/i.test(typed)) {
      p.repeat = { type: "weekly", weekdays: [parseDateStr(p.plannedFor).getDay()] };
    }
    return p;
  })();
  const understood = parsed
    ? [
        parsed.plannedFor ? friendlyDay(parsed.plannedFor, today) : null,
        parsed.plannedTime ? fmtTime12(parsed.plannedTime) : null,
        parsed.repeat ? repeatWords(parsed.repeat).toLowerCase() : null,
        parsed.estimateMin ? `takes ~${fmtMinutes(parsed.estimateMin)}` : null,
        parsed.dueDate ? `due ${friendlyDay(parsed.dueDate, today)}` : null,
        parsed.listName ? `in ${parsed.listName}` : null,
      ].filter((x): x is string => Boolean(x))
    : [];
  const applyTyped = () => {
    if (!parsed || understood.length === 0) {
      showToast({ message: "Didn't catch a day or time in that. Try “tomorrow 6pm” or “every monday”." });
      return;
    }
    const patch: Partial<Task> = {};
    if (parsed.plannedFor) {
      patch.plannedFor = parsed.plannedFor;
      if (!done) patch.status = "planned";
    }
    if (parsed.plannedTime) patch.plannedTime = parsed.plannedTime;
    if (parsed.repeat) patch.repeat = parsed.repeat;
    if (parsed.estimateMin) patch.estimateMin = parsed.estimateMin;
    if (parsed.dueDate) patch.dueDate = parsed.dueDate;
    if (parsed.listId) patch.listId = parsed.listId;
    updateTask(task.id, patch);
    setTyped("");
    answered("date");
  };

  /* --------------------------------------------------------------- start */

  const start = () => {
    if (task.estimateMin != null) {
      close();
      startFocus(task.id, { minutes: task.estimateMin });
      return;
    }
    setStartAfter(true);
    go("estimate");
  };
  const pickEstimate = (min: number) => {
    updateTask(task.id, { estimateMin: min });
    if (startAfter) {
      close();
      startFocus(task.id, { minutes: min });
      return;
    }
    answered("estimate");
  };

  /* -------------------------------------------------------------- extras */

  const extras: { key: Exclude<Panel, null | "date" | "list"> | "share"; icon: React.ReactNode; name: string; value: string | null }[] = [
    { key: "time", icon: <span className="text-[13px] leading-none">🕐</span>, name: "Time", value: task.plannedTime ? fmtTime12(task.plannedTime) : null },
    { key: "remind", icon: <Icon3d name="bell" size={14} />, name: "Reminder", value: task.reminderAt ? momentLabel(task.reminderAt, today) : null },
    { key: "repeat", icon: <Icon3d name="repeat" size={14} />, name: "Repeat", value: task.repeat ? repeatWords(task.repeat) : null },
    { key: "estimate", icon: <Icon3d name="timer" size={14} />, name: "How long?", value: task.estimateMin ? fmtMinutes(task.estimateMin) : null },
    { key: "deadline", icon: <Icon3d name="flag" size={14} />, name: "Deadline", value: task.dueDate ? `Due ${friendlyDay(task.dueDate, today)}` : null },
    // only where it means something: a shared list has someone to assign to
    ...(isShared
      ? [
          {
            key: "assignee" as const,
            icon: assignee ? <PersonAvatar name={assignee.name} picture={assignee.picture} size={14} /> : <span className="text-xs leading-none">👥</span>,
            name: "Assign",
            value: assignee ? (assignee.id === state.user.id ? "You" : assignee.name.split(" ")[0]) : null,
          },
        ]
      : []),
    // sharing starts from the row's menu; once people are on it, they show here
    ...(task.memberIds.length > 0 ? [{ key: "share" as const, icon: <Icon3d name="bird" size={14} />, name: "Share", value: `${task.memberIds.length + 1} people` }] : []),
  ];

  /* lists, right on the card: the first four (the task's own always among them), then a way to the rest */
  const allLists = visibleLists(state);
  const listChips = (() => {
    const first = allLists.slice(0, 4);
    if (list && !first.some((l) => l.id === list.id)) first[first.length - 1] = list;
    return first;
  })();
  const moreLists = allLists.length - listChips.length;

  const stepsDone = subtasks.filter((s) => s.done).length;

  return (
    <Modal onClose={close} wide>
      <div className="p-6 sm:p-8" data-task-editor>
        {panel === null ? (
          <div key="card" className={dir === "back" ? "te-back" : ""}>
            {/* the task itself */}
            <div className="flex items-start gap-3">
              <button
                onClick={complete}
                aria-label={done ? "Mark as not done" : "Mark as done"}
                data-tip={done ? "Not done after all" : "Done"}
                data-editor-check
                className={`mt-1.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                  done || checking ? "anim-check border-moss bg-moss text-on-accent" : "border-ink-faint text-transparent hover:border-moss hover:text-moss/40"
                }`}
              >
                <IconCheck size={13} />
              </button>
              <div className="min-w-0 flex-1">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && close()}
                  className={`w-full bg-transparent font-display text-2xl outline-none placeholder:text-ink-faint ${done ? "text-ink-faint line-through" : ""}`}
                  placeholder="Task title"
                  aria-label="Task title"
                />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note"
                  aria-label="Note"
                  rows={Math.min(6, Math.max(1, note.split("\n").length))}
                  className="mt-0.5 w-full resize-none bg-transparent text-base leading-6 text-ink-soft outline-none placeholder:text-ink-faint sm:text-sm"
                />
              </div>
            </div>

            {/* carried over a few times: say so, and offer the two things that help */}
            {task.carryCount >= 3 && !done && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-lilac/10 px-3.5 py-2.5 text-[13px] text-ink-soft" data-editor-hint>
                <span className="min-w-0 flex-1 basis-52">Rolled over {task.carryCount} days. Smaller steps usually get it moving.</span>
                <button onClick={() => stepInput.current?.focus()} className="h-8 rounded-full bg-card px-3 text-xs font-semibold text-ink shadow-sm hover:bg-paper">
                  Add steps
                </button>
                <button onClick={parkSomeday} className="h-8 rounded-full px-3 text-xs font-semibold text-ink-soft hover:bg-card">
                  Park it
                </button>
              </div>
            )}

            {/* when: one row, one tap, and a line saying what it did */}
            {!done && (
              <section className="mt-7" data-editor-when>
                <div role="radiogroup" aria-label="When will you do it?" className="grid grid-cols-4 gap-1 rounded-2xl bg-paper-deep p-1">
                  <Seg id="today" on={task.plannedFor === today && !someday} onClick={() => setDay(today)}>
                    Today
                  </Seg>
                  <Seg id="tomorrow" on={task.plannedFor === tomorrow && !someday} onClick={() => setDay(tomorrow)}>
                    Tomorrow
                  </Seg>
                  <Seg id="pick" on={otherDay} onClick={() => go("date")}>
                    {otherDay ? friendlyDay(task.plannedFor!, today) : "Pick a date"}
                  </Seg>
                  <Seg id="someday" on={someday} onClick={parkSomeday}>
                    Someday
                  </Seg>
                </div>
                <p key={consequence} className="te-say mt-2.5 px-1 text-[13px] leading-5 text-ink-soft" data-consequence>
                  {consequence}
                </p>
              </section>
            )}

            {/* extras: each one a small "add", lit with its value once it's set */}
            <div className="mt-6 flex flex-wrap gap-2" data-editor-extras>
              {extras.map((x) => (
                <button
                  key={x.key}
                  onClick={() => {
                    setFlash(null);
                    if (x.key === "share") setShareOpen(true);
                    else go(x.key);
                  }}
                  data-extra={x.key}
                  data-set={x.value ? "true" : undefined}
                  className={`inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${flash === x.key ? "te-pop" : ""} ${
                    x.value ? "border-sun/50 bg-sun-soft text-sun-deep" : "border-line text-ink-soft hover:border-ink-faint hover:text-ink"
                  }`}
                >
                  {x.value ? <span className="grid shrink-0 place-items-center">{x.icon}</span> : <IconPlus size={11} />}
                  <span className="truncate">{x.value ?? x.name}</span>
                </button>
              ))}
            </div>

            {/* lists: right here, one tap to file it, one more to take it back out */}
            {allLists.length > 0 && (
              <section className="mt-7" aria-label="Add to list" data-editor-lists>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Add to list</h3>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {listChips.map((l) => {
                    const on = task.listId === l.id;
                    return (
                      <button
                        key={l.id}
                        onClick={() => {
                          tap();
                          updateTask(task.id, { listId: on ? null : l.id });
                        }}
                        aria-pressed={on}
                        data-list-chip={l.id}
                        className={`inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                          on ? "te-pop border-sun/50 bg-sun-soft text-sun-deep" : "border-line text-ink-soft hover:border-ink-faint hover:text-ink"
                        }`}
                      >
                        <ListMark value={l.emoji} size={14} />
                        <span className="truncate">{l.name}</span>
                      </button>
                    );
                  })}
                  {moreLists > 0 && (
                    <button onClick={() => go("list")} className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-ink-faint hover:bg-paper-deep hover:text-ink-soft" data-more-lists>
                      <IconPlus size={11} /> {moreLists} more
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* steps */}
            <section className="mt-7" aria-label="Steps">
              {subtasks.length > 0 && (
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Steps <span className="font-medium normal-case tracking-normal">· {stepsDone} of {subtasks.length}</span>
                </h3>
              )}
              <div className="space-y-2">
                {subtasks.map((s) => (
                  <div key={s.id} className="group flex items-center gap-2.5">
                    <button
                      onClick={() => {
                        tap();
                        setSubtasks((subs) => subs.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)));
                      }}
                      aria-label={s.done ? "Mark step as not done" : "Mark step as done"}
                      className={`grid size-[18px] shrink-0 place-items-center rounded-full border-2 ${s.done ? "border-moss bg-moss text-on-accent" : "border-ink-faint text-transparent hover:border-moss"}`}
                    >
                      <IconCheck size={10} />
                    </button>
                    <span className={`min-w-0 flex-1 break-words text-sm ${s.done ? "text-ink-faint line-through" : ""}`}>{s.title}</span>
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setStepMenu(stepMenu === s.id ? null : s.id)}
                        title="Do this step on its own day"
                        className={`rounded-md px-1.5 py-0.5 text-[11px] transition-colors ${
                          s.plannedFor ? "bg-sun-soft font-medium text-sun-deep" : "text-ink-faint opacity-0 hover:bg-paper-deep hover:text-ink-soft group-hover:opacity-100 pointer-coarse:opacity-100 max-md:opacity-100"
                        }`}
                      >
                        {s.plannedFor ? friendlyDay(s.plannedFor, today) : "+ day"}
                      </button>
                      {stepMenu === s.id && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setStepMenu(null)} />
                          <div className="anim-pop absolute right-0 top-7 z-30 w-40 rounded-xl border border-line bg-card p-1.5 shadow-lg">
                            {[0, 1, 2, 3, 4, 5, 6].map((n) => {
                              const d = addDays(today, n);
                              return (
                                <button
                                  key={d}
                                  onClick={() => {
                                    setSubtasks((subs) => subs.map((x) => (x.id === s.id ? { ...x, plannedFor: d } : x)));
                                    setStepMenu(null);
                                  }}
                                  className={`block w-full rounded-lg px-3 py-1.5 text-left text-xs hover:bg-paper-deep ${s.plannedFor === d ? "font-bold text-sun-deep" : ""}`}
                                >
                                  {friendlyDay(d, today)}
                                </button>
                              );
                            })}
                            {s.plannedFor && (
                              <>
                                <div className="my-1 border-t border-line" />
                                <button
                                  onClick={() => {
                                    setSubtasks((subs) => subs.map((x) => (x.id === s.id ? { ...x, plannedFor: null } : x)));
                                    setStepMenu(null);
                                  }}
                                  className="block w-full rounded-lg px-3 py-1.5 text-left text-xs text-ink-faint hover:bg-paper-deep"
                                >
                                  No day
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setSubtasks((subs) => subs.filter((x) => x.id !== s.id))}
                      className="text-ink-faint opacity-0 hover:text-clay group-hover:opacity-100 pointer-coarse:opacity-100 max-md:opacity-100"
                      aria-label="Remove step"
                    >
                      <IconX size={13} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2.5">
                  <span className="grid size-[18px] place-items-center text-ink-faint">
                    <IconPlus size={13} />
                  </span>
                  <input
                    ref={stepInput}
                    value={newSub}
                    onChange={(e) => setNewSub(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSub()}
                    placeholder="Add a step"
                    aria-label="Add a step"
                    className="flex-1 bg-transparent text-base outline-none placeholder:text-ink-faint sm:text-sm"
                  />
                </div>
              </div>
            </section>

            {/* footer */}
            <div className="mt-8 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setEditing(null);
                  deleteTask(task.id);
                }}
                title="Delete this task. You can undo it right after."
                className="-ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-ink-faint hover:bg-clay-soft hover:text-clay"
                data-editor-delete
              >
                <IconTrash size={14} /> Delete
              </button>
              <div className="flex items-center gap-2">
                {!done && (
                  <button
                    onClick={start}
                    title={task.estimateMin != null ? `Focus on this for ~${fmtMinutes(task.estimateMin)}` : "Start a focus timer"}
                    className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-sun-deep transition-colors hover:bg-sun-soft"
                    data-editor-start
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                      <path d="M3 1.8v8.4a.6.6 0 00.92.5l6.3-4.2a.6.6 0 000-1L3.92 1.3a.6.6 0 00-.92.5z" />
                    </svg>
                    Start
                  </button>
                )}
                <button onClick={close} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90">
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div key={panel} className="te-in" data-panel={panel}>
            {panel === "date" && (
              <Question onBack={back} title="Which day?" help="It shows up on that day's plan.">
                <DatePicker
                  value={task.plannedFor}
                  today={today}
                  clearLabel="No day yet"
                  quickPicks={[
                    { label: "This weekend", date: weekend },
                    { label: "Next week", date: nextWeek },
                  ]}
                  onChange={(date) => {
                    setDay(date);
                    back();
                  }}
                />
                {/* or in words: the same parser as the capture bar */}
                <div className="mt-4 max-w-[300px]" data-type-box>
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-1.5 focus-within:border-sun">
                    <input
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && applyTyped()}
                      placeholder="Or type it: fri 6pm"
                      aria-label="Type when, in your own words"
                      className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-faint sm:text-sm"
                    />
                    {understood.length > 0 && (
                      <button onClick={applyTyped} className="shrink-0 text-xs font-semibold text-sun-deep hover:underline">
                        Set
                      </button>
                    )}
                  </div>
                  {understood.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                      {understood.map((u) => (
                        <span key={u} className="rounded-full bg-sun-soft px-2 py-0.5 font-medium text-sun-deep">
                          {u}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Question>
            )}

            {panel === "time" && (
              <Question onBack={back} title="What time?" help="Optional. Your day is sorted by it.">
                <div className="space-y-1.5">
                  {TIMES.map(([val, name, clock]) => (
                    <Choice
                      key={val}
                      on={task.plannedTime === val}
                      onClick={() => {
                        setTime(val);
                        answered("time");
                      }}
                      label={name}
                      detail={clock}
                    />
                  ))}
                </div>
                <label className="mt-3 flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink-soft">
                  Or exactly
                  <input
                    type="time"
                    value={task.plannedTime ?? ""}
                    onChange={(e) => setTime(e.target.value || null)}
                    className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-base outline-none focus:border-sun sm:text-sm"
                  />
                </label>
                {task.plannedTime && (
                  <Remove
                    onClick={() => {
                      updateTask(task.id, { plannedTime: null });
                      answered("time");
                    }}
                  >
                    No time
                  </Remove>
                )}
              </Question>
            )}

            {panel === "remind" && (
              <Question onBack={back} title="When should Kairo nudge you?" help="A notification on this device. It skips itself if the task is already done.">
                <RemindChoices
                  today={today}
                  plannedAt={plannedAt}
                  current={task.reminderAt}
                  onPick={async (ms) => {
                    if (await setReminder(ms)) answered("remind");
                  }}
                />
                {task.reminderAt && (
                  <Remove
                    onClick={() => {
                      void setReminder(null);
                      answered("remind");
                    }}
                  >
                    No reminder
                  </Remove>
                )}
              </Question>
            )}

            {panel === "repeat" && (
              <Question onBack={back} title="Does it come back?" help="Finish it, and it returns on the next date by itself.">
                <div className="space-y-1.5">
                  <Choice on={!task.repeat} onClick={() => applyRepeat(null)} label="No, just once" />
                  <Choice on={task.repeat?.type === "daily"} onClick={() => applyRepeat({ type: "daily", interval: 1 })} label="Every day" detail={task.repeat?.type === "daily" && (task.repeat.interval ?? 1) > 1 ? `every ${task.repeat.interval} days` : undefined} />
                  <Choice on={Boolean(weekdaysOnly)} onClick={() => applyRepeat({ type: "weekly", weekdays: WEEKDAYS_ONLY })} label="Every weekday" detail="Mon to Fri" />
                  <Choice
                    on={task.repeat?.type === "weekly" && !weekdaysOnly}
                    onClick={() => applyRepeat({ type: "weekly", weekdays: [parseDateStr(anchorDate).getDay()] })}
                    label="Every week"
                    detail={`on ${weekdayName(anchorDate)}`}
                  />
                  <Choice on={task.repeat?.type === "monthly"} onClick={() => applyRepeat({ type: "monthly", dayOfMonth: Number(anchorDate.slice(8)) })} label="Every month" detail={`on the ${ordinal(Number(anchorDate.slice(8)))}`} />
                </div>

                {task.repeat?.type === "daily" && (
                  <Stepper label="Every" suffix={(task.repeat.interval ?? 1) === 1 ? "day" : "days"} value={task.repeat.interval ?? 1} min={1} max={365} onChange={(interval) => applyRepeat({ type: "daily", interval })} />
                )}
                {task.repeat?.type === "weekly" && (
                  <div className="mt-4 flex gap-1.5">
                    {WEEK_MON_FIRST.map((d) => {
                      const on = task.repeat?.type === "weekly" && (task.repeat.weekdays ?? []).includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() => toggleWeekday(d)}
                          aria-pressed={on}
                          aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]}
                          className={`grid size-9 place-items-center rounded-full text-xs font-bold transition-colors ${on ? "bg-sun text-on-accent" : "border border-line bg-card text-ink-soft hover:border-ink-faint"}`}
                        >
                          {DAY_LETTER[d]}
                        </button>
                      );
                    })}
                  </div>
                )}
                {task.repeat?.type === "monthly" && (
                  <Stepper label="On the" suffix="" ordinal value={task.repeat.dayOfMonth ?? 1} min={1} max={31} onChange={(dayOfMonth) => applyRepeat({ type: "monthly", dayOfMonth })} />
                )}
                <PanelDone onClick={() => answered("repeat")} />
              </Question>
            )}

            {panel === "estimate" && (
              <Question
                onBack={back}
                title={startAfter ? "How long will you focus?" : "How long will it take?"}
                help={startAfter ? "Pick a length and the timer starts." : "A rough guess. It warns you when a day is too full, and runs the focus timer."}
              >
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 30, 45, 60, 90, 120].map((m) => (
                    <button
                      key={m}
                      onClick={() => pickEstimate(m)}
                      aria-pressed={task.estimateMin === m}
                      className={`rounded-2xl border py-3 text-sm font-semibold transition-colors ${task.estimateMin === m ? "border-sun bg-sun-soft text-sun-deep" : "border-line bg-card text-ink-soft hover:border-ink-faint"}`}
                    >
                      {fmtMinutes(m)}
                    </button>
                  ))}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-[13px] font-medium text-ink-faint hover:text-ink-soft">Another length</summary>
                  <div className="mt-2">
                    <DurationWheel minutes={task.estimateMin} onChange={(min) => updateTask(task.id, { estimateMin: min })} />
                    <PanelDone
                      label={startAfter ? "Start" : "Done"}
                      onClick={() => {
                        if (startAfter && task.estimateMin) pickEstimate(task.estimateMin);
                        else answered("estimate");
                      }}
                    />
                  </div>
                </details>
                {task.estimateMin != null && !startAfter && (
                  <Remove
                    onClick={() => {
                      updateTask(task.id, { estimateMin: null });
                      answered("estimate");
                    }}
                  >
                    No estimate
                  </Remove>
                )}
              </Question>
            )}

            {panel === "deadline" && (
              <Question onBack={back} title="Is there a real due date?" help="For outside deadlines, like a bill or a flight. It's separate from the day you plan to do it.">
                <DatePicker
                  value={task.dueDate}
                  today={today}
                  clearLabel="No deadline"
                  onChange={(date) => {
                    updateTask(task.id, { dueDate: date });
                    answered("deadline");
                  }}
                />
              </Question>
            )}

            {panel === "list" && (
              <Question onBack={back} title="Which list?" help="Lists group tasks by project or part of life.">
                <div className="space-y-1.5">
                  {visibleLists(state).map((l) => (
                    <Choice
                      key={l.id}
                      on={task.listId === l.id}
                      onClick={() => {
                        updateTask(task.id, { listId: l.id });
                        answered("list");
                      }}
                      icon={<ListMark value={l.emoji} size={18} />}
                      label={l.name}
                    />
                  ))}
                  {state.lists.length === 0 && <p className="text-sm text-ink-faint">No lists yet. Make one in Lists, and it shows up here.</p>}
                </div>
                {task.listId && (
                  <Remove
                    onClick={() => {
                      updateTask(task.id, { listId: null });
                      answered("list");
                    }}
                  >
                    No list
                  </Remove>
                )}
              </Question>
            )}

            {panel === "assignee" && (
              <Question onBack={back} title="Who's doing it?" help="They get a notification. Anyone on the list can still tick it off.">
                <div className="space-y-1.5">
                  <Choice
                    on={!task.assigneeId}
                    onClick={() => {
                      updateTask(task.id, { assigneeId: null });
                      answered("assignee");
                    }}
                    label="Anyone"
                  />
                  {members === null ? (
                    <p className="px-1 text-sm text-ink-faint">Loading people…</p>
                  ) : (
                    members.map((m) => (
                      <Choice
                        key={m.id}
                        on={task.assigneeId === m.id}
                        onClick={() => {
                          updateTask(task.id, { assigneeId: m.id });
                          answered("assignee");
                        }}
                        icon={<PersonAvatar name={m.name} picture={m.picture} size={20} />}
                        label={m.id === state.user.id ? "You" : m.name}
                      />
                    ))
                  )}
                </div>
              </Question>
            )}
          </div>
        )}
      </div>

      {shareOpen && (
        <ShareTaskModal
          task={task}
          onClose={() => setShareOpen(false)}
          onSendCopy={() => {
            setShareOpen(false);
            setSendOpen(true);
          }}
        />
      )}
      {sendOpen && <SendTaskModal task={task} onClose={() => setSendOpen(false)} />}
    </Modal>
  );
}

/* ------------------------------------------------------------------ pieces */

/** One answer in the row of days. */
function Seg({ id, on, onClick, children }: { id: string; on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="radio"
      aria-checked={on}
      onClick={onClick}
      data-day={id}
      className={`h-9 min-w-0 truncate rounded-xl px-1 text-[13px] transition-colors ${on ? "te-pop bg-card font-semibold text-ink shadow-sm" : "font-medium text-ink-soft hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

/** One question at a time, in place of the card: a way back, the question, and what it means. */
function Question({ onBack, title, help, children }: { onBack: () => void; title: string; help: string; children: React.ReactNode }) {
  return (
    <div>
      <button onClick={onBack} className="-ml-1.5 flex items-center gap-1 rounded-lg px-1.5 py-1 text-[13px] font-semibold text-ink-soft hover:bg-paper-deep hover:text-ink" data-panel-back>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>
      <h3 className="mt-2 font-display text-2xl leading-tight">{title}</h3>
      <p className="mt-1 max-w-md text-[13px] leading-5 text-ink-soft">{help}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

/** An answer, as a full-width row: what it is on the left, what it comes to on the right. */
function Choice({ on, onClick, label, detail, icon }: { on?: boolean; onClick: () => void; label: string; detail?: string; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={Boolean(on)}
      className={`flex w-full items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left transition-colors ${on ? "border-sun bg-sun-soft/60" : "border-line bg-card hover:border-ink-faint"}`}
    >
      <span className={`grid size-4 shrink-0 place-items-center rounded-full border-2 ${on ? "border-sun" : "border-line"}`} aria-hidden>
        {on && <span className="size-1.5 rounded-full bg-sun" />}
      </span>
      {icon}
      <span className={`min-w-0 flex-1 truncate text-sm font-medium ${on ? "text-sun-deep" : ""}`}>{label}</span>
      {detail && <span className={`shrink-0 text-xs ${on ? "font-semibold text-sun-deep" : "text-ink-faint"}`}>{detail}</span>}
    </button>
  );
}

function Remove({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="mt-3 text-[13px] font-medium text-ink-faint underline-offset-2 hover:text-clay hover:underline" data-panel-remove>
      {children}
    </button>
  );
}

function PanelDone({ onClick, label = "Done" }: { onClick: () => void; label?: string }) {
  return (
    <div className="mt-5 flex justify-end">
      <button onClick={onClick} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90" data-panel-done>
        {label}
      </button>
    </div>
  );
}

/** When to nudge: each answer says the moment it comes to, so nothing is a guess. */
function RemindChoices({ today, plannedAt, current, onPick }: { today: string; plannedAt: number | null; current: number | null; onPick: (ms: number) => void }) {
  // the clock, read once as the question opens
  const [now] = useState(() => Date.now());
  const at = (hour: number, addDay = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + addDay);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };
  const options = [
    plannedAt && plannedAt > now ? { label: "Right when it's planned", ms: plannedAt } : null,
    plannedAt && plannedAt - 15 * 60_000 > now ? { label: "15 minutes before", ms: plannedAt - 15 * 60_000 } : null,
    { label: "In 1 hour", ms: now + 3600_000 },
    { label: "In 3 hours", ms: now + 3 * 3600_000 },
    at(18) > now + 3600_000 ? { label: "This evening", ms: at(18) } : null,
    { label: "Tomorrow morning", ms: at(9, 1) },
  ].filter((o): o is { label: string; ms: number } => o !== null);
  return (
    <>
      <div className="space-y-1.5">
        {options.map((o) => (
          <Choice key={o.label} on={current === o.ms} onClick={() => onPick(o.ms)} label={o.label} detail={momentLabel(o.ms, today)} />
        ))}
      </div>
      <label className="mt-3 flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink-soft">
        Or an exact moment
        <input
          type="datetime-local"
          defaultValue={current ? toLocalInputValue(current) : ""}
          onChange={(e) => {
            if (!e.target.value) return;
            const ms = new Date(e.target.value).getTime();
            if (Number.isFinite(ms)) onPick(ms);
          }}
          className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-base outline-none focus:border-sun sm:text-sm"
        />
      </label>
    </>
  );
}

function Stepper({ label, suffix, value, min, max, onChange, ordinal: asOrdinal }: { label: string; suffix: string; value: number; min: number; max: number; onChange: (v: number) => void; ordinal?: boolean }) {
  return (
    <div className="mt-4 flex items-center gap-2 text-sm">
      <span className="text-ink-soft">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Decrease"
        className="grid size-8 place-items-center rounded-full border border-line bg-card text-ink-soft hover:border-ink-faint disabled:opacity-30"
        disabled={value <= min}
      >
        −
      </button>
      <span className="min-w-10 text-center font-bold tabular-nums">{asOrdinal ? ordinal(value) : value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Increase"
        className="grid size-8 place-items-center rounded-full border border-line bg-card text-ink-soft hover:border-ink-faint disabled:opacity-30"
        disabled={value >= max}
      >
        +
      </button>
      {suffix && <span className="text-ink-soft">{suffix}</span>}
    </div>
  );
}
