"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playComplete } from "@/lib/sound";
import { cancelPush, enablePush, pushEnabled, pushPermission, schedulePush } from "@/lib/push-client";
import { useApp } from "./store";
import { IconX } from "./ui";

type SavedTimer = {
  taskId: string;
  totalMs: number;
  running: boolean;
  endAt: number; // meaningful when running
  remainingMs: number; // meaningful when paused
  savedAt: number;
};

/* timer persistence is scoped per account — switching users keeps each timer */
function storageKey(userId: string) {
  return `kairo-focus:${userId}`;
}

function save(userId: string, t: SavedTimer | null) {
  try {
    if (t) localStorage.setItem(storageKey(userId), JSON.stringify(t));
    else localStorage.removeItem(storageKey(userId));
  } catch {}
}

function load(userId: string): SavedTimer | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
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
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<string>("default");
  const zeroFired = useRef(false);
  const restored = useRef(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setPerm(pushPermission());
      pushEnabled().then((v) => !cancelled && setPushOn(v));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Server-side push at the timer's end — arrives even if the tab is gone. */
  const scheduleEndPush = useCallback(
    (endAt: number, taskId: string, title: string) => {
      pushEnabled().then((ok) => {
        if (!ok || endAt <= Date.now()) return;
        schedulePush({
          fireAt: endAt,
          title,
          body: "Time's up. Tick it off, or keep going. Overtime counts up quietly.",
          tag: `focus-${taskId}`,
          url: "/today",
        });
      });
    },
    []
  );

  /* restore a timer from a previous session (as a pill, not a takeover) */
  useEffect(() => {
    if (restored.current || focus) return;
    restored.current = true;
    const saved = load(state.user.id);
    if (!saved) return;
    const t = getTask(saved.taskId);
    if (!t || t.status === "done") {
      save(state.user.id, null);
      return;
    }
    // restored quietly, as the pill — a reload should not take over the screen
    startFocus(saved.taskId, { adopt: true, minimized: true });
  }, [focus, getTask, startFocus, state.user.id]);

  /*
   * Init when the focused task changes.
   *
   * A saved timer is adopted ONLY on the reload-restore path (focus.adopt).
   * Everything else starts fresh, with the duration the session was started
   * with. The old behaviour adopted any saved timer for the same task, so a
   * stale 25-minute session from an earlier attempt would hijack the 50 you
   * had just picked — and look healed after a reload, once the stale save
   * was finally gone.
   */
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
      const saved = load(state.user.id);

      if (focus.adopt && saved && saved.taskId === focus.taskId) {
        zeroFired.current = (saved.running ? saved.endAt - Date.now() : saved.remainingMs) <= 0;
        if (saved.running && saved.endAt > Date.now()) {
          scheduleEndPush(saved.endAt, focus.taskId, task.title);
        }
        apply(saved);
        return;
      }

      // a leftover timer for another task still has a push scheduled — a
      // "time's up" for work you put down would be a phantom
      if (saved && saved.taskId !== focus.taskId) cancelPush(`focus-${saved.taskId}`);

      const minutes = focus.minutes ?? task.estimateMin ?? 25;
      const totalMs = minutes * 60 * 1000;
      const fresh: SavedTimer = {
        taskId: focus.taskId,
        totalMs,
        running: true,
        endAt: Date.now() + totalMs,
        remainingMs: totalMs,
        savedAt: Date.now(),
      };
      zeroFired.current = false;
      save(state.user.id, fresh);
      scheduleEndPush(fresh.endAt, focus.taskId, task.title);
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
      save(state.user.id, null);
      stopFocus();
    }
  }, [focus, task, stopFocus, state.user.id]);

  /*
   * Stopped from outside the overlay — the card's stop button, the sidebar's.
   * The session is over, so the saved timer and its pending push go too.
   * Without this, the next start adopted the corpse of this one, which is
   * exactly the stale-duration bug.
   */
  useEffect(() => {
    if (!focus && timer) {
      const taskId = timer.taskId;
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        cancelPush(`focus-${taskId}`);
        save(state.user.id, null);
        zeroFired.current = false;
        setTimer(null);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [focus, timer, state.user.id]);

  const remaining = timer
    ? timer.running && now > 0
      ? timer.endAt - now
      : timer.remainingMs
    : 0;

  /* time's up chime — once. If the page is visibly open, the in-page chime is
     enough; drop the pending push so it doesn't double-notify. */
  useEffect(() => {
    if (timer && remaining <= 0 && !zeroFired.current) {
      zeroFired.current = true;
      playComplete();
      try {
        navigator.vibrate?.([60, 40, 60]);
      } catch {}
      if (document.visibilityState === "visible") {
        cancelPush(`focus-${timer.taskId}`);
      }
    }
  });

  const update = useCallback(
    (next: SavedTimer) => {
      next.savedAt = Date.now();
      setTimer(next);
      save(state.user.id, next);
    },
    [state.user.id]
  );

  if (!focus || !task || !timer) return null;

  const overtime = remaining < 0;
  const fraction = overtime ? 1 : 1 - Math.min(1, Math.max(0, remaining / timer.totalMs));

  const pause = () => {
    cancelPush(`focus-${task.id}`);
    update({ ...timer, running: false, remainingMs: remaining });
  };
  const resume = () => {
    const endAt = Date.now() + timer.remainingMs;
    scheduleEndPush(endAt, task.id, task.title);
    update({ ...timer, running: true, endAt });
  };
  const reset = () => {
    zeroFired.current = false;
    cancelPush(`focus-${task.id}`);
    update({ ...timer, running: false, remainingMs: timer.totalMs, endAt: 0 });
  };
  const addFive = () => {
    zeroFired.current = false;
    const extra = 5 * 60 * 1000;
    if (timer.running) {
      const endAt = Math.max(timer.endAt, Date.now()) + extra;
      scheduleEndPush(endAt, task.id, task.title);
      update({ ...timer, totalMs: timer.totalMs + extra, endAt });
    } else {
      update({ ...timer, totalMs: timer.totalMs + extra, remainingMs: Math.max(timer.remainingMs, 0) + extra });
    }
  };
  const finish = () => {
    cancelPush(`focus-${task.id}`);
    save(state.user.id, null);
    stopFocus();
    completeTask(task.id);
    showToast({ message: "🎉 Nailed it. One more in the log." });
  };
  const exit = () => {
    cancelPush(`focus-${task.id}`);
    save(state.user.id, null);
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
          {pushOn === false && perm === "default" && !overtime && (
            <button
              onClick={async () => {
                const result = await enablePush();
                if (result.status === "enabled") {
                  setPushOn(true);
                  if (timer.running) scheduleEndPush(timer.endAt, task.id, task.title);
                  showToast({ message: "🔔 You'll get a ping when time's up" });
                } else {
                  setPerm(pushPermission());
                  showToast({
                    message:
                      result.status === "denied"
                        ? "Notifications are blocked for this site"
                        : result.status === "insecure"
                          ? "Push needs HTTPS or localhost"
                          : result.status === "failed"
                            ? `Couldn't enable: ${result.detail}`
                            : "Push isn't supported here",
                  });
                }
              }}
              className="mt-3 rounded-full border border-line bg-card px-4 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
            >
              🔔 Notify me when time&apos;s up
            </button>
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
          className="flex items-center gap-2 rounded-full bg-moss px-7 py-3 text-sm font-bold text-on-accent shadow-md transition-transform hover:-translate-y-0.5 active:translate-y-0"
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
