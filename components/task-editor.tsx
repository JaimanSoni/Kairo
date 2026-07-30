"use client";

import { useEffect, useState } from "react";
import type { Subtask, Task } from "@/lib/types";
import { addDays, friendlyDay, fmtMinutes, fmtReminder, fmtTime12, parseDateStr, planEpoch } from "@/lib/dates";
import { firstOccurrence, repeatLabel, type Repeat } from "@/lib/repeat";
import { cancelPush, enablePush, pushEnabled, schedulePush } from "@/lib/push-client";
import { personById, useApp, visibleLists } from "./store";
import { Icon3d, ListMark } from "./img3d";
import { PersonAvatar } from "./person-avatar";
import { DatePicker } from "./date-picker";
import { DurationWheel } from "./wheel";
import { IconCheck, IconPlus, IconX, Modal } from "./ui";

type Member = { id: string; name: string; email: string; picture?: string };

type Section = "day" | "repeat" | "deadline" | "estimate" | "list" | "reminder" | "assignee" | null;

function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const WEEK_MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const DAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];

export function TaskEditor({ task }: { task: Task }) {
  const { state, updateTask, deleteTask, setEditing, startFocus, showToast } = useApp();
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note);
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks);
  const [newSub, setNewSub] = useState("");
  const [stepMenu, setStepMenu] = useState<string | null>(null);
  const [open, setOpen] = useState<Section>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const today = state.today;
  const list = task.listId ? state.lists.find((l) => l.id === task.listId) : null;
  const isShared = Boolean(list && (list.memberCount > 0 || list.role === "member"));
  const assignee = personById(state, task.assigneeId);

  /* pull the list's members when the assignee picker opens */
  useEffect(() => {
    if (open !== "assignee" || !task.listId) return;
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
  }, [open, task.listId]);

  const close = () => {
    const patch: Partial<Task> = {};
    if (title.trim() && title.trim() !== task.title) patch.title = title.trim();
    if (note !== task.note) patch.note = note;
    if (JSON.stringify(subtasks) !== JSON.stringify(task.subtasks)) patch.subtasks = subtasks;
    if (Object.keys(patch).length) updateTask(task.id, patch);
    setEditing(null);
  };

  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    setSubtasks((s) => [...s, { id: crypto.randomUUID(), title: t, done: false }]);
    setNewSub("");
  };

  const toggleSection = (s: Section) => setOpen((cur) => (cur === s ? null : s));

  const dayLabel =
    task.status === "someday"
      ? "Someday"
      : task.plannedFor
        ? `${friendlyDay(task.plannedFor, today)}${task.plannedTime ? ` · ${fmtTime12(task.plannedTime)}` : ""}`
        : "No day";

  const anchorDate = task.plannedFor ?? today;
  const applyRepeat = (r: Repeat | null) => {
    const patch: Partial<Task> = { repeat: r };
    if (r && !task.plannedFor) {
      patch.plannedFor = firstOccurrence(r, today);
      if (task.status === "inbox" || task.status === "someday") patch.status = "planned";
    }
    updateTask(task.id, patch);
  };

  const setReminder = async (fireAt: number | null) => {
    if (fireAt === null) {
      cancelPush(`remind-${task.id}`);
      updateTask(task.id, { reminderAt: null });
      return;
    }
    if (fireAt <= Date.now() + 30_000) {
      showToast({ message: "That time’s already gone. Pick one still ahead." });
      return;
    }
    let ok = await pushEnabled();
    if (!ok) {
      const result = await enablePush();
      ok = result.status === "enabled";
      if (!ok) {
        showToast({
          message:
            result.status === "denied"
              ? "Notifications are blocked for this site — allow them in browser settings"
              : result.status === "insecure"
                ? "Push needs HTTPS or localhost — LAN IPs can't receive notifications"
                : result.status === "failed"
                  ? `Couldn't enable notifications: ${result.detail}`
                  : "Push isn't supported in this browser",
        });
        return;
      }
    }
    updateTask(task.id, { reminderAt: fireAt });
    schedulePush({
      fireAt,
      title: task.title,
      body: "You asked to be nudged about this now.",
      tag: `remind-${task.id}`,
      url: "/today",
      taskId: task.id,
    });
    showToast({ message: `🔔 ${fmtReminder(fireAt, today)}` });
  };

  const toggleWeekday = (d: number) => {
    if (task.repeat?.type !== "weekly") return;
    const cur = task.repeat.weekdays ?? [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b);
    if (next.length === 0) return; // a weekly rule needs at least one day
    applyRepeat({ type: "weekly", weekdays: next });
  };

  return (
    <Modal onClose={close} wide>
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && close()}
            className="w-full bg-transparent font-display text-2xl outline-none placeholder:text-ink-faint"
            placeholder="Task title"
          />
          <button onClick={close} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-deep" aria-label="Close">
            <IconX />
          </button>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notes — why does this matter? links, context…"
          rows={2}
          className="mt-3 w-full resize-none rounded-xl border border-line bg-paper px-3 py-2 text-base outline-none placeholder:text-ink-faint focus:border-sun sm:text-sm"
        />

        {/* steps */}
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Steps{" "}
            {task.carryCount >= 3 && (
              <span className="ml-2 normal-case text-lilac">
                carried ×{task.carryCount} — breaking it down usually helps ↓
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {subtasks.map((s) => (
              <div key={s.id} className="group flex items-center gap-2.5">
                <button
                  onClick={() =>
                    setSubtasks((subs) => subs.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))
                  }
                  className={`grid size-[18px] shrink-0 place-items-center rounded-full border-2 ${
                    s.done ? "border-moss bg-moss text-on-accent" : "border-ink-faint text-transparent"
                  }`}
                >
                  <IconCheck size={10} />
                </button>
                <span className={`min-w-0 flex-1 break-words text-sm ${s.done ? "text-ink-faint line-through" : ""}`}>
                  {s.title}
                </span>
                <div className="relative shrink-0">
                  <button
                    onClick={() => setStepMenu(stepMenu === s.id ? null : s.id)}
                    title="Plan this step onto a day"
                    className={`rounded-md px-1.5 py-0.5 text-[11px] transition-colors ${
                      s.plannedFor
                        ? "bg-sun-soft font-medium text-sun-deep"
                        : "text-ink-faint hover:bg-paper-deep hover:text-ink-soft"
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
                                setSubtasks((subs) =>
                                  subs.map((x) => (x.id === s.id ? { ...x, plannedFor: d } : x))
                                );
                                setStepMenu(null);
                              }}
                              className={`block w-full rounded-lg px-3 py-1.5 text-left text-xs hover:bg-paper-deep ${
                                s.plannedFor === d ? "font-bold text-sun-deep" : ""
                              }`}
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
                                setSubtasks((subs) =>
                                  subs.map((x) => (x.id === s.id ? { ...x, plannedFor: null } : x))
                                );
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
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSub()}
                placeholder="Add a step…"
                className="flex-1 bg-transparent text-base outline-none placeholder:text-ink-faint sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* property accordion */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-line">
          <PropRow
            label="Planned day"
            value={dayLabel}
            active={Boolean(task.plannedFor) || task.status === "someday"}
            open={open === "day"}
            onClick={() => toggleSection("day")}
            icon={<Icon3d name="sun" size={18} />}
          />
          {open === "day" && (
            <div className="anim-rise border-b border-line bg-paper px-4 py-4">
              <DatePicker
                value={task.plannedFor}
                today={today}
                onChange={(date) => {
                  updateTask(task.id, {
                    plannedFor: date,
                    status: task.status === "done" ? "done" : date ? "planned" : "inbox",
                    ...(date ? {} : { spotlight: false }),
                  });
                }}
              />
              {/* time-of-day — only when a real day is chosen */}
              {task.plannedFor && task.status !== "someday" && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    Time <span className="normal-case text-ink-faint">(optional)</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      ["09:00", "9 AM"],
                      ["12:00", "Noon"],
                      ["15:00", "3 PM"],
                      ["18:00", "6 PM"],
                      ["21:00", "9 PM"],
                    ].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => updateTask(task.id, { plannedTime: task.plannedTime === val ? null : val })}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          task.plannedTime === val
                            ? "border-sun bg-sun-soft text-sun-deep"
                            : "border-line bg-card text-ink-soft hover:border-ink-faint"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    <input
                      type="time"
                      value={task.plannedTime ?? ""}
                      onChange={(e) => updateTask(task.id, { plannedTime: e.target.value || null })}
                      className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-base outline-none focus:border-sun sm:text-sm"
                    />
                    {task.plannedTime && (
                      <button
                        onClick={() => updateTask(task.id, { plannedTime: null })}
                        className="text-xs font-medium text-ink-faint underline hover:text-ink"
                      >
                        clear
                      </button>
                    )}
                  </div>
                  {task.plannedTime && (
                    <button
                      onClick={() => setReminder(planEpoch(task.plannedFor!, task.plannedTime!))}
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        task.reminderAt === planEpoch(task.plannedFor, task.plannedTime)
                          ? "border-sun bg-sun-soft text-sun-deep"
                          : "border-line bg-card text-ink-soft hover:border-sun hover:text-sun-deep"
                      }`}
                    >
                      🔔 {task.reminderAt === planEpoch(task.plannedFor, task.plannedTime)
                        ? `Reminder set for ${fmtTime12(task.plannedTime)}`
                        : "Remind me at this time"}
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={() =>
                  updateTask(task.id, { plannedFor: null, status: "someday", spotlight: false })
                }
                className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  task.status === "someday"
                    ? "border-sun bg-sun-soft text-sun-deep"
                    : "border-line bg-card text-ink-soft hover:border-ink-faint"
                }`}
              >
                <Icon3d name="moon" size={15} /> Someday — park it, guilt-free
              </button>
            </div>
          )}

          <PropRow
            label="Repeat"
            value={task.repeat ? `↻ ${repeatLabel(task.repeat)}` : "Never"}
            active={Boolean(task.repeat)}
            open={open === "repeat"}
            onClick={() => toggleSection("repeat")}
            icon={<Icon3d name="repeat" size={18} />}
          />
          {open === "repeat" && (
            <div className="anim-rise border-b border-line bg-paper px-4 py-4">
              <div className="flex flex-wrap gap-1.5">
                <RuleChip active={!task.repeat} onClick={() => applyRepeat(null)}>
                  Never
                </RuleChip>
                <RuleChip
                  active={task.repeat?.type === "daily"}
                  onClick={() => applyRepeat({ type: "daily", interval: 1 })}
                >
                  Daily
                </RuleChip>
                <RuleChip
                  active={task.repeat?.type === "weekly"}
                  onClick={() =>
                    applyRepeat({ type: "weekly", weekdays: [parseDateStr(anchorDate).getDay()] })
                  }
                >
                  Weekly
                </RuleChip>
                <RuleChip
                  active={task.repeat?.type === "monthly"}
                  onClick={() =>
                    applyRepeat({ type: "monthly", dayOfMonth: Number(anchorDate.slice(8)) })
                  }
                >
                  Monthly
                </RuleChip>
              </div>

              {task.repeat?.type === "daily" && (
                <Stepper
                  label="every"
                  suffix={(task.repeat.interval ?? 1) === 1 ? "day" : "days"}
                  value={task.repeat.interval ?? 1}
                  min={1}
                  max={365}
                  onChange={(interval) => applyRepeat({ type: "daily", interval })}
                />
              )}

              {task.repeat?.type === "weekly" && (
                <div className="mt-3 flex gap-1.5">
                  {WEEK_MON_FIRST.map((d) => {
                    const on = task.repeat?.type === "weekly" && (task.repeat.weekdays ?? []).includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => toggleWeekday(d)}
                        className={`grid size-9 place-items-center rounded-full text-xs font-bold transition-colors ${
                          on ? "bg-sun text-on-accent" : "bg-card text-ink-soft border border-line hover:border-ink-faint"
                        }`}
                        aria-pressed={on}
                      >
                        {DAY_LETTER[d]}
                      </button>
                    );
                  })}
                </div>
              )}

              {task.repeat?.type === "monthly" && (
                <Stepper
                  label="on the"
                  suffix=""
                  ordinal
                  value={task.repeat.dayOfMonth ?? 1}
                  min={1}
                  max={31}
                  onChange={(dayOfMonth) => applyRepeat({ type: "monthly", dayOfMonth })}
                />
              )}

              {task.repeat && (
                <p className="mt-3 text-xs text-ink-soft">
                  Finishing it logs a win and rolls the card to the next date — miss a day and the
                  morning sweep offers a guilt-free skip.
                </p>
              )}
            </div>
          )}

          <PropRow
            label="Estimate"
            value={task.estimateMin ? `~${fmtMinutes(task.estimateMin)}` : "None"}
            active={Boolean(task.estimateMin)}
            open={open === "estimate"}
            onClick={() => toggleSection("estimate")}
            icon={<Icon3d name="timer" size={18} />}
          />
          {open === "estimate" && (
            <div className="anim-rise border-b border-line bg-paper px-4 py-3">
              <DurationWheel
                minutes={task.estimateMin}
                onChange={(min) => updateTask(task.id, { estimateMin: min })}
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-ink-faint">scroll to set — any amount</span>
                {task.estimateMin != null && (
                  <button
                    onClick={() => updateTask(task.id, { estimateMin: null })}
                    className="text-xs font-medium text-ink-faint underline hover:text-ink"
                  >
                    clear
                  </button>
                )}
              </div>
            </div>
          )}

          <PropRow
            label="Deadline"
            value={task.dueDate ? `due ${friendlyDay(task.dueDate, today)}` : "None"}
            active={Boolean(task.dueDate)}
            open={open === "deadline"}
            onClick={() => toggleSection("deadline")}
            icon={<Icon3d name="flag" size={18} />}
          />
          {open === "deadline" && (
            <div className="anim-rise border-b border-line bg-paper px-4 py-4">
              <p className="mb-3 text-xs text-ink-soft">
                A real, external deadline — rare on purpose. Kairo never turns these red.
              </p>
              <DatePicker
                value={task.dueDate}
                today={today}
                clearLabel="No deadline"
                onChange={(date) => updateTask(task.id, { dueDate: date })}
              />
            </div>
          )}

          <PropRow
            label="Reminder"
            value={task.reminderAt ? fmtReminder(task.reminderAt, today) : "None"}
            active={Boolean(task.reminderAt)}
            open={open === "reminder"}
            onClick={() => toggleSection("reminder")}
            icon={<Icon3d name="bell" size={18} />}
          />
          {open === "reminder" && (
            <div className="anim-rise border-b border-line bg-paper px-4 py-4">
              <div className="flex flex-wrap gap-1.5">
                <RuleChip
                  onClick={() => setReminder(Date.now() + 60 * 60 * 1000)}
                >
                  In 1 hour
                </RuleChip>
                <RuleChip
                  onClick={() => setReminder(Date.now() + 3 * 60 * 60 * 1000)}
                >
                  In 3 hours
                </RuleChip>
                <RuleChip
                  onClick={() => {
                    const d = new Date();
                    d.setHours(18, 0, 0, 0);
                    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
                    setReminder(d.getTime());
                  }}
                >
                  Evening 18:00
                </RuleChip>
                <RuleChip
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    d.setHours(9, 0, 0, 0);
                    setReminder(d.getTime());
                  }}
                >
                  Tomorrow 9:00
                </RuleChip>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  defaultValue={task.reminderAt ? toLocalInputValue(task.reminderAt) : ""}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const ms = new Date(e.target.value).getTime();
                    if (Number.isFinite(ms)) setReminder(ms);
                  }}
                  className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-base outline-none focus:border-sun sm:text-sm"
                />
                {task.reminderAt && (
                  <button
                    onClick={() => setReminder(null)}
                    className="text-xs font-medium text-ink-faint underline hover:text-ink"
                  >
                    clear
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                A push notification, even if the app is closed. It quietly skips itself if the
                task is already done.
              </p>
            </div>
          )}

          <PropRow
            label="List"
            value={list ? list.name : "None"}
            active={Boolean(list)}
            open={open === "list"}
            onClick={() => toggleSection("list")}
            icon={list ? <ListMark value={list.emoji} size={18} /> : <Icon3d name="list-folder" size={18} />}
            last={!isShared}
          />
          {open === "list" && (
            <div className="anim-rise border-b border-line bg-paper px-4 py-4">
              <div className="flex flex-wrap gap-1.5">
                {visibleLists(state).map((l) => (
                  <button
                    key={l.id}
                    onClick={() =>
                      updateTask(task.id, { listId: task.listId === l.id ? null : l.id })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      task.listId === l.id
                        ? "border-sun bg-sun-soft text-sun-deep"
                        : "border-line bg-card text-ink-soft hover:border-ink-faint"
                    }`}
                  >
                    <ListMark value={l.emoji} size={14} /> {l.name}
                  </button>
                ))}
                {state.lists.length === 0 && (
                  <span className="text-xs text-ink-faint">No lists yet — create one in Lists</span>
                )}
              </div>
            </div>
          )}

          {isShared && (
            <>
              <PropRow
                label="Assignee"
                value={
                  assignee
                    ? assignee.id === state.user.id
                      ? "You"
                      : assignee.name.split(" ")[0]
                    : "Anyone"
                }
                active={Boolean(task.assigneeId)}
                open={open === "assignee"}
                onClick={() => toggleSection("assignee")}
                icon={
                  assignee ? (
                    <PersonAvatar name={assignee.name} picture={assignee.picture} size={18} />
                  ) : (
                    <span className="text-base">👥</span>
                  )
                }
                last
              />
              {open === "assignee" && (
                <div className="anim-rise bg-paper px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => updateTask(task.id, { assigneeId: null })}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        !task.assigneeId
                          ? "border-sun bg-sun-soft text-sun-deep"
                          : "border-line bg-card text-ink-soft hover:border-ink-faint"
                      }`}
                    >
                      Anyone
                    </button>
                    {members === null ? (
                      <span className="self-center text-xs text-ink-faint">Loading people…</span>
                    ) : (
                      members.map((m) => (
                        <button
                          key={m.id}
                          onClick={() =>
                            updateTask(task.id, {
                              assigneeId: task.assigneeId === m.id ? null : m.id,
                            })
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            task.assigneeId === m.id
                              ? "border-sun bg-sun-soft text-sun-deep"
                              : "border-line bg-card text-ink-soft hover:border-ink-faint"
                          }`}
                        >
                          <PersonAvatar name={m.name} picture={m.picture} size={16} />
                          {m.id === state.user.id ? "You" : m.name.split(" ")[0]}
                        </button>
                      ))
                    )}
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    The assignee gets a notification. Anyone on the list can still see and complete it.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* footer */}
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <button
            onClick={() => {
              setEditing(null);
              deleteTask(task.id);
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-ink-faint hover:bg-clay-soft hover:text-clay"
          >
            <Icon3d name="leaf" size={15} /> Let it go
          </button>
          <div className="flex items-center gap-2">
            {task.estimateMin != null && task.status !== "done" && (
              <button
                onClick={() => {
                  close();
                  startFocus(task.id);
                }}
                className="flex items-center gap-1.5 rounded-full border border-sun bg-sun-soft px-4 py-2 text-sm font-semibold text-sun-deep transition-transform hover:-translate-y-0.5"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M3 1.8v8.4a.6.6 0 00.92.5l6.3-4.2a.6.6 0 000-1L3.92 1.3a.6.6 0 00-.92.5z" />
                </svg>
                Start
              </button>
            )}
            <button
              onClick={close}
              className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function RuleChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-sun bg-sun-soft text-sun-deep"
          : "border-line bg-card text-ink-soft hover:border-ink-faint"
      }`}
    >
      {children}
    </button>
  );
}

function Stepper({
  label,
  suffix,
  value,
  min,
  max,
  onChange,
  ordinal,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  ordinal?: boolean;
}) {
  const fmt = (n: number) => {
    if (!ordinal) return String(n);
    const r10 = n % 10;
    const r100 = n % 100;
    if (r10 === 1 && r100 !== 11) return `${n}st`;
    if (r10 === 2 && r100 !== 12) return `${n}nd`;
    if (r10 === 3 && r100 !== 13) return `${n}rd`;
    return `${n}th`;
  };
  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <span className="text-ink-soft">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Decrease"
        className="grid size-8 place-items-center rounded-full border border-line bg-card text-ink-soft hover:border-ink-faint disabled:opacity-30"
        disabled={value <= min}
      >
        −
      </button>
      <span className="min-w-10 text-center font-bold tabular-nums">{fmt(value)}</span>
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

function PropRow({
  label,
  value,
  active,
  open,
  onClick,
  icon,
  last,
}: {
  label: string;
  value: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-paper ${
        last && !open ? "" : "border-b border-line"
      } ${open ? "bg-paper" : "bg-card"}`}
    >
      <span className="grid w-5 shrink-0 place-items-center text-base">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className={`text-sm ${active ? "font-semibold text-sun-deep" : "text-ink-faint"}`}>
        {value}
      </span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        className={`text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
      >
        <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
