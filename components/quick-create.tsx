"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { addDays, friendlyDay, fmtMinutes, fmtTime12 } from "@/lib/dates";
import { parseQuickAdd } from "@/lib/nlp";
import { useApp } from "./store";
import { navigateApp } from "./app-views";
import { useNoteActions } from "./notes/actions";
import { DatePicker } from "./date-picker";
import { IconPlus, Modal } from "./ui";

/**
 * The plus in the corner: one place, on every screen, to make something new.
 * A tap fans out the two things Kairo makes, a task or a note, and each has a
 * flow of its own that asks for a title and nothing else it doesn't need.
 *
 *   - A task: say what it is, pick when (Today is already picked), done. A day
 *     or a time typed into the title ("call mum tomorrow 6pm") is understood
 *     as it's typed, the same way the capture bar does it.
 *   - A note: give it a title, or don't, and start writing on its page.
 */

type When = "today" | "tomorrow" | "date" | "someday";

export function QuickCreate() {
  const { state } = useApp();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [flow, setFlow] = useState<null | "task" | "note">(null);

  // Escape folds the fan away
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // a page being written has the whole screen: the plus waits outside it
  const writing = /^\/(notes|journal)\/[^/]+/.test(pathname) || pathname.startsWith("/settings");
  if (state.appLocked || writing) return flow ? <Flows flow={flow} onClose={() => setFlow(null)} /> : null;

  const pick = (f: "task" | "note") => {
    setOpen(false);
    // notes belong to an account, and can be turned off: their own page says so better than a dead button
    if (f === "note" && (state.user.guest || !state.user.spaces.notes)) {
      navigateApp("/notes");
      return;
    }
    setFlow(f);
  };

  return (
    <>
      {open && <button type="button" aria-hidden tabIndex={-1} className="qc-float fixed inset-0 z-[44] cursor-default bg-ink/10 backdrop-blur-[1px]" onClick={() => setOpen(false)} />}
      <div className="qc-float fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-[45] flex flex-col items-end gap-2 md:bottom-5 md:right-5" data-quick-create>
        {open && (
          <>
            <FanItem label="Note" delay={40} onClick={() => pick("note")} id="note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5z" />
                <path d="M14 3.5V8h4M9 12.5h6M9 16h4" />
              </svg>
            </FanItem>
            <FanItem label="Task" delay={0} onClick={() => pick("task")} id="task">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
              </svg>
            </FanItem>
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close" : "New task or note"}
          data-quick-create-button
          className="grid size-12 place-items-center rounded-2xl bg-ink text-paper shadow-lg shadow-ink/25 transition-transform hover:-translate-y-0.5 active:scale-95"
        >
          <span className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`}>
            <IconPlus size={19} />
          </span>
        </button>
      </div>
      {flow && <Flows flow={flow} onClose={() => setFlow(null)} />}
    </>
  );
}

function FanItem({ label, delay, onClick, id, children }: { label: string; delay: number; onClick: () => void; id: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} data-quick-create-option={id} className="qc-item flex items-center gap-2.5 rounded-2xl bg-card py-1.5 pl-3.5 pr-1.5 shadow-lg shadow-ink/15 ring-1 ring-line transition-transform hover:-translate-y-0.5" style={{ animationDelay: `${delay}ms` }}>
      <span className="text-sm font-semibold">{label}</span>
      <span className="grid size-8 place-items-center rounded-xl bg-sun-soft text-sun-deep">{children}</span>
    </button>
  );
}

function Flows({ flow, onClose }: { flow: "task" | "note"; onClose: () => void }) {
  return flow === "task" ? <NewTask onClose={onClose} /> : <NewNote onClose={onClose} />;
}

/* -------------------------------------------------------------------- task */

function NewTask({ onClose }: { onClose: () => void }) {
  const { state, addTask, setEditing, showToast } = useApp();
  const today = state.today;
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<When>("today");
  const [date, setDate] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // a day or a time typed into the title is understood, and wins over the row below
  const parsed = title.trim() ? parseQuickAdd(title, state.lists) : null;
  const typedDay = parsed?.plannedFor ?? null;
  const understood = parsed
    ? [
        parsed.plannedFor ? friendlyDay(parsed.plannedFor, today) : null,
        parsed.plannedTime ? fmtTime12(parsed.plannedTime) : null,
        parsed.repeat ? "repeats" : null,
        parsed.estimateMin ? `~${fmtMinutes(parsed.estimateMin)}` : null,
        parsed.dueDate ? `due ${friendlyDay(parsed.dueDate, today)}` : null,
        parsed.listName ? parsed.listName : null,
      ].filter((x): x is string => Boolean(x))
    : [];
  const cleanTitle = (parsed?.title || title).trim();

  const plannedFor = typedDay ?? (when === "today" ? today : when === "tomorrow" ? addDays(today, 1) : when === "date" ? date : null);
  const says = typedDay
    ? `Goes on ${friendlyDay(typedDay, today).toLowerCase()}'s plan${parsed?.plannedTime ? ` at ${fmtTime12(parsed.plannedTime)}` : ""}.`
    : when === "today"
      ? "Goes on today's plan."
      : when === "tomorrow"
        ? "Goes on tomorrow's plan."
        : when === "someday"
          ? "Parked in Someday. No date, no pressure."
          : date
            ? `Goes on ${friendlyDay(date, today)}.`
            : "Pick a day.";

  const create = async (thenEdit: boolean) => {
    if (!cleanTitle || busy) return;
    setBusy(true);
    const id = await addTask(
      {
        title: cleanTitle,
        plannedFor,
        plannedTime: parsed?.plannedTime ?? null,
        dueDate: parsed?.dueDate ?? null,
        estimateMin: parsed?.estimateMin ?? null,
        listId: parsed?.listId ?? null,
        listName: parsed?.listName ?? null,
        spotlight: parsed?.spotlight ?? false,
        repeat: parsed?.repeat ?? null,
      },
      when === "someday" && !typedDay ? { status: "someday" } : undefined
    );
    setBusy(false);
    if (!id) return; // the guest cap says its own piece
    onClose();
    if (thenEdit) setEditing(id);
    else showToast({ message: plannedFor === today ? "Added to today." : plannedFor ? `Added for ${friendlyDay(plannedFor, today)}.` : when === "someday" ? "Parked in Someday." : "Added to your Inbox." });
  };

  return (
    <Modal onClose={onClose} anchor="top">
      <div className="p-6 sm:p-7" data-new-task>
        <h2 className="font-display text-2xl leading-tight">New task</h2>
        <input
          ref={input}
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void create(false)}
          placeholder="What needs doing?"
          aria-label="Task title"
          className="mt-4 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none placeholder:text-ink-faint focus:border-sun"
        />
        <div className="mt-1.5 flex min-h-6 flex-wrap items-center gap-1.5 px-1 text-xs text-ink-faint">
          {understood.length > 0 ? (
            understood.map((u) => (
              <span key={u} className="rounded-full bg-sun-soft px-2 py-0.5 font-medium text-sun-deep">
                {u}
              </span>
            ))
          ) : (
            <span>Tip: type the day or time too, like “tomorrow 6pm”.</span>
          )}
        </div>

        {!typedDay && (
          <div role="radiogroup" aria-label="When will you do it?" className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-paper-deep p-1">
            {(
              [
                ["today", "Today"],
                ["tomorrow", "Tomorrow"],
                ["date", date ? friendlyDay(date, today) : "Pick a date"],
                ["someday", "Someday"],
              ] as [When, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={when === value}
                data-new-task-when={value}
                onClick={() => {
                  setWhen(value);
                  setPicking(value === "date");
                }}
                className={`h-9 min-w-0 truncate rounded-xl px-1 text-[13px] transition-colors ${when === value ? "bg-card font-semibold text-ink shadow-sm" : "font-medium text-ink-soft hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {picking && !typedDay && (
          <div className="anim-rise mt-3">
            <DatePicker
              value={date}
              today={today}
              allowClear={false}
              quickPicks={[]}
              onChange={(d) => {
                setDate(d);
                setPicking(false);
              }}
            />
          </div>
        )}
        <p className="mt-2.5 px-1 text-[13px] text-ink-soft" data-new-task-says>
          {says}
        </p>

        <div className="mt-6 flex items-center justify-between gap-2">
          <button onClick={() => void create(true)} disabled={!cleanTitle || busy} className="rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep disabled:opacity-40" data-new-task-details>
            Add details
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
              Cancel
            </button>
            <button onClick={() => void create(false)} disabled={!cleanTitle || busy || (when === "date" && !date && !typedDay)} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-40" data-new-task-add>
              Add task
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------- note */

function NewNote({ onClose }: { onClose: () => void }) {
  const actions = useNoteActions();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    const page = await actions.create({ title: title.trim(), open: true });
    setBusy(false);
    if (page) onClose();
  };

  return (
    <Modal onClose={onClose} anchor="top">
      <div className="p-6 sm:p-7" data-new-note>
        <h2 className="font-display text-2xl leading-tight">New note</h2>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void create()}
          placeholder="Give it a title"
          aria-label="Note title"
          className="mt-4 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none placeholder:text-ink-faint focus:border-sun"
        />
        <p className="mt-2.5 px-1 text-[13px] text-ink-soft">It opens as a blank page, ready to write on. A title can wait.</p>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Cancel
          </button>
          <button onClick={() => void create()} disabled={busy} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-40" data-new-note-create>
            {busy ? "Making it…" : title.trim() ? "Create note" : "Start writing"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
