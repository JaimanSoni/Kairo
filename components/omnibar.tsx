"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { parseQuickAdd, type ParsedInput } from "@/lib/nlp";
import { friendlyDay, fmtMinutes, fmtTime12 } from "@/lib/dates";
import { repeatLabel } from "@/lib/repeat";
import { useApp, visibleLists } from "./store";
import { track } from "@/lib/analytics-client";
import { Icon3d } from "./img3d";
import { Chip, Kbd, Modal } from "./ui";

/* Minimal Web Speech API surface (not in TS dom lib everywhere) */
type SpeechResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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
};

/**
 * Quick capture. Zero required fields — plain text goes to the inbox instantly
 * (local token parse), then AI quietly refines details in the background.
 * Voice input via the Web Speech API where available.
 */
/** What the expanding lower section is showing. */
type Phase = "input" | "thinking" | "done";

const THINKING_LINES = [
  "Categorizing your task…",
  "Reading the day and time…",
  "Choosing the right list…",
  "Polishing the details…",
];

export function Omnibar() {
  const { state, addTask, getTask, updateTask, setOmnibar, setEditing, showToast } = useApp();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [phase, setPhase] = useState<Phase>("input");
  const [thinkLine, setThinkLine] = useState(0);
  const [result, setResult] = useState<{ task: Task; notes: string[] } | null>(null);
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
   * After instant capture, let AI tidy details. Any failure = keep local
   * parse. Resolves with what it changed, so the capture flow can show the
   * outcome in place; `toast` announces it instead, for rapid-entry captures
   * where the panel has already moved on.
   */
  const refine = (
    raw: string,
    local: ParsedInput,
    idPromise: Promise<string | null>,
    toast: boolean
  ): Promise<{ notes: string[] }> => {
    const today = state.today;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw, today, time }),
    })
      .then(async (res) => {
        if (!res.ok) return { notes: [] }; // AI unavailable → local parse stands
        const { parsed: ai }: { parsed: AiParsed } = await res.json();
        const id = await idPromise;
        if (!id) return { notes: [] };
        const current = getTask(id);
        if (!current || current.status === "done") return { notes: [] };

        // Apply an AI value only when it adds something and the user hasn't
        // already changed that field since capture.
        const patch: Partial<Task> = {};
        const notes: string[] = [];
        const untouched = <K extends keyof Task>(k: K, localVal: Task[K]) =>
          current[k] === localVal;

        if (ai.title && ai.title !== current.title && untouched("title", local.title)) {
          patch.title = ai.title;
        }
        if (ai.plannedFor && ai.plannedFor !== current.plannedFor && untouched("plannedFor", local.plannedFor)) {
          patch.plannedFor = ai.plannedFor;
          if (current.status === "inbox") patch.status = "planned";
          notes.push(friendlyDay(ai.plannedFor, today));
        }
        if (
          ai.plannedTime &&
          ai.plannedTime !== current.plannedTime &&
          untouched("plannedTime", local.plannedTime) &&
          (patch.plannedFor || current.plannedFor)
        ) {
          patch.plannedTime = ai.plannedTime;
          notes.push(fmtTime12(ai.plannedTime));
        }
        if (ai.dueDate && ai.dueDate !== current.dueDate && untouched("dueDate", local.dueDate)) {
          patch.dueDate = ai.dueDate;
          notes.push(`due ${friendlyDay(ai.dueDate, today)}`);
        }
        if (ai.estimateMin && ai.estimateMin !== current.estimateMin && untouched("estimateMin", local.estimateMin)) {
          patch.estimateMin = ai.estimateMin;
          notes.push(`~${fmtMinutes(ai.estimateMin)}`);
        }
        if (ai.listId && ai.listId !== current.listId && untouched("listId", local.listId)) {
          patch.listId = ai.listId;
          if (ai.listName) notes.push(`#${ai.listName}`);
        }
        if (ai.spotlight && !current.spotlight && untouched("spotlight", local.spotlight)) {
          const spotCount = Object.values(state.tasks).filter(
            (t) => t.spotlight && t.status !== "done"
          ).length;
          if (spotCount < 3) {
            patch.spotlight = true;
            notes.push("✦ spotlight");
          }
        }
        if (ai.subtasks.length > 0 && current.subtasks.length === 0) {
          patch.subtasks = ai.subtasks.map((t) => ({
            id: crypto.randomUUID(),
            title: t,
            done: false,
          }));
          notes.push(`${ai.subtasks.length} steps`);
        }

        if (Object.keys(patch).length === 0) return { notes: [] };
        updateTask(id, patch);
        if (toast) showToast({ message: `✨ ${notes.length ? notes.join(" · ") : "Tidied it up"}` });
        return { notes };
      })
      .catch(() => ({ notes: [] })); // offline / AI down → local parse already did its job
  };

  const submit = (keepOpen: boolean) => {
    if (phase !== "input") return;
    const raw = text.trim();
    if (!raw) return;
    track("capture");
    const local = parseQuickAdd(raw, lists);
    if (!local.title) local.title = raw;
    const idPromise = addTask(local);
    setText("");

    // rapid entry: capture, stay in the input, AI tidies in the background
    if (keepOpen) {
      void refine(raw, local, idPromise, true);
      return;
    }

    // the show: the panel grows, AI narrates, and the finished task appears
    // right here rather than vanishing to somewhere unseen
    setThinkLine(0);
    setPhase("thinking");
    const started = Date.now();
    const refined = refine(raw, local, idPromise, false);
    const timeout = new Promise<{ notes: string[] }>((r) =>
      setTimeout(() => r({ notes: [] }), 9000)
    );
    void (async () => {
      const { notes } = await Promise.race([refined, timeout]);
      // the save gets its own deadline: a stalled network request must not
      // leave the panel narrating forever with the input frozen
      const id = await Promise.race([
        idPromise,
        new Promise<null>((r) => setTimeout(() => r(null), 12_000)),
      ]);
      if (!id) {
        // the save itself failed; the store already raised its toast
        setOmnibar(false);
        return;
      }
      // the animation needs a beat to read, even when AI answers instantly
      const wait = Math.max(0, 1600 - (Date.now() - started));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const task = getTask(id);
      if (!task) {
        setOmnibar(false);
        return;
      }
      setResult({ task, notes });
      setPhase("done");
    })();
  };

  /** Back to a fresh input, same panel — for capturing the next one. */
  const again = () => {
    setResult(null);
    setPhase("input");
    queueMicrotask(() => inputRef.current?.focus());
  };

  return (
    <Modal onClose={() => setOmnibar(false)} anchor="top">
      <div className="p-4">
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
            placeholder={listening ? "Listening…" : "What's on your mind? Say it or type it."}
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
            disabled={!parsed.title}
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
                <div className="rounded-2xl border border-line bg-paper-deep/40 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid size-[20px] shrink-0 place-items-center rounded-full bg-moss text-on-accent">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium leading-snug">{result.task.title}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {result.task.plannedFor ? (
                          <Chip tone="sun">
                            <Icon3d name="sun" size={15} /> {friendlyDay(result.task.plannedFor, state.today)}
                          </Chip>
                        ) : result.task.status === "someday" ? (
                          <Chip>
                            <Icon3d name="moon" size={15} /> someday
                          </Chip>
                        ) : (
                          <Chip>
                            <Icon3d name="inbox" size={15} /> inbox
                          </Chip>
                        )}
                        {result.task.plannedTime && <Chip tone="sun">🕐 {fmtTime12(result.task.plannedTime)}</Chip>}
                        {result.task.dueDate && <Chip tone="clay">due {friendlyDay(result.task.dueDate, state.today)}</Chip>}
                        {result.task.estimateMin != null && <Chip>~{fmtMinutes(result.task.estimateMin)}</Chip>}
                        {result.task.listId && (
                          <Chip>#{lists.find((l) => l.id === result.task.listId)?.name ?? "list"}</Chip>
                        )}
                        {result.task.repeat && (
                          <Chip tone="sky">
                            <Icon3d name="repeat" size={15} /> {repeatLabel(result.task.repeat)}
                          </Chip>
                        )}
                        {result.task.spotlight && <Chip tone="sun">✦ spotlight</Chip>}
                        {result.task.subtasks.length > 0 && <Chip>{result.task.subtasks.length} steps</Chip>}
                      </div>
                    </div>
                  </div>
                  {result.notes.length > 0 && (
                    <p className="mt-2.5 flex items-center gap-1 text-[11px] text-ink-faint">
                      <Icon3d name="sparkle" size={14} /> AI filled in: {result.notes.join(" · ")}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setOmnibar(false)}
                    autoFocus
                    className="flex-1 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper"
                  >
                    Done
                  </button>
                  <button
                    onClick={again}
                    className="rounded-full border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
                  >
                    Capture another
                  </button>
                  <button
                    onClick={() => {
                      const id = result.task.id;
                      setOmnibar(false);
                      setEditing(id);
                    }}
                    className="rounded-full border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
                  >
                    Open
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
            <Kbd>enter</Kbd> capture · <Kbd>shift+enter</Kbd> more
          </span>
          <span>try: pay rent fri 6pm ~15m #life</span>
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
