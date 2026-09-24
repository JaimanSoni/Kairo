"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { parseQuickAdd, type ParsedInput } from "@/lib/nlp";
import { friendlyDay, fmtMinutes, fmtTime12 } from "@/lib/dates";
import { repeatLabel, type Repeat } from "@/lib/repeat";
import { guestCapReached, hiddenListIds, useApp, visibleLists } from "./store";
import { commandDone, commandSentence, matchTasks, parseCommand, pickOne, type Action } from "@/lib/commands";

import { track } from "@/lib/analytics-client";
import { useDictation } from "./dictation/use-dictation";
import { DictationLine } from "./dictation/dictation-line";
import { DictationOffer, useDictationOffer } from "./dictation/offer";
import { buildVocab } from "@/lib/dictation/polish";
import { IconX, Modal } from "./ui";
import { captureJournalLine, captureNote, type CaptureResult } from "./capture-targets";
import { navigateApp } from "./app-views";

/** What a capture becomes: a task (sorted by AI), a new note, or a line on today's journal page. */
export type CaptureMode = "task" | "note" | "journal";

/** The mode the next capture opens in, set by whatever opened it (search, a shortcut). */
let nextMode: CaptureMode = "task";
export function openCaptureAs(mode: CaptureMode, open: (v: boolean) => void) {
  nextMode = mode;
  open(true);
}


type AiParsed = {
  title: string;
  plannedFor: string | null;
  plannedTime: string | null;
  dueDate: string | null;
  estimateMin: number | null;
  listId: string | null;
  listName: string | null;
  spotlight: boolean;
  subtasks: string[];
  /** Never set by AI — carried over from the local parse ("every monday"). */
  repeat?: Repeat | null;
};

/**
 * Capture: one box for anything you want to say to Kairo. A thought comes
 * back as tasks to look over before anything is added; an instruction about
 * something you already have ("move the quotation to monday", "put the
 * invoice in work", "the bill is done") is carried out.
 *
 * Which of the two it is, is decided here and not by the AI: an instruction
 * has to open with a verb Kairo knows, and has to name a task it can find.
 * Anything else is a new task, exactly as before, so "buy milk tomorrow"
 * never becomes an order to move something. The line under the box says in
 * words which one it read, and which task it found, before you commit to it;
 * when two tasks could be meant it asks instead of guessing, and everything
 * it does comes back with Undo.
 *
 * The panel shows one thing at a time: the box (with a single quiet line
 * under it, saying how to use it or what's been understood so far), then a
 * moment of working it out, then the tasks in plain words with one button to
 * add them. No icons to decode, no hints competing for the eye. Back returns
 * to the box with what was typed; closing the panel adds nothing.
 *
 * Shift+Enter still adds straight away and keeps the box open, for getting a
 * run of thoughts down fast. Voice input via the Web Speech API where available.
 */
/** What the expanding lower section is showing. */
type Phase = "input" | "thinking" | "done" | "choose";

