"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { parseQuickAdd, type ParsedInput } from "@/lib/nlp";
import { friendlyDay, fmtMinutes, fmtTime12 } from "@/lib/dates";
import { repeatLabel, type Repeat } from "@/lib/repeat";
import { guestCapReached, useApp, visibleLists } from "./store";
import { track } from "@/lib/analytics-client";
import { getSpeechRecognition, type SpeechRec } from "@/lib/speech";
import { Icon3d } from "./img3d";
import { Chip, IconJournal, IconNotes, Kbd, Modal } from "./ui";
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
 * Quick capture. Zero required fields — plain text goes to the inbox instantly
 * (local token parse), then AI quietly refines details in the background.
 * Voice input via the Web Speech API where available.
 */
/** What the expanding lower section is showing. */
type Phase = "input" | "thinking" | "done";

const THINKING_LINES = [
  "Reading what you meant…",
  "Splitting it into tasks…",
  "Filling in days and times…",
  "Choosing the right lists…",
  "Polishing the details…",
  "Taking a moment, still on it…",
];

export function Omnibar() {
  const { state, addTask, getTask, updateTask, setOmnibar, showToast } = useApp();
  const [text, setText] = useState("");
  const guest = Boolean(state.user.guest);
  const modes: { id: CaptureMode; label: string }[] = [
    { id: "task", label: "Task" },
    ...(!guest ? [{ id: "note" as const, label: "Note" }] : []),
    ...(!guest ? [{ id: "journal" as const, label: "Journal" }] : []),
  ];
  const [mode, setMode] = useState<CaptureMode>(() => {
    const m = nextMode;
    nextMode = "task";
    return m;
  });
  const activeMode: CaptureMode = modes.some((m) => m.id === mode) ? mode : "task";
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [phase, setPhase] = useState<Phase>("input");
  const [thinkLine, setThinkLine] = useState(0);
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
  const recRef = useRef<SpeechRec | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const speechSupported = useMemo(() => getSpeechRecognition() !== null, []);

  // the loader narrates while AI works: one line at a time, holding on the
  // last (the counter is reset where the thinking phase starts)
  useEffect(() => {
    if (phase !== "thinking") return;
    const t = setInterval(
      () => setThinkLine((n) => Math.min(n + 1, THINKING_LINES.length - 1)),
      1100
    );
    return () => clearInterval(t);
  }, [phase]);

  const lists = useMemo(() => visibleLists(state), [state]);
  const parsed = useMemo(() => parseQuickAdd(text, lists), [text, lists]);

  useEffect(() => () => recRef.current?.abort(), []);

  const toggleVoice = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setText(transcript);
    };
    rec.onend = () => {
      setListening(false);
      inputRef.current?.focus();
    };
    rec.onerror = () => {
      setListening(false);
      showToast({ message: "Couldn't hear that, try again, or just type" });
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

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
        showToast({ message: `✨ Captured` });
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
          for (const x of extras) {
            const newId = await createTaskFromAiPreset(x);
            if (newId && x.subtasks.length > 0) {
              updateTask(newId, {
                subtasks: x.subtasks.map((t) => ({ id: crypto.randomUUID(), title: t, done: false })),
              });
            }
          }
        }
        showToast({
          message:
            parsed.length > 0 ? `✨ Captured` : "Captured. AI couldn't refine it this time",
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
    setThinkLine(0);
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
      const wait = Math.max(150, 1600 - (Date.now() - started));
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
    showToast({ message: `✨ Filed ${result.length} ${result.length === 1 ? "task" : "tasks"}` });
    again();
  };

  /** Creates a single task from an AI parsed preset. Returns its id. */
  const createTaskFromAiPreset = (p: AiParsed): Promise<string | null> => {
    return addTask({
      title: p.title,
      plannedFor: p.plannedFor,
      plannedTime: p.plannedTime,
      dueDate: p.dueDate,
      estimateMin: p.estimateMin,
      listId: p.listId,
      listName: p.listName,
      spotlight: p.spotlight,
      repeat: p.repeat ?? null,
    }).then(async (newId) => {
      if (newId && p.subtasks.length > 0) {
        updateTask(newId, {
          subtasks: p.subtasks.map((t) => ({ id: crypto.randomUUID(), title: t, done: false })),
        });
      }
      return newId;
    });
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

  const dismiss = () => {
    setOmnibar(false);
  };

  return (
    <Modal onClose={() => setOmnibar(false)} anchor="top">
      <div className="p-4">
        {/* what this capture becomes; a task unless you say otherwise */}
        {modes.length > 1 && phase === "input" && (
          <div role="tablist" aria-label="Capture as" className="mb-3 flex w-max rounded-full border border-line bg-paper-deep p-0.5" data-capture-modes>
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
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  activeMode === m.id ? "bg-card text-ink shadow-sm" : "text-ink-faint hover:text-ink-soft"
                }`}
              >
                {m.id === "task" ? <Icon3d name="sparkle" size={13} /> : m.id === "note" ? <IconNotes size={13} /> : <IconJournal size={13} />}
                {m.label}
              </button>
            ))}
          </div>
        )}
        {/* the input dims while AI narrates below it, and wakes for the next one */}
        <div
          className={`flex items-center gap-2 transition-opacity duration-300 ${
            phase === "thinking" ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <Icon3d name="feather" size={20} className="shrink-0" />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // the Enter that commits an IME candidate must not also submit
              if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(e.shiftKey);
            }}
            placeholder={
              listening
                ? "Listening…"
                : activeMode === "note"
                  ? "A note. Its first line becomes the title."
                  : activeMode === "journal"
                    ? "A line for today's page…"
                    : "What's on your mind? Say it or type it."
            }
            aria-label={activeMode === "note" ? "New note" : activeMode === "journal" ? "A line for today's journal page" : "What's on your mind"}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-faint sm:text-lg"
            autoFocus
            enterKeyHint="done"
          />
          {speechSupported && (
            <button
              onClick={toggleVoice}
              aria-label={listening ? "Stop listening" : "Speak a task"}
              data-tip={listening ? "Stop listening" : "Speak instead"}
              data-tip-side="bottom"
              className={`grid size-10 shrink-0 place-items-center rounded-full transition-colors ${
                listening
                  ? "anim-pulse bg-clay text-on-accent"
                  : "bg-paper-deep text-ink-soft hover:bg-sun-soft hover:text-sun-deep"
              }`}
            >
              <MicIcon listening={listening} />
            </button>
          )}
          <button
            onClick={() => submit(false)}
            disabled={activeMode === "task" ? !parsed.title : !text.trim() || saving}
            aria-label="Capture"
            data-tip="Capture (Enter)"
            data-tip-side="bottom"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-paper transition-opacity disabled:opacity-25"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* ------------------------------------------------ the reveal
            The section below the input grows and shrinks smoothly (the 0fr
            to 1fr grid trick animates auto height), first narrating what AI
            is doing, then holding the finished task where it can be seen. */}
        <div
          className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ gridTemplateRows: phase === "input" ? "0fr" : "1fr" }}
        >
          <div className="overflow-hidden">
            {phase === "thinking" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <span className="anim-pulse">
                  <Icon3d name="sparkle" size={34} />
                </span>
                <span key={thinkLine} className="anim-rise text-sm font-medium text-ink-soft">
                  {THINKING_LINES[thinkLine]}
                </span>
              </div>
            )}
            {phase === "done" && result && (
              <div className="anim-pop py-3">
                {result.length > 1 && (
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-sun-deep">
                    <Icon3d name="sparkle" size={15} /> That was {result.length} things. Here&apos;s how they&apos;ll be filed:
                  </p>
                )}
                <div className="space-y-2">
                  {result.map((p, i) => (
                    <div
                      key={`preview-${i}`}
                      className="anim-rise rounded-2xl border border-line bg-paper-deep/40 p-3.5"
                      style={{ animationDelay: `${i * 110}ms` }}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 grid size-[20px] shrink-0 place-items-center rounded-full bg-moss text-on-accent">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                            <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-medium leading-snug">{p.title}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {p.plannedFor ? (
                              <Chip tone="sun">
                                <Icon3d name="sun" size={15} /> {friendlyDay(p.plannedFor, state.today)}
                              </Chip>
                            ) : (
                              <Chip>
                                <Icon3d name="inbox" size={15} /> inbox
                              </Chip>
                            )}
                            {p.plannedTime && <Chip tone="sun">🕐 {fmtTime12(p.plannedTime)}</Chip>}
                            {p.dueDate && <Chip tone="clay">due {friendlyDay(p.dueDate, state.today)}</Chip>}
                            {p.estimateMin != null && <Chip>~{fmtMinutes(p.estimateMin)}</Chip>}
                            {p.listId && (
                              <Chip>#{lists.find((l) => l.id === p.listId)?.name ?? "list"}</Chip>
                            )}
                            {p.spotlight && <Chip tone="sun">✦ spotlight</Chip>}
                            {p.repeat && (
                              <Chip tone="sky">
                                <Icon3d name="repeat" size={15} /> {repeatLabel(p.repeat)}
                              </Chip>
                            )}
                            {p.subtasks.length > 0 && <Chip>{p.subtasks.length} steps</Chip>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {!aiFell &&
                  result.some((p) => p.plannedFor || p.plannedTime || p.listId || p.subtasks.length > 0) && (
                  <p className="mt-2.5 flex items-center gap-1 text-[11px] text-ink-faint">
                    <Icon3d name="sparkle" size={14} /> AI filled in dates, times, and lists
                  </p>
                )}
                {state.user.guest && aiLimited && (
                  <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
                    <span>Your 3 free AI captures are used, so this filed as typed.</span>
                    <a
                      href="/api/auth/google"
                      data-track="guest-signin"
                      className="font-semibold text-sun-deep underline underline-offset-2 hover:text-sun"
                    >
                      Sign in for unlimited AI
                    </a>
                  </p>
                )}
                {state.user.guest && !aiLimited && !aiFell && aiLeft != null && (
                  <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
                    <span>
                      {aiLeft === 0
                        ? "That was your last free AI capture."
                        : `${aiLeft} free AI ${aiLeft === 1 ? "capture" : "captures"} left.`}
                    </span>
                    <a
                      href="/api/auth/google"
                      data-track="guest-signin"
                      className="font-semibold text-sun-deep underline underline-offset-2 hover:text-sun"
                    >
                      Sign in for unlimited
                    </a>
                  </p>
                )}
                {aiFell && !aiLimited && (
                  <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
                    <span>AI couldn&apos;t be reached, so this is the plain capture.</span>
                    <button
                      onClick={retryAi}
                      className="font-semibold text-sun-deep underline underline-offset-2 hover:text-sun"
                    >
                      Try AI again
                    </button>
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void fileAll()}
                    autoFocus
                    disabled={filing}
                    className="flex-1 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
                  >
                    {filing
                      ? "Filing…"
                      : `Done — file ${result.length} ${result.length === 1 ? "task" : "tasks"}`}
                  </button>
                  <button
                    onClick={dismiss}
                    disabled={filing}
                    className="rounded-full border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink/10 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => void fileAndCaptureAnother()}
                    disabled={filing}
                    className="flex-1 rounded-full border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep disabled:opacity-50"
                  >
                    File these &amp; capture another
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* one row, three states: recording · idle explainer · live preview */}
        {phase === "input" && (
        <div className="mt-3 flex min-h-7 flex-wrap items-center gap-1.5">
          {listening ? (
            <div className="anim-shimmer flex items-center gap-2.5">
              <span className="flex h-4 items-center gap-[3px]" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="anim-bar h-full w-[3px] rounded-full bg-clay"
                    style={{ animationDelay: `${i * 130}ms` }}
                  />
                ))}
              </span>
              <span className="text-sm text-ink-soft">
                Just talk. <b className="font-medium text-ink">AI does the rest.</b>
              </span>
            </div>
          ) : activeMode !== "task" ? (
            <span className="flex items-center gap-1.5 text-[12px] leading-snug text-ink-soft">
              {activeMode === "note" ? <IconNotes size={13} className="text-ink-faint" /> : <IconJournal size={13} className="text-ink-faint" />}
              {activeMode === "note" ? "Saved as a new page in Notes, just as you typed it." : "Added to today's journal page, under the time."}
            </span>
          ) : !text.trim() ? (
            <div className="anim-shimmer flex items-center gap-2">
              {/* shrink-0 is the fix: without it flex crushed this pill and
                  the sparkle spilled out of its own background */}
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sun-soft px-2 py-0.5 text-[11px] font-semibold text-sun-deep">
                <Icon3d name="sparkle" size={15} /> AI
              </span>
              <span className="text-[12px] leading-snug text-ink-soft">
                Say anything. The details fill themselves in.
              </span>
            </div>
          ) : (
            <>
              {parsed.plannedFor && (
                <Chip tone="sun">
                  <Icon3d name="sun" size={15} /> {friendlyDay(parsed.plannedFor, state.today)}
                </Chip>
              )}
              {parsed.plannedTime && <Chip tone="sun">🕐 {fmtTime12(parsed.plannedTime)}</Chip>}
              {parsed.dueDate && <Chip tone="clay">due {friendlyDay(parsed.dueDate, state.today)}</Chip>}
              {parsed.estimateMin != null && <Chip>~{fmtMinutes(parsed.estimateMin)}</Chip>}
              {parsed.listName && <Chip>#{parsed.listName}</Chip>}
              {parsed.repeat && <Chip tone="sky">
                  <Icon3d name="repeat" size={15} /> {repeatLabel(parsed.repeat)}
                </Chip>}
              {parsed.spotlight && <Chip tone="sun">✦ spotlight</Chip>}
              {!parsed.plannedFor && !parsed.dueDate && (
                <Chip>
                  <Icon3d name="inbox" size={15} /> inbox, decide later
                </Chip>
              )}
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-ink-faint">
                <Icon3d name="sparkle" size={15} /> AI tidies the rest
              </span>
            </>
          )}
        </div>
        )}

        {phase === "input" && (
        <div className="mt-3 hidden items-center justify-between border-t border-line pt-3 text-xs text-ink-faint sm:flex">
          <span>
            <Kbd>enter</Kbd> {activeMode === "task" ? "capture" : "save"} · <Kbd>shift+enter</Kbd> {activeMode === "task" ? "more" : "save, add another"}
          </span>
          <span>{activeMode === "task" ? "try: pay rent fri 6pm ~15m #life" : activeMode === "note" ? "try: gift ideas for mum" : "try: the walk cleared my head"}</span>
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
