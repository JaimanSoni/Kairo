"use client";

import { useState } from "react";
import type { Subtask, Task } from "@/lib/types";
import { friendlyDay, fmtMinutes } from "@/lib/dates";
import { useApp, visibleLists } from "./store";
import { Icon3d, ListMark } from "./img3d";
import { DatePicker } from "./date-picker";
import { DurationWheel } from "./wheel";
import { IconCheck, IconPlus, IconTrash, IconX, Modal } from "./ui";

type Section = "day" | "deadline" | "estimate" | "list" | null;

export function TaskEditor({ task }: { task: Task }) {
  const { state, updateTask, deleteTask, setEditing, startFocus } = useApp();
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note);
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks);
  const [newSub, setNewSub] = useState("");
  const [open, setOpen] = useState<Section>(null);
  const today = state.today;
  const list = task.listId ? state.lists.find((l) => l.id === task.listId) : null;

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
        ? friendlyDay(task.plannedFor, today)
        : "No day";

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
                    s.done ? "border-moss bg-moss text-white" : "border-ink-faint text-transparent"
                  }`}
                >
                  <IconCheck size={10} />
                </button>
                <span className={`flex-1 text-sm ${s.done ? "text-ink-faint line-through" : ""}`}>
                  {s.title}
                </span>
                <button
                  onClick={() => setSubtasks((subs) => subs.filter((x) => x.id !== s.id))}
                  className="text-ink-faint opacity-0 hover:text-clay group-hover:opacity-100"
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
            icon="☀️"
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
              <button
                onClick={() =>
                  updateTask(task.id, { plannedFor: null, status: "someday", spotlight: false })
                }
                className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  task.status === "someday"
                    ? "border-sun bg-sun-soft text-sun-deep"
                    : "border-line bg-card text-ink-soft hover:border-ink-faint"
                }`}
              >
                <Icon3d name="moon" size={14} /> Someday — park it, guilt-free
              </button>
            </div>
          )}

          <PropRow
            label="Estimate"
            value={task.estimateMin ? `~${fmtMinutes(task.estimateMin)}` : "None"}
            active={Boolean(task.estimateMin)}
            open={open === "estimate"}
            onClick={() => toggleSection("estimate")}
            icon="⏱️"
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
            icon="🚩"
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
            label="List"
            value={list ? list.name : "None"}
            active={Boolean(list)}
            open={open === "list"}
            onClick={() => toggleSection("list")}
            icon={list ? <ListMark value={list.emoji} size={18} /> : <Icon3d name="list-folder" size={18} />}
            last
          />
          {open === "list" && (
            <div className="anim-rise bg-paper px-4 py-4">
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
            <IconTrash size={14} /> Let it go
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