export function Omnibar() {
  const { state, addTask, getTask, updateTask, completeTask, uncompleteTask, deleteTask, startFocus, setOmnibar, showToast } = useApp();
  const [text, setText] = useState("");
  const guest = Boolean(state.user.guest);
  const modes: { id: CaptureMode; label: string }[] = [
    { id: "task", label: "Task" },
    ...(!guest && state.user.spaces.notes ? [{ id: "note" as const, label: "Note" }] : []),
    ...(!guest && state.user.spaces.journal ? [{ id: "journal" as const, label: "Journal" }] : []),
  ];
  const [mode, setMode] = useState<CaptureMode>(() => {
    const m = nextMode;
    nextMode = "task";
    return m;
  });
  const activeMode: CaptureMode = modes.some((m) => m.id === mode) ? mode : "task";
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<AiParsed[] | null>(null);
  // true when the preview is the local fallback, not an AI answer — the
  // difference must be visible, or a failed call looks like a bad parse
  const [aiFell, setAiFell] = useState(false);
  // guest bookkeeping, straight from the server's mouth: how many free AI
  // runs remain, and whether the well is dry (429)
  const [aiLeft, setAiLeft] = useState<number | null>(null);
  const [aiLimited, setAiLimited] = useState(false);
  const [filing, setFiling] = useState(false);
  // the real reentry guard: state commits a render late, and a double-click's
  // second click arrives inside that gap — a ref flips synchronously
  const filingRef = useRef(false);
  const lastRawRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);

  const lists = useMemo(() => visibleLists(state), [state]);
  const parsed = useMemo(() => parseQuickAdd(text, lists), [text, lists]);

  /* an instruction about something that already exists, and the task it means */
  const command = useMemo(() => (activeMode === "task" && text.trim() ? parseCommand(text, lists, state.today) : null), [activeMode, text, lists, state.today]);
  const reachable = useMemo(() => {
    // a task in a list that's locked right now isn't there to be named
    const hidden = hiddenListIds(state);
    return Object.values(state.tasks).filter((t) => !(t.listId && hidden.has(t.listId)));
  }, [state]);
  const matches = useMemo(() => (command ? matchTasks(command.target, reachable) : []), [command, reachable]);
  const only = useMemo(() => pickOne(matches), [matches]);
  const commanding = Boolean(command && matches.length);

  /**
   * The words this person uses, which no speech model has ever seen: what
   * their lists are called, what their habits are called, and the names that
   * turn up in their own tasks. It is the difference between "add paneer to
   * grocery's" and "add paneer to Groceries".
   */
  const vocab = useMemo(
    () =>
      buildVocab(
        lists.map((l) => l.name),
        [],
        Object.values(state.tasks)
          .slice(-300)
          .map((t) => t.title),
      ),
    [lists, state.tasks],
  );

  const dictation = useDictation({
    vocab,
    onHeard: ({ text: heard }) => {
      setText(heard);
      queueMicrotask(() => inputRef.current?.focus());
    },
    onInterim: setText,
    onTrouble: (message) => showToast({ message }),
  });
  const listening = dictation.phase === "listening";
  const [offered, setOffered] = useState(true);
  const offerDictation = useDictationOffer(dictation.lastEngine, dictation.onDevice) && offered;

  /**
   * The meter on the microphone, written straight to the element.
   *
   * It is one custom property on one button, set from a timer that only runs
   * while somebody is actually speaking. Going through state instead would
   * re-render the whole capture box fifteen times a second for a ring that
   * grows and shrinks.
   */
  useEffect(() => {
    if (!listening) {
      micRef.current?.style.removeProperty("--heard");
      return;
    }
    const tick = window.setInterval(() => {
      micRef.current?.style.setProperty("--heard", dictation.level().toFixed(2));
    }, 70);
    return () => window.clearInterval(tick);
  }, [listening, dictation]);

  /**
   * Ask the AI to parse raw text into structured tasks. Returns the parsed
   * results (no side effects on the store) plus, for guests, the server's
   * word on how many free runs remain. Falls back to local parse on any
   * failure — the caller decides what to file.
   */
  type AiOutcome = { tasks: AiParsed[]; left: number | null; limited: boolean };
  const aiParse = async (raw: string): Promise<AiOutcome> => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: raw,
          today: state.today,
          time,
          // a guest's lists exist only here, so they ride along for filing
          ...(state.user.guest ? { lists: lists.map((l) => ({ id: l.id, name: l.name })) } : {}),
        }),
      });
      if (res.status === 429) return { tasks: [], left: 0, limited: true };
      if (!res.ok) return { tasks: [], left: null, limited: false };
      const { parsed, guestRunsLeft } = (await res.json()) as {
        parsed?: AiParsed[];
        guestRunsLeft?: number;
      };
      return {
        tasks: Array.isArray(parsed) ? parsed : [],
        left: typeof guestRunsLeft === "number" ? guestRunsLeft : null,
        limited: false,
      };
    } catch {
      return { tasks: [], left: null, limited: false };
    }
  };

  /**
   * Carry out an instruction, and hand back the way out. Delete says its own
   * piece (it has always offered Undo); everything else is put back by
   * restoring the handful of fields it touched.
   */
  const applyCommand = (action: Action, task: Task, keepOpen: boolean) => {
    const before = { plannedFor: task.plannedFor, plannedTime: task.plannedTime, status: task.status, listId: task.listId, spotlight: task.spotlight, estimateMin: task.estimateMin, title: task.title };
    const undo = { label: "Undo", run: () => updateTask(task.id, before) };
    let toast: { message: string; action?: { label: string; run: () => void } } = { message: commandDone(action, task.title, state.today), action: undo };
    switch (action.kind) {
      case "move":
        updateTask(task.id, { plannedFor: action.date, status: action.date ? (task.status === "someday" || task.status === "inbox" ? "planned" : task.status) : "someday", ...(action.time ? { plannedTime: action.time } : {}) });
        break;
      case "list":
        updateTask(task.id, { listId: action.listId });
        break;
      case "done":
        completeTask(task.id);
        toast = { message: commandDone(action, task.title, state.today), action: { label: "Undo", run: () => uncompleteTask(task.id) } };
        break;
      case "delete":
        deleteTask(task.id); // says its own piece, with its own Undo
        toast = { message: "" };
        break;
      case "rename":
        updateTask(task.id, { title: action.title });
        break;
      case "star":
        updateTask(task.id, { spotlight: action.on });
        break;
      case "estimate":
        updateTask(task.id, { estimateMin: action.minutes });
        break;
      case "focus":
        startFocus(task.id, { minutes: task.estimateMin });
        toast = { message: commandDone(action, task.title, state.today) };
        break;
    }
    track("capture-command");
    if (toast.message) showToast(toast);
    setText("");
    if (keepOpen) {
      setPhase("input");
      queueMicrotask(() => inputRef.current?.focus());
    } else {
      setOmnibar(false);
    }
  };

  /** A note or a journal line: saved as typed, no AI, and said plainly where it went. */
  const saveElsewhere = async (raw: string, keepOpen: boolean) => {
    if (saving) return;
    setSaving(true);
    const r: CaptureResult = activeMode === "note" ? await captureNote(raw) : await captureJournalLine(raw, state.today, state.user.id);
    setSaving(false);
    const where = activeMode === "note" ? "Notes" : "today's journal page";
    if (r.ok) {
      track(activeMode === "note" ? "capture-note" : "capture-journal");
      setText("");
      showToast({ message: activeMode === "note" ? "Saved to Notes." : "Added to today's page.", action: { label: "Open", run: () => navigateApp(r.href) } });
      if (!keepOpen) setOmnibar(false);
      else queueMicrotask(() => inputRef.current?.focus());
      return;
    }
    if (r.kind === "draft") {
      showToast({
        message: "Today's page has writing not yet saved on this device. Add it there.",
        action: { label: "Open", run: () => { setOmnibar(false); navigateApp(`/journal/${state.today}`); } },
      });
    } else if (r.kind === "locked") {
      showToast({ message: "Your journal is locked. Unlock it to add to today's page." });
    } else {
      showToast({ message: r.kind === "offline" ? `You're offline, so that didn't reach ${where}.` : `Couldn't save that to ${where}.` });
    }
  };

  const submit = (keepOpen: boolean) => {
    if (phase !== "input") return;
    const raw = text.trim();
    if (!raw) return;
    if (activeMode !== "task") {
      void saveElsewhere(raw, keepOpen);
      return;
    }
    // an instruction about something that exists: do that, don't make a new one
    if (command && matches.length) {
      if (only) applyCommand(command.action, only, keepOpen);
      else setPhase("choose");
      return;
    }
    // the guest slate is bounded; the cap modal makes the case for signing in
    if (guestCapReached()) return;
    // separate names so the funnel can count guests who actually tried it
    track(state.user.guest ? "guest-capture" : "capture");

    // rapid entry (shift+enter): instant local-parse capture + bg AI refine
    if (keepOpen) {
      const local = parseQuickAdd(raw, lists);
      if (!local.title) local.title = raw;
      const idPromise = addTask(local);
      setText("");
      if (state.user.guest) {
        // rapid entry stays local for guests: burning a free AI run on a
        // background refine nobody watched would be a waste of the three
        showToast({ message: "Added." });
        return;
      }
      void aiParse(raw).then(async ({ tasks: parsed }) => {
        const id = await idPromise;
        if (!id) return;
        const current = getTask(id);
        if (!current || current.status === "done") return;
        if (parsed.length > 0) {
          const [first, ...extras] = parsed;
          applyAiToTask(first, current, id, local);
          for (const x of extras) await createTaskFromAiPreset(x);
        }
        showToast({
          message:
            parsed.length > 0 ? "Added." : "Added as you typed it.",
        });
      });
      return;
    }

    // full reveal: AI parses → show preview → user clicks Done to create.
    // Closing the panel before Done files NOTHING, by design: the preview is
    // a consent screen, and consent withheld means no writes.
    const local = parseQuickAdd(raw, lists);
    if (!local.title) local.title = raw;
    setText("");
    lastRawRef.current = raw;
    runReveal(raw, local);
  };

  /** The reveal pipeline, reusable so a failed AI call can be retried. */
  const runReveal = (raw: string, local: ParsedInput) => {
    setPhase("thinking");
    setAiFell(false);
    // guests get the real AI too — the server counts their 3 free runs
    const parsed = aiParse(raw);
    // must outlast the server's Ollama leash (15s) plus overhead, or the
    // client gives up on answers that were still coming
    const timeout = new Promise<AiOutcome | null>((r) =>
      setTimeout(() => r(null), 20000)
    );
    void (async () => {
      const started = Date.now();
      const outcome = await Promise.race([parsed, timeout]);
      let tasks: AiParsed[] | null = outcome?.tasks ?? null;
      // if AI returned nothing or timed out, fall back to local single-task
      // parse — and say so, because a silent fallback looks like a bad parse
      const fell = !tasks || tasks.length === 0;
      if (!tasks || tasks.length === 0) {
        tasks = [{
          title: local.title,
          plannedFor: local.plannedFor,
          plannedTime: local.plannedTime,
          dueDate: local.dueDate,
          estimateMin: local.estimateMin,
          listId: local.listId,
          listName: local.listName,
          spotlight: local.spotlight,
          subtasks: [],
        }];
      }
      // AI never sets repeats, so "every monday" would silently vanish here:
      // the local parse's rule rides on the first task it plainly belongs to
      if (local.repeat && !tasks[0].repeat) {
        tasks = [{ ...tasks[0], repeat: local.repeat }, ...tasks.slice(1)];
      }
      const wait = Math.max(0, 450 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      setAiLeft(outcome?.left ?? null);
      setAiLimited(outcome?.limited ?? false);
      setAiFell(fell);
      setResult(tasks);
      setPhase("done");
    })();
  };

  /** Re-run the AI on the same capture after a failed call. */
  const retryAi = () => {
    const raw = lastRawRef.current;
    if (!raw || filingRef.current) return;
    const local = parseQuickAdd(raw, lists);
    if (!local.title) local.title = raw;
    setResult(null);
    runReveal(raw, local);
  };

  /**
   * File every previewed task, exactly once. The guard matters: Done is a
   * money-shot button people double-click, and each extra click used to file
   * the whole preview again.
   */
  const fileAll = async () => {
    if (!result || filingRef.current) return;
    filingRef.current = true;
    setFiling(true);
    for (const p of result) {
      await createTaskFromAiPreset(p);
    }
    setOmnibar(false);
  };

  /** Files the preview, then stays open for the next thought. */
  const fileAndCaptureAnother = async () => {
    if (!result || filingRef.current) return;
    filingRef.current = true;
    setFiling(true);
    for (const p of result) {
      await createTaskFromAiPreset(p);
    }
    showToast({ message: result.length === 1 ? "Added." : `Added ${result.length} tasks.` });
    again();
  };

  /** Creates a single task from an AI parsed preset, steps and all, in one go. Returns its id. */
  const createTaskFromAiPreset = (p: AiParsed): Promise<string | null> => {
    return addTask(
      {
        title: p.title,
        plannedFor: p.plannedFor,
        plannedTime: p.plannedTime,
        dueDate: p.dueDate,
        estimateMin: p.estimateMin,
        listId: p.listId,
        listName: p.listName,
        spotlight: p.spotlight,
        repeat: p.repeat ?? null,
      },
      p.subtasks.length > 0 ? { subtasks: p.subtasks.map((t) => ({ id: crypto.randomUUID(), title: t, done: false })) } : undefined
    );
  };

  /** Apply AI parsed values to an already-created task (rapid-entry path). */
  const applyAiToTask = (ai: AiParsed, task: Task, id: string, local: ParsedInput) => {
    const patch: Partial<Task> = {};
    const untouched = <K extends keyof Task>(k: K, localVal: Task[K]) =>
      task[k] === localVal;

    if (ai.title && ai.title !== task.title && untouched("title", local.title)) {
      patch.title = ai.title;
    }
    if (ai.plannedFor && ai.plannedFor !== task.plannedFor && untouched("plannedFor", local.plannedFor)) {
      patch.plannedFor = ai.plannedFor;
      if (task.status === "inbox") patch.status = "planned";
    }
    if (
      ai.plannedTime &&
      ai.plannedTime !== task.plannedTime &&
      untouched("plannedTime", local.plannedTime) &&
      (patch.plannedFor || task.plannedFor)
    ) {
      patch.plannedTime = ai.plannedTime;
    }
    if (ai.dueDate && ai.dueDate !== task.dueDate && untouched("dueDate", local.dueDate)) {
      patch.dueDate = ai.dueDate;
    }
    if (ai.estimateMin && ai.estimateMin !== task.estimateMin && untouched("estimateMin", local.estimateMin)) {
      patch.estimateMin = ai.estimateMin;
    }
    if (ai.listId && ai.listId !== task.listId && untouched("listId", local.listId)) {
      patch.listId = ai.listId;
    }
    if (ai.spotlight && !task.spotlight && untouched("spotlight", local.spotlight)) {
      const spotCount = Object.values(state.tasks).filter(
        (t) => t.spotlight && t.status !== "done"
      ).length;
      if (spotCount < 3) patch.spotlight = true;
    }
    if (ai.subtasks.length > 0 && task.subtasks.length === 0) {
      patch.subtasks = ai.subtasks.map((t) => ({
        id: crypto.randomUUID(),
        title: t,
        done: false,
      }));
    }
    if (Object.keys(patch).length > 0) updateTask(id, patch);
  };

  /** Back to a fresh input, same panel — for capturing the next one. */
  const again = () => {
    filingRef.current = false;
    setResult(null);
    setAiFell(false);
    setAiLeft(null);
    setAiLimited(false);
    setFiling(false);
    setPhase("input");
    queueMicrotask(() => inputRef.current?.focus());
  };

  /** Back to the box with what was typed, to fix it and try again. Files nothing. */
  const backToEdit = () => {
    const raw = lastRawRef.current;
    again();
    setText(raw);
  };

  /** A task in the preview, in words: "Tomorrow · 6 PM · 30m · Work · 3 steps". */
  const detailsOf = (p: AiParsed): string =>
    [
      p.plannedFor ? friendlyDay(p.plannedFor, state.today) : "Inbox",
      p.plannedTime ? fmtTime12(p.plannedTime) : null,
      p.dueDate ? `due ${friendlyDay(p.dueDate, state.today)}` : null,
      p.estimateMin != null ? fmtMinutes(p.estimateMin) : null,
      p.listId ? (lists.find((l) => l.id === p.listId)?.name ?? null) : null,
      p.repeat ? `repeats ${repeatLabel(p.repeat)}` : null,
      p.spotlight ? "spotlight" : null,
      p.subtasks.length > 0 ? `${p.subtasks.length} ${p.subtasks.length === 1 ? "step" : "steps"}` : null,
    ]
      .filter((x): x is string => Boolean(x))
      .join(" · ");

  /** What's been understood so far, as it's typed. */
  const understood = [
    parsed.plannedFor ? friendlyDay(parsed.plannedFor, state.today) : null,
    parsed.plannedTime ? fmtTime12(parsed.plannedTime) : null,
    parsed.dueDate ? `due ${friendlyDay(parsed.dueDate, state.today)}` : null,
    parsed.estimateMin != null ? fmtMinutes(parsed.estimateMin) : null,
    parsed.listName,
    parsed.repeat ? `repeats ${repeatLabel(parsed.repeat)}` : null,
    parsed.spotlight ? "spotlight" : null,
  ].filter((x): x is string => Boolean(x));

  const placeholder = listening ? "Listening…" : activeMode === "note" ? "Write a note" : activeMode === "journal" ? "A line for today's page" : "What's on your mind?";
  const hint =
    activeMode === "note"
      ? "Saves as a new page in Notes. The first line becomes its title."
      : activeMode === "journal"
        ? "Adds to today's journal page."
        : "Say it the way you'd say it: “pay rent friday 6pm”, or “move the quotation to monday”.";
  const count = result?.length ?? 0;

  return (
    <Modal onClose={() => setOmnibar(false)} anchor="top">
      <div className="p-5 sm:p-6" data-capture>
        {phase === "input" && (
          <>
            {/* what this becomes: a task unless you say otherwise */}
            {modes.length > 1 && (
              <div role="tablist" aria-label="Capture as" className="mb-4 inline-grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-paper-deep p-1" data-capture-modes>
                {modes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={activeMode === m.id}
                    onClick={() => {
                      setMode(m.id);
                      inputRef.current?.focus();
                    }}
                    className={`h-8 rounded-lg px-4 text-[13px] transition-colors ${activeMode === m.id ? "bg-card font-semibold text-ink shadow-sm" : "font-medium text-ink-soft hover:text-ink"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 rounded-2xl border border-line bg-paper py-1.5 pl-4 pr-1.5 focus-within:border-sun">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  // the Enter that commits an IME candidate must not also submit
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(e.shiftKey);
                }}
                placeholder={placeholder}
                aria-label={activeMode === "note" ? "New note" : activeMode === "journal" ? "A line for today's journal page" : "What's on your mind"}
                className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-ink-faint"
                autoFocus
                enterKeyHint="done"
              />
              {dictation.supported && (
                <button
                  ref={micRef}
                  onClick={dictation.toggle}
                  disabled={dictation.phase === "thinking" || dictation.phase === "fetching"}
                  aria-label={listening ? "Stop listening" : "Speak instead of typing"}
                  title={listening ? "Stop listening" : "Speak instead of typing"}
                  className={`grid size-9 shrink-0 place-items-center rounded-xl transition-colors disabled:opacity-60 ${
                    listening ? "bg-clay text-on-accent shadow-[0_0_0_calc(var(--heard,0)*10px)_rgba(203,109,81,0.22)]" : "text-ink-faint hover:bg-paper-deep hover:text-ink"
                  }`}
                  data-capture-mic
                  data-dictation-phase={dictation.phase}
                >
                  <MicIcon listening={listening} />
                </button>
              )}
              <button
                onClick={() => submit(false)}
                disabled={commanding ? false : activeMode === "task" ? !parsed.title : !text.trim() || saving}
                title={commanding ? "Enter does it. Shift+Enter does it and keeps this open." : "Enter adds it. Shift+Enter adds it and keeps this open for the next one."}
                className="h-9 shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-paper transition-opacity disabled:opacity-25"
                data-capture-add
              >
                {commanding ? "Do it" : activeMode === "task" ? "Add" : "Save"}
              </button>
            </div>

            {offerDictation && (
              <DictationOffer
                onYes={() => {
                  setOffered(false);
                  dictation.useOnDevice(true);
                  showToast({ message: "Dictation moves to this device on your next tap" });
                }}
                onNo={() => setOffered(false)}
              />
            )}

            {/* one quiet line: how to use it, or what's been understood so far */}
            <div className="mt-2.5 flex min-h-6 flex-wrap items-center gap-1.5 px-1 text-[13px] text-ink-faint" data-capture-line>
              {dictation.phase !== "idle" ? (
                <DictationLine phase={dictation.phase} progress={dictation.progress} onDevice={dictation.onDevice} />
              ) : command && matches.length ? (
                <span className="text-ink-soft" data-capture-command>
                  {only ? commandSentence(command.action, only.title, state.today) : matches.length + " of your tasks could be that one"}
                </span>
              ) : activeMode !== "task" || !text.trim() ? (
                <span>{hint}</span>
              ) : (
                understood.map((u) => (
                  <span key={u} className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-medium text-sun-deep">
                    {u}
                  </span>
                ))
              )}
            </div>
          </>
        )}

        {phase === "choose" && command && (
          <div className="anim-rise" data-capture-choose>
            <h2 className="font-display text-xl leading-tight">Which one did you mean?</h2>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {matches.map(({ task: t }) => (
                <li key={t.id}>
                  <button onClick={() => applyCommand(command.action, t, false)} className="flex w-full items-center gap-3 bg-card px-4 py-3 text-left hover:bg-paper-deep" data-capture-choice>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium leading-snug">{t.title}</span>
                      <span className="mt-0.5 block text-[13px] text-ink-soft">{t.plannedFor ? friendlyDay(t.plannedFor, state.today) : "Inbox"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center justify-between gap-1">
              <button onClick={() => setPhase("input")} className="-ml-2 rounded-full px-2.5 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep" data-capture-choose-back>
                Back
              </button>
              <span className="text-[13px] text-ink-faint">{commandSentence(command.action, "…", state.today).replace("“…”", "the one you pick")}</span>
            </div>
          </div>
        )}

        {phase === "thinking" && (
          <div className="flex items-center gap-3 py-6" role="status" data-capture-thinking>
            <span className="cap-dots flex gap-1" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            <span className="text-sm text-ink-soft">Working out the details…</span>
          </div>
        )}

        {phase === "done" && result && (
          <div className="anim-rise" data-capture-preview>
            <h2 className="font-display text-xl leading-tight">{count === 1 ? "Here's your task" : `That's ${count} tasks`}</h2>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {result.map((p, i) => (
                <li key={`${p.title}-${i}`} className="flex items-center gap-3 bg-card px-4 py-3" data-capture-task>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium leading-snug">{p.title}</span>
                    <span className="mt-0.5 block text-[13px] text-ink-soft">{detailsOf(p)}</span>
                  </span>
                  {count > 1 && (
                    <button
                      onClick={() => setResult((r) => (r ? r.filter((_, j) => j !== i) : r))}
                      disabled={filing}
                      aria-label={`Leave out ${p.title}`}
                      title="Leave this one out"
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-paper-deep hover:text-ink"
                    >
                      <IconX size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* at most one footnote, and only when something needs saying */}
            {(aiFell || (guest && (aiLimited || aiLeft != null))) && (
              <p className="mt-2.5 px-1 text-[13px] text-ink-faint" data-capture-note>
                {guest && aiLimited ? (
                  <>
                    Your 3 free AI captures are used, so this is as you typed it.{" "}
                    <a href="/api/auth/google" data-track="guest-signin" className="font-semibold text-sun-deep hover:underline">
                      Sign in for unlimited
                    </a>
                  </>
                ) : aiFell ? (
                  <>
                    AI couldn&apos;t be reached, so this is as you typed it.{" "}
                    <button onClick={retryAi} className="font-semibold text-sun-deep hover:underline">
                      Try again
                    </button>
                  </>
                ) : (
                  <>
                    {aiLeft === 0 ? "That was your last free AI capture." : `${aiLeft} free AI ${aiLeft === 1 ? "capture" : "captures"} left.`}{" "}
                    <a href="/api/auth/google" data-track="guest-signin" className="font-semibold text-sun-deep hover:underline">
                      Sign in for unlimited
                    </a>
                  </>
                )}
              </p>
            )}

            <div className="mt-5 flex items-center justify-between gap-1 whitespace-nowrap">
              <button onClick={backToEdit} disabled={filing} className="-ml-2 rounded-full px-2.5 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep disabled:opacity-50" data-capture-back>
                Back
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => void fileAndCaptureAnother()} disabled={filing || count === 0} className="rounded-full px-2.5 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep disabled:opacity-50" data-capture-add-another>
                  Add &amp; <span className="hidden sm:inline">write </span>another
                </button>
                <button onClick={() => void fileAll()} autoFocus disabled={filing || count === 0} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50 sm:px-5" data-capture-confirm>
                  {filing ? "Adding…" : count === 1 ? "Add task" : `Add ${count} tasks`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      {listening ? (
        <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" fill="currentColor" />
      ) : (
        <>
          <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 8a5 5 0 0010 0M8 13v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
