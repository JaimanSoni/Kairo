"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { addDays, friendlyDay, fmtMinutes, fmtReminder } from "@/lib/dates";
import { repeatLabel } from "@/lib/repeat";
import { useApp } from "./store";
import { playComplete } from "@/lib/sound";
import { useStepToggle } from "./step-row";
import { Icon3d, ListMark } from "./img3d";
import { Chip, IconCheck, IconDots, IconStar } from "./ui";

export function TaskItem({
  task,
  context,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  dropIndicator,
}: {
  task: Task;
  /** where this row is rendered — controls which chips/actions show */
  context: "today" | "upcoming" | "backlog" | "log";
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  dropIndicator?: "above" | "below" | null;
}) {
  const { state, completeTask, uncompleteTask, updateTask, deleteTask, setEditing, showToast, startFocus } = useApp();
  const toggleStep = useStepToggle();
  const [checking, setChecking] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const done = task.status === "done";
  const list = task.listId ? state.lists.find((l) => l.id === task.listId) : null;
  const today = state.today;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const toggle = () => {
    if (done) {
      uncompleteTask(task.id);
      return;
    }
    setChecking(true);
    playComplete();
    // let the check animation land before the row moves to Done
    setTimeout(() => {
      completeTask(task.id);
      setChecking(false);
    }, 350);
  };

  const subDone = task.subtasks.filter((s) => s.done).length;
  const dueSoon =
    task.dueDate && !done && task.dueDate <= addDays(today, 2);

  const plan = (patch: Partial<Task>) => {
    updateTask(task.id, patch);
    setMenuOpen(false);
  };

  return (
    <div
      className={`group relative select-none rounded-xl border bg-card px-3.5 py-3 transition-[transform,box-shadow] duration-150 hover:shadow-sm ${
        checking ? "anim-out" : ""
      } ${task.spotlight && !done ? "border-sun/60" : "border-line"}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-3">
      {dropIndicator && (
        <div
          className={`absolute inset-x-2 h-0.5 rounded bg-sun ${
            dropIndicator === "above" ? "-top-[5px]" : "-bottom-[5px]"
          }`}
        />
      )}

      <button
        onClick={toggle}
        aria-label={done ? "Mark as not done" : "Mark as done"}
        className={`grid size-[22px] shrink-0 place-items-center rounded-full border-2 transition-colors ${
          done || checking
            ? "anim-check border-moss bg-moss text-on-accent"
            : "border-ink-faint text-transparent hover:border-moss hover:text-moss/40"
        }`}
      >
        <IconCheck size={12} />
      </button>

      <button
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
        onClick={() => setEditing(task.id)}
      >
        <span className={`w-full truncate text-[15px] leading-snug ${done ? "strike-done" : ""}`}>
          {task.title}
        </span>
        {(list || task.estimateMin || task.dueDate || task.repeat || task.reminderAt || task.carryCount >= 2 || task.subtasks.length > 0 || task.note) && (
          <span className="flex flex-wrap items-center gap-1.5">
            {list && (
              <Chip>
                <ListMark value={list.emoji} size={13} /> {list.name}
              </Chip>
            )}
            {task.estimateMin != null && <Chip>~{fmtMinutes(task.estimateMin)}</Chip>}
            {task.dueDate && !done && (
              <Chip tone={dueSoon ? "clay" : "neutral"} title="A real deadline">
                due {friendlyDay(task.dueDate, today)}
              </Chip>
            )}
            {task.repeat && !done && (
              <Chip tone="sky" title="Repeats — completing it advances to the next date">
                ↻ {repeatLabel(task.repeat)}
              </Chip>
            )}
            {task.reminderAt && !done && (
              <Chip title="You'll get a push notification">
                🔔 {fmtReminder(task.reminderAt, today)}
              </Chip>
            )}
            {task.subtasks.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                title={stepsOpen ? "Hide steps" : "Show steps"}
                onClick={(e) => {
                  e.stopPropagation();
                  setStepsOpen((v) => !v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setStepsOpen((v) => !v);
                  }
                }}
                className="cursor-pointer"
              >
                <Chip tone={subDone === task.subtasks.length ? "moss" : "neutral"}>
                  {subDone}/{task.subtasks.length} {stepsOpen ? "▾" : "▸"}
                </Chip>
              </span>
            )}
            {task.carryCount >= 2 && !done && (
              <Chip tone="lilac" title="Carried over — maybe break it down, or let it go?">
                ↻ ×{task.carryCount}
              </Chip>
            )}
            {task.note && <span className="text-[11px] text-ink-faint">≡</span>}
          </span>
        )}
      </button>

      {!done && context !== "log" && task.estimateMin != null && (
        <button
          onClick={() => startFocus(task.id)}
          aria-label="Start focus timer"
          title={`Focus for ~${fmtMinutes(task.estimateMin)}`}
          className="grid size-7 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-sun-soft hover:text-sun-deep"
        >
          <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 1.8v8.4a.6.6 0 00.92.5l6.3-4.2a.6.6 0 000-1L3.92 1.3a.6.6 0 00-.92.5z" />
          </svg>
        </button>
      )}

      {!done && context !== "log" && (
        <button
          onClick={() => {
            if (!task.spotlight) {
              const count = Object.values(state.tasks).filter(
                (t) => t.spotlight && t.status !== "done"
              ).length;
              if (count >= 3) {
                showToast({ message: "Spotlight holds 3 — that's the point ✦" });
                return;
              }
            }
            updateTask(task.id, { spotlight: !task.spotlight });
          }}
          aria-label="Toggle spotlight"
          title="Spotlight — one of today's must-wins"
          className={`shrink-0 transition-opacity ${
            task.spotlight
              ? "text-sun"
              : "text-ink-faint opacity-0 hover:text-sun group-hover:opacity-100 pointer-coarse:opacity-100 max-md:opacity-100"
          }`}
        >
          <IconStar size={16} filled={task.spotlight} />
        </button>
      )}

      {context !== "log" && (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Task actions"
            className={`rounded-md p-1 text-ink-faint transition-opacity hover:bg-paper-deep hover:text-ink ${
              menuOpen ? "" : "opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 max-md:opacity-100"
            }`}
          >
            <IconDots size={16} />
          </button>
          {menuOpen && (
            <div className="anim-pop absolute right-0 top-8 z-30 w-44 rounded-xl border border-line bg-card p-1.5 shadow-lg">
              {!done && task.plannedFor !== today && (
                <MenuBtn onClick={() => plan({ plannedFor: today, status: "planned" })}>
                  ☀️ Do today
                </MenuBtn>
              )}
              {!done && task.plannedFor !== addDays(today, 1) && (
                <MenuBtn onClick={() => plan({ plannedFor: addDays(today, 1), status: "planned" })}>
                  🌤️ Tomorrow
                </MenuBtn>
              )}
              {!done && (task.plannedFor || task.status !== "inbox") && (
                <MenuBtn onClick={() => plan({ plannedFor: null, status: "inbox", spotlight: false })}>
                  <Icon3d name="inbox" size={15} /> Back to inbox
                </MenuBtn>
              )}
              {!done && task.status !== "someday" && (
                <MenuBtn onClick={() => plan({ plannedFor: null, status: "someday", spotlight: false })}>
                  <Icon3d name="moon" size={15} /> Someday
                </MenuBtn>
              )}
              <MenuBtn onClick={() => { setMenuOpen(false); setEditing(task.id); }}>
                ✏️ Edit details
              </MenuBtn>
              <div className="my-1 border-t border-line" />
              <MenuBtn onClick={() => { setMenuOpen(false); deleteTask(task.id); }}>
                🍃 Let it go
              </MenuBtn>
            </div>
          )}
        </div>
      )}
      </div>

      {/* inline checklist — check steps off without opening the editor */}
      {stepsOpen && task.subtasks.length > 0 && (
        <div className="anim-rise mt-2.5 space-y-1.5 border-t border-line/70 pt-2.5 pl-8">
          {task.subtasks.map((s) => (
            <div key={s.id} className="flex items-center gap-2.5">
              <button
                onClick={() => toggleStep(task.id, s.id)}
                aria-label={s.done ? "Mark step as not done" : "Mark step as done"}
                className={`grid size-[17px] shrink-0 place-items-center rounded-full border-2 transition-colors ${
                  s.done
                    ? "border-moss bg-moss text-on-accent"
                    : "border-ink-faint text-transparent hover:border-moss"
                }`}
              >
                <IconCheck size={9} />
              </button>
              <span className={`min-w-0 flex-1 truncate text-[13px] ${s.done ? "text-ink-faint line-through" : "text-ink-soft"}`}>
                {s.title}
              </span>
              {s.plannedFor && !s.done && (
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] ${
                    s.plannedFor < today ? "bg-paper-deep text-ink-soft" : "bg-sun-soft text-sun-deep"
                  }`}
                >
                  {friendlyDay(s.plannedFor, today)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-paper-deep"
    >
      {children}
    </button>
  );
}
