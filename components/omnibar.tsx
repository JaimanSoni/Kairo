"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { parseQuickAdd, type ParsedInput } from "@/lib/nlp";
import { friendlyDay, fmtMinutes, fmtTime12 } from "@/lib/dates";
import { repeatLabel } from "@/lib/repeat";
import { useApp, visibleLists } from "./store";
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
export function Omnibar() {
  const { state, addTask, getTask, updateTask, setOmnibar, showToast } = useApp();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const speechSupported = useMemo(() => getSpeechRecognition() !== null, []);

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

  /** After instant capture, let AI tidy details. Any failure = keep local parse. */
  const refineInBackground = (
    raw: string,
    local: ParsedInput,
    idPromise: Promise<string | null>
  ) => {
    const today = state.today;
    fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw, today }),
    })
      .then(async (res) => {
        if (!res.ok) return; // AI unavailable → local parse stands
        const { parsed: ai }: { parsed: AiParsed } = await res.json();
        const id = await idPromise;
        if (!id) return;
        const current = getTask(id);
        if (!current || current.status === "done") return;

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

        if (Object.keys(patch).length === 0) return;
        updateTask(id, patch);
        showToast({ message: `✨ ${notes.length ? notes.join(" · ") : "Tidied it up"}` });
      })
      .catch(() => {
        /* offline / AI down → local parse already did its job */
      });
  };

  const submit = (keepOpen: boolean) => {
    const raw = text.trim();
    if (!raw) return;
    const local = parseQuickAdd(raw, lists);
    if (!local.title) local.title = raw;
    const idPromise = addTask(local);
    refineInBackground(raw, local, idPromise);
    setText("");
    if (!keepOpen) setOmnibar(false);
  };

  return (
    <Modal onClose={() => setOmnibar(false)} anchor="top">
      <div className="p-4">
        <div className="flex items-center gap-2">
          <Icon3d name="feather" size={20} className="shrink-0" />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(e.shiftKey);
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
            className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-paper transition-opacity disabled:opacity-25"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* one row, three states: recording · idle explainer · live preview */}
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
                Listening, just talk. <b className="font-medium text-ink">AI turns it into a task.</b>
              </span>
            </div>
          ) : !text.trim() ? (
            <div className="anim-shimmer flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-sun-soft px-2 py-0.5 text-[11px] font-semibold text-sun-deep">
                <Icon3d name="sparkle" size={15} /> AI
              </span>
              <span className="text-[12px] leading-snug text-ink-soft">
                Type or speak anything, the day, time, list and steps get filled in for you.
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
              <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                <Icon3d name="sparkle" size={15} /> AI adds the rest after capture
              </span>
            </>
          )}
        </div>

        <div className="mt-3 hidden items-center justify-between border-t border-line pt-3 text-xs text-ink-faint sm:flex">
          <span>
            <Kbd>enter</Kbd> capture · <Kbd>shift+enter</Kbd> keep capturing
          </span>
          <span>today · tomorrow · fri · due mon · ~30m · #list · !</span>
        </div>
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
