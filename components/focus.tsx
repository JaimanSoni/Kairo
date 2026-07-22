"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playComplete } from "@/lib/sound";
import { useApp } from "./store";
import { IconX } from "./ui";

const STORAGE_KEY = "kairo-focus";

type SavedTimer = {
  taskId: string;
  totalMs: number;
  running: boolean;
  endAt: number; // meaningful when running
  remainingMs: number; // meaningful when paused
  savedAt: number;
};

function save(t: SavedTimer | null) {
  try {
    if (t) localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function load(): SavedTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedTimer) : null;
  } catch {
    return null;
  }
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.round(Math.abs(ms) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * The focus timer: full-screen countdown for a task with an estimate.
 * Start / pause / resume / reset / +5 min / overtime — survives reloads
 * via localStorage, minimizes to a floating pill.
 */
export function FocusOverlay() {
  const { state, getTask, stopFocus, minimizeFocus, startFocus, completeTask, showToast } = useApp();
  const focus = state.focus;
  const task = focus ? state.tasks[focus.taskId] : null;

  const [timer, setTimer] = useState<SavedTimer | null>(null);
  const [now, setNow] = useState(0);
  const zeroFired = useRef(false);
  const restored = useRef(false);

  /* restore a timer from a previous session (as a pill, not a takeover) */
  useEffect(() => {
    if (restored.current || focus) return;
    restored.current = true;
    const saved = load();
    if (!saved) return;
    const t = getTask(saved.taskId);
    if (!t || t.status === "done") {
      save(null);
      return;
    }
    startFocus(saved.taskId);
    minimizeFocus(true);
  }, [focus, getTask, startFocus, minimizeFocus]);

  /* init / adopt timer when the focused task changes */
  useEffect(() => {
    let cancelled = false;
    const apply = (t: SavedTimer | null) => {
      if (!cancelled) setTimer(t);
    };
    queueMicrotask(() => {
      if (!focus || !task) {
        apply(null);
        return;
      }
      const saved = load();
      if (saved && saved.taskId === focus.taskId) {
        zeroFired.current = (saved.running ? saved.endAt - Date.now() : saved.remainingMs) <= 0;
        apply(saved);
        return;
      }
      const totalMs = (task.estimateMin ?? 25) * 60 * 1000;
      const fresh: SavedTimer = {
        taskId: focus.taskId,
        totalMs,
        running: true,
        endAt: Date.now() + totalMs,
        remainingMs: totalMs,
        savedAt: Date.now(),
      };
      zeroFired.current = false;
      save(fresh);
      apply(fresh);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.taskId]);

  /* tick */
  useEffect(() => {
    if (!timer?.running) return;
    const first = setTimeout(() => setNow(Date.now()), 0);
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [timer?.running]);

  /* task finished or deleted elsewhere → drop the session */
  useEffect(() => {
    if (focus && (!task || task.status === "done")) {
      save(null);
      stopFocus();
    }
  }, [focus, task, stopFocus]);

  const remaining = timer
    ? timer.running && now > 0
      ? timer.endAt - now
      : timer.remainingMs
    : 0;

  /* time's up chime — once */
  useEffect(() => {
    if (timer && remaining <= 0 && !zeroFired.current) {
      zeroFired.current = true;
      playComplete();
      try {
        navigator.vibrate?.([60, 40, 60]);
      } catch {}
    }
  });

  const update = useCallback((next: SavedTimer) => {
    next.savedAt = Date.now();
    setTimer(next);
    save(next);
  }, []);

  if (!focus || !task || !timer) return null;

  const overtime = remaining < 0;
  const fraction = overtime ? 1 : 1 - Math.min(1, Math.max(0, remaining / timer.totalMs));

  const pause = () => update({ ...timer, running: false, remainingMs: remaining });
  const resume = () => update({ ...timer, running: true, endAt: Date.now() + timer.remainingMs });
  const reset = () => {
    zeroFired.current = false;
    update({ ...timer, running: false, remainingMs: timer.totalMs, endAt: 0 });
  };
  const addFive = () => {
    zeroFired.current = false;
    const extra = 5 * 60 * 1000;
    if (timer.running) {
      update({ ...timer, totalMs: timer.totalMs + extra, endAt: Math.max(timer.endAt, Date.now()) + extra });
    } else {
      update({ ...timer, totalMs: timer.totalMs + extra, remainingMs: Math.max(timer.remainingMs, 0) + extra });
    }
  };
  const finish = () => {
    save(null);
    stopFocus();
    completeTask(task.id);
    showToast({ message: "🎉 Nailed it. One more in the log." });
  };
  const exit = () => {
    save(null);
    stopFocus();
  };

  /* ---------- minimized pill ---------- */
  if (focus.minimized) {
    return (
      <button
        onClick={() => minimizeFocus(false)}
        className="anim-pop fixed bottom-20 right-4 z-40 flex items-center gap-2.5 rounded-full border border-line bg-ink px-4 py-2.5 text-paper shadow-lg md:bottom-6"
      >
        <span className={`size-2 rounded-full ${timer.running ? "anim-pulse bg-sun" : "bg-ink-faint"}`} />
        <span className="max-w-32 truncate text-xs">{task.title}</span>
        <span className={`font-mono text-sm font-bold tabular-nums ${overtime ? "text-clay" : "text-sun-soft"}`}>
          {overtime ? "+" : ""}
          {fmtClock(remaining)}
        </span>
      </button>
    );
  }

  /* ---------- full screen ---------- */
  const R = 118;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      {/* top bar */}
      <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={() => minimizeFocus(true)}
          aria-label="Minimize"
          className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-paper-deep"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Focus</span>
        <button
          onClick={exit}
          aria-label="Exit focus"
          className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-paper-deep"
        >
          <IconX />
        </button>
      </div>

      {/* center */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 pb-6 sm:gap-8 sm:pb-10">
        <div className="w-full max-w-md text-center">
          <div className="font-display break-words text-2xl leading-snug sm:text-3xl">{task.title}</div>
          {overtime ? (
            <p className="mt-2 text-sm font-medium text-clay">Overtime — still going. Respect.</p>
          ) : (
            !timer.running && <p className="mt-2 text-sm text-ink-faint">Paused — breathe.</p>
          )}
        </div>

        {/* ring + clock */}
        <div className="relative">
          <svg width="280" height="280" viewBox="0 0 280 280" className="-rotate-90">
            <circle cx="140" cy="140" r={R} fill="none" stroke="var(--color-paper-deep)" strokeWidth="10" />
            <circle
              cx="140"
              cy="140"
              r={R}
              fill="none"
              stroke={overtime ? "var(--color-clay)" : "var(--color-sun)"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - fraction)}
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div
                className={`font-mono text-6xl font-bold tabular-nums tracking-tight ${
                  overtime ? "text-clay" : ""
                }`}
              >
                {overtime ? "+" : ""}
                {fmtClock(remaining)}
              </div>
              <div className="mt-1 text-xs text-ink-faint">of {fmtClock(timer.totalMs)}</div>
            </div>
          </div>
        </div>

        {/* controls */}
        <div className="flex items-center gap-4">
          <ControlBtn label="Reset" onClick={reset}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M2.5 8a5.5 5.5 0 105.5-5.5H5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M7 0.8L4.8 2.6 7 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ControlBtn>

          <button
            onClick={timer.running ? pause : resume}
            aria-label={timer.running ? "Pause" : "Start"}
            className="grid size-20 place-items-center rounded-full bg-ink text-paper shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            {timer.running ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 4.8v14.4a1 1 0 001.53.85l11-7.2a1 1 0 000-1.7l-11-7.2A1 1 0 007 4.8z" />
              </svg>
            )}
          </button>

          <ControlBtn label="+5 min" onClick={addFive}>
            <span className="text-sm font-bold">+5</span>
          </ControlBtn>
        </div>

        <button
          onClick={finish}
          className="flex items-center gap-2 rounded-full bg-moss px-7 py-3 text-sm font-bold text-white shadow-md transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Done — mark it finished
        </button>
      </div>
    </div>
  );
}

function ControlBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        aria-label={label}
        className="grid size-12 place-items-center rounded-full border border-line bg-card text-ink-soft transition-colors hover:border-ink-faint hover:text-ink active:scale-95"
      >
        {children}
      </button>
      <span className="text-[10px] font-medium text-ink-faint">{label}</span>
    </div>
  );
}
