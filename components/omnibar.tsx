"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { friendlyDay, fmtMinutes, fmtTime12 } from "@/lib/dates";
import { repeatLabel, type Repeat } from "@/lib/repeat";
import { guestCapReached, hiddenListIds, useApp, visibleLists } from "./store";
import { commandDone, commandSentence, matchTasks, parseCommand, pickOne, type Action } from "@/lib/commands";

import { track } from "@/lib/analytics-client";
import { micAlreadyAllowed, useDictation } from "./dictation/use-dictation";
import { DictationLine } from "./dictation/dictation-line";
import { Orb } from "./dictation/orb";
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
type Phase = "input" | "thinking" | "done" | "choose" | "failed";

export function Omnibar() {
  const { state, addTask, updateTask, completeTask, uncompleteTask, deleteTask, startFocus, setOmnibar, showToast } = useApp();
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
  /** Why the last capture produced nothing, when it produced nothing. */
  const [trouble, setTrouble] = useState<"unreachable" | "nothing" | null>(null);
  /** The words as they were said, kept so a failure can hand them straight back. */
  const [said, setSaid] = useState("");
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
  const orbRef = useRef<HTMLButtonElement>(null);

  const lists = useMemo(() => visibleLists(state), [state]);
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
      // Spoken captures go straight through. Reading your own words back and
      // pressing a button is the typing this replaced; if it comes out wrong
      // the preview is still a preview, and nothing is filed without it.
      if (activeMode === "task") queueMicrotask(() => submit(false, heard));
      else queueMicrotask(() => inputRef.current?.focus());
    },
    onInterim: setText,
    onTrouble: (message) => showToast({ message }),
  });
  const listening = dictation.phase === "listening";
  /**
   * Capture opens listening.
   *
   * Talking is the fastest way to get a thought out of your head, and asking
   * somebody to choose it every time is asking them to type. So the box opens
   * on the microphone and typing is the thing you switch to, not the thing
   * you start from -- and it switches the moment anyone touches a key.
   */
  const [typing, setTyping] = useState(false);
  const voice = activeMode === "task" && dictation.supported && !typing;

  /**
   * Start listening as the panel opens, but only where that cannot surprise
   * anyone: the microphone has to have been allowed already. The first time,
   * the orb waits to be tapped, because a permission prompt nobody asked for
   * is how permissions get denied forever.
   */
  useEffect(() => {
    if (activeMode !== "task") return;
    let dropped = false;
    void (async () => {
      const allowed = await micAlreadyAllowed();
      if (!dropped && allowed) dictation.toggle();
    })();
    return () => {
      dropped = true;
    };
    // this panel is mounted only while it is open, so mount is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
      // only the level: the element's own size lives in that attribute too
      (orbRef.current?.firstElementChild as HTMLElement | null)?.style.removeProperty("--heard");
      return;
    }
    const tick = window.setInterval(() => {
      const heard = dictation.level().toFixed(2);
      micRef.current?.style.setProperty("--heard", heard);
      // the orb reads it off its own element, so the whole panel never re-renders
      (orbRef.current?.firstElementChild as HTMLElement | null)?.style.setProperty("--heard", heard);
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

  const submit = (keepOpen: boolean, spoken?: string) => {
    if (phase !== "input") return;
    const raw = (spoken ?? text).trim();
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

    // Rapid entry (shift+enter) files straight through, without the preview,
    // and then stays open. It still goes through the same parse as everything
    // else: there is one thing in this app that turns talk into tasks, and a
    // faster, worse second one filing quietly behind it was never a kindness.
    setText("");
    lastRawRef.current = raw;
    setSaid(raw);
    runReveal(raw, keepOpen);
  };

  /**
   * Turn what was said into tasks, and show them.
   *
   * There is no second parser behind this one. When the parse cannot be had,
   * the capture says so and offers to try again, and it keeps every word the
   * person said so nothing is lost while they decide. Filing a worse guess
   * under the same button looked like the app understood when it had not,
   * and a plan built out of those is worse than no plan.
   */
  const runReveal = (raw: string, fileAtOnce = false) => {
    setPhase("thinking");
    setTrouble(null);
    const parsed = aiParse(raw);
    // must outlast the server's leash (15s) plus overhead, or the client
    // gives up on answers that were still coming
    const timeout = new Promise<AiOutcome | null>((r) => setTimeout(() => r(null), 20000));
    void (async () => {
      const started = Date.now();
      const outcome = await Promise.race([parsed, timeout]);
      const tasks = outcome?.tasks ?? null;
      setAiLeft(outcome?.left ?? null);
      setAiLimited(outcome?.limited ?? false);

      if (!tasks) {
        setTrouble("unreachable");
        setPhase("failed");
        return;
      }
      // Understood, and there was nothing in it to do. That is an answer, not
      // a failure: people think out loud, and most of a sentence is not a task.
      if (tasks.length === 0) {
        setTrouble("nothing");
        setPhase("failed");
        return;
      }

      const wait = Math.max(0, 450 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      setResult(tasks);
      // rapid entry: file them and stay open for the next thought
      if (fileAtOnce) {
        filingRef.current = true;
        for (const p of tasks) await createTaskFromAiPreset(p);
        filingRef.current = false;
        showToast({ message: tasks.length === 1 ? "Added." : `Added ${tasks.length} tasks.` });
        again();
        return;
      }
      setPhase("done");
    })();
  };

  /** Try the same words again. */
  const retryAi = () => {
    const raw = lastRawRef.current;
    if (!raw || filingRef.current) return;
    setResult(null);
    runReveal(raw);
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


  /** Back to a fresh input, same panel — for capturing the next one. */
  const again = () => {
    filingRef.current = false;
    setResult(null);
    setTrouble(null);
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

  const placeholder = listening ? "Listening…" : activeMode === "note" ? "Write a note" : activeMode === "journal" ? "A line for today's page" : "What's on your mind?";
  const hint =
    activeMode === "note"
      ? "Saves as a new page in Notes. The first line becomes its title."
      : activeMode === "journal"
        ? "Adds to today's journal page."
        : "Say it the way you'd say it: “pay rent friday 6pm”, or “move the quotation to monday”.";
  const count = result?.length ?? 0;

  return (
    <Modal onClose={() => setOmnibar(false)} anchor={voice ? "center" : "top"}>
      <div className="p-5 sm:p-6" data-capture>
        {phase === "input" && voice && (
          <div className="flex flex-col items-center py-4" data-capture-voice>
            <button
              onClick={dictation.toggle}
              disabled={dictation.phase === "thinking"}
              ref={orbRef}
              className="rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-sun active:scale-[0.98]"
              aria-label={listening ? "Stop listening" : "Start listening"}
              data-capture-orb
              data-orb-phase={dictation.phase}
            >
              <Orb state={listening ? "listening" : dictation.phase === "thinking" || dictation.phase === "fetching" ? "thinking" : "waiting"} />
            </button>

            <p className="mt-5 text-center text-[15px] font-medium text-ink" data-capture-voice-line>
              {listening
                ? "I'm listening. Take your time."
                : dictation.phase === "thinking"
                  ? "Writing that down…"
                  : dictation.phase === "fetching"
                    ? "Getting ready…"
                    : "Tap, and say what's on your mind"}
            </p>

            {dictation.progress && dictation.progress.total > 0 && (
              <div className="mt-3 w-full max-w-64">
                <DictationLine phase="fetching" progress={dictation.progress} onDevice={dictation.onDevice} />
              </div>
            )}

{/* the take is yours to start and yours to end; nothing else ends it */}
            <div className="mt-6 flex w-full items-center justify-between gap-2">
              {listening ? (
                <>
                  <button
                    onClick={dictation.cancel}
                    className="rounded-full px-3 py-2 text-[13px] font-semibold text-ink-soft hover:bg-paper-deep"
                    data-capture-voice-cancel
                  >
                    Cancel
                  </button>
                  <button
                    onClick={dictation.toggle}
                    className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper"
                    data-capture-done
                    autoFocus
                  >
                    <span className="block size-2.5 rounded-[3px] bg-paper" aria-hidden />
                    Done
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      dictation.cancel();
                      setTyping(true);
                      queueMicrotask(() => inputRef.current?.focus());
                    }}
                    className="rounded-full px-3 py-2 text-[13px] font-semibold text-ink-soft hover:bg-paper-deep"
                    data-capture-type-instead
                  >
                    Type it instead
                  </button>
                  <button
                    onClick={dictation.toggle}
                    disabled={dictation.phase !== "idle"}
                    className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-40"
                    data-capture-start
                  >
                    <MicIcon listening={false} />
                    Start
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {phase === "input" && !voice && (
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
                disabled={commanding ? false : !text.trim() || saving}
                title={commanding ? "Enter does it. Shift+Enter does it and keeps this open." : "Enter adds it. Shift+Enter adds it and keeps this open for the next one."}
                className="h-9 shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-paper transition-opacity disabled:opacity-25"
                data-capture-add
              >
                {commanding ? "Do it" : activeMode === "task" ? "Add" : "Save"}
              </button>
            </div>

            {/* one quiet line: how to use it, or what's been understood so far */}
            <div className="mt-2.5 flex min-h-6 flex-wrap items-center gap-1.5 px-1 text-[13px] text-ink-faint" data-capture-line>
              {dictation.phase !== "idle" ? (
                <DictationLine phase={dictation.phase} progress={dictation.progress} onDevice={dictation.onDevice} />
              ) : command && matches.length ? (
                <span className="text-ink-soft" data-capture-command>
                  {only ? commandSentence(command.action, only.title, state.today) : matches.length + " of your tasks could be that one"}
                </span>
              ) : (
                <span>{hint}</span>
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

        {/*
          Nothing was filed, and every word is still here.
          A capture that cannot be read is not a capture that gets guessed at:
          it is handed back intact, so the thought is never the thing that was
          lost. "Nothing to do in that" is an answer too -- people think out
          loud, and most of a sentence is not a task.
        */}
        {phase === "failed" && (
          <div className="anim-rise py-2" data-capture-failed={trouble ?? "unreachable"}>
            <p className="text-sm font-medium text-ink">
              {trouble === "nothing" ? "Nothing in that sounded like something to do." : "Couldn't read that just now."}
            </p>
            <p className="mt-1 text-[13px] leading-5 text-ink-soft">
              {trouble === "nothing"
                ? "Your words are still here, so you can add to them or say it another way."
                : "Nothing was added, and your words are still here."}
            </p>
            <p className="mt-3 rounded-xl bg-paper-deep px-3.5 py-2.5 text-sm leading-6 text-ink-soft" data-capture-failed-words>
              {said}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button onClick={retryAi} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper" data-capture-retry>
                Try again
              </button>
              <button
                onClick={() => {
                  setText(said);
                  setPhase("input");
                  queueMicrotask(() => inputRef.current?.focus());
                }}
                className="rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep"
                data-capture-failed-edit
              >
                Edit it
              </button>
            </div>
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
            {guest && (aiLimited || aiLeft != null) && (
              <p className="mt-2.5 px-1 text-[13px] text-ink-faint" data-capture-note>
                {aiLimited ? (
                  <>
                    Your 3 free AI captures are used.{" "}
                    <a href="/api/auth/google" data-track="guest-signin" className="font-semibold text-sun-deep hover:underline">
                      Sign in for unlimited
                    </a>
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
