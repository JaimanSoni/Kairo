"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playComplete } from "@/lib/sound";
import { cancelPush, enablePush, pushEnabled, pushPermission, schedulePush } from "@/lib/push-client";
import { hiddenListIds, useApp } from "./store";
import { useStepToggle } from "./step-row";
import { IconCheck, IconX } from "./ui";

/**
 * Focus: one task, one clock, and nothing else on the screen.
 *
 * The session belongs to the account, not the browser. It is kept on the
 * server (lib/focus.ts), so a timer started at the desk is there on the phone:
 * a device that finds a session it didn't start shows it as the small pill,
 * never as a takeover. Every device measures the countdown against the
 * server's clock (each answer carries `now`), so two devices whose clocks
 * disagree still show the same time. A change on one device (pause, a few
 * minutes more or less, ending it) reaches the others the next time they look:
 * when they're opened or brought forward, and every half minute while a
 * session is on. Guests have no account to keep it with, so theirs stays in
 * the browser, as it always did.
 *
 * The screen is dark whatever the theme, on purpose: it should feel like the
 * lights went down. The controls step back while the clock runs and the
 * pointer is still, the ring breathes slowly, the screen is kept awake, and
 * the tab's title carries the countdown for when you're working elsewhere.
 */

type Session = {
  taskId: string;
  totalMs: number;
  running: boolean;
  /** Server-clock epoch ms the countdown reaches zero. Meaningful while running. */
  endAt: number;
  /** What's left. Meaningful while paused. */
  remainingMs: number;
  /** The server's revision of this session; 0 until the server has it. */
  rev: number;
  updatedAt: number;
};

const MIN = 60_000;
const STEP = 5 * MIN;

/* ------------------------------------------------------------ the shared clock */

const OFFSET_KEY = "kairo-clock-offset";
let clockOffset: number | null = null;

/** Now, by the server's clock: this device's clock plus how far off it was last found to be. */
function serverNow(): number {
  if (clockOffset === null) {
    try {
      clockOffset = Number(localStorage.getItem(OFFSET_KEY)) || 0;
    } catch {
      clockOffset = 0;
    }
  }
  return Date.now() + clockOffset;
}

function learnClock(serverTime: number, sentAt: number, receivedAt: number) {
  // the server stamped its answer about halfway through the round trip
  clockOffset = Math.round(serverTime - (sentAt + receivedAt) / 2);
  try {
    localStorage.setItem(OFFSET_KEY, String(clockOffset));
  } catch {
    /* it is learned again on the next answer */
  }
}

async function remote(method: "GET" | "PUT" | "DELETE", body?: unknown): Promise<{ session: Session | null } | null> {
  const sentAt = Date.now();
  try {
    const res = await fetch("/api/focus", { method, cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    if (!res.ok) return null;
    const data = (await res.json()) as { session: Session | null; now: number };
    if (typeof data.now === "number") learnClock(data.now, sentAt, Date.now());
    return { session: data.session };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ this device's copy */

/* scoped per account: switching users keeps each one's timer */
const storageKey = (userId: string) => `kairo-focus:${userId}`;

function save(userId: string, t: Session | null) {
  try {
    if (t) localStorage.setItem(storageKey(userId), JSON.stringify(t));
    else localStorage.removeItem(storageKey(userId));
  } catch {}
}

function load(userId: string): Session | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const t = JSON.parse(raw) as Partial<Session>;
    if (typeof t.taskId !== "string" || typeof t.totalMs !== "number") return null;
    return { taskId: t.taskId, totalMs: t.totalMs, running: Boolean(t.running), endAt: Number(t.endAt ?? 0), remainingMs: Number(t.remainingMs ?? 0), rev: Number(t.rev ?? 0), updatedAt: Number(t.updatedAt ?? 0) };
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

/** "4:35 PM", by this device's own clock: when the countdown lands, where you are. */
function fmtLands(remainingMs: number): string {
  const d = new Date(Date.now() + remainingMs);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const TITLE_PREFIX = /^\+?\d+:\d\d(?::\d\d)? · /;

export function FocusOverlay() {
  const { state, getTask, stopFocus, minimizeFocus, startFocus, completeTask, showToast } = useApp();
  const toggleStep = useStepToggle();
  const focus = state.focus;
  const guest = Boolean(state.user.guest);
  const userId = state.user.id;
  const found = focus ? state.tasks[focus.taskId] : null;
  // a timer running on a task in a list that's locked right now doesn't show its title
  const task = found && !(found.listId && hiddenListIds(state).has(found.listId)) ? found : null;

  const [timer, setTimer] = useState<Session | null>(null);
  const [now, setNow] = useState(0);
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<string>("default");
  const [idle, setIdle] = useState(false);
  const zeroFired = useRef(false);
  const restored = useRef(false);
  const timerRef = useRef<Session | null>(null);
  const focusRef = useRef(focus);
  /** Writes on their way to the server. A look taken while one is out would be stale by the time it lands. */
  const writing = useRef(0);
  /** Set when this device learns the session was ended elsewhere, so ending it here doesn't tell the server again. */
  const endedElsewhere = useRef(false);

  useEffect(() => {
    timerRef.current = timer;
    focusRef.current = focus;
  });

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

  /** Server-side push at the timer's end: arrives even if every tab is gone. `endAt` is already server time. */
  const scheduleEndPush = useCallback((endAt: number, taskId: string, title: string) => {
    pushEnabled().then((ok) => {
      if (!ok || endAt <= serverNow()) return;
      schedulePush({ fireAt: endAt, title, body: "Time's up. Tick it off, or keep going. Overtime counts up quietly.", tag: `focus-${taskId}`, url: "/today" });
    });
  }, []);

  /** A change made here: shown at once, then sent; the server's answer (its clock, its rev) is what's kept. */
  const commit = useCallback(
    (next: Session) => {
      next.updatedAt = serverNow();
      setTimer(next);
      save(userId, next);
      if (guest) return;
      const remainingMs = next.running ? next.endAt - serverNow() : next.remainingMs;
      writing.current++;
      void remote("PUT", { taskId: next.taskId, totalMs: next.totalMs, running: next.running, remainingMs }).then((r) => {
        writing.current--;
        const cur = timerRef.current;
        if (!r?.session || !cur || cur.taskId !== r.session.taskId || writing.current > 0) return;
        setTimer(r.session);
        save(userId, r.session);
      });
    },
    [guest, userId]
  );

  /* ------------------------------------------------ what the other devices did */

  const look = useCallback(async () => {
    if (guest || writing.current > 0) return;
    const r = await remote("GET");
    if (!r || writing.current > 0) return;
    const theirs = r.session;
    const mine = timerRef.current ?? (focusRef.current ? null : load(userId));

    if (!theirs) {
      if (mine && mine.rev > 0) {
        // it was on the server and now isn't: ended on another device
        endedElsewhere.current = true;
        save(userId, null);
        if (focusRef.current) stopFocus();
      } else if (mine && timerRef.current) {
        // started here before the server heard of it
        commit(mine);
      }
      return;
    }
    if (mine && theirs.rev <= mine.rev && theirs.taskId === mine.taskId) return;
    const t = getTask(theirs.taskId);
    if (!t || t.status === "done") return;
    save(userId, theirs);
    if (focusRef.current?.taskId === theirs.taskId) {
      zeroFired.current = (theirs.running ? theirs.endAt - serverNow() : theirs.remainingMs) <= 0;
      setTimer(theirs);
    } else {
      // someone else's start (another device of yours): it arrives as the pill, never as a takeover
      startFocus(theirs.taskId, { adopt: true, minimized: focusRef.current ? focusRef.current.minimized : true });
    }
  }, [commit, getTask, guest, startFocus, stopFocus, userId]);

  useEffect(() => {
    if (guest) return;
    const onVisible = () => {
      if (!document.hidden) void look();
    };
    const first = setTimeout(() => void look(), 0);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [guest, look]);

  // while a session is on, look every half minute for a pause or an ending made elsewhere
  const sessionOn = Boolean(timer);
  useEffect(() => {
    if (guest || !sessionOn) return;
    const iv = setInterval(() => {
      if (!document.hidden) void look();
    }, 30_000);
    return () => clearInterval(iv);
  }, [guest, sessionOn, look]);

  /* restore this device's own copy after a reload (as a pill, not a takeover) */
  useEffect(() => {
    if (restored.current || focus) return;
    restored.current = true;
    const saved = load(userId);
    if (!saved) return;
    const t = getTask(saved.taskId);
    if (!t || t.status === "done") {
      save(userId, null);
      return;
    }
    startFocus(saved.taskId, { adopt: true, minimized: true });
  }, [focus, getTask, startFocus, userId]);

  /*
   * Init when the focused task changes. A saved session is adopted ONLY on
   * the adopt path (a reload, or a session found on the server). Everything
   * else starts fresh, with the length the session was started with.
   */
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!focus || !task) {
        setTimer(null);
        return;
      }
      const saved = load(userId);
      if (focus.adopt && saved && saved.taskId === focus.taskId) {
        zeroFired.current = (saved.running ? saved.endAt - serverNow() : saved.remainingMs) <= 0;
        if (saved.running && saved.endAt > serverNow()) scheduleEndPush(saved.endAt, focus.taskId, task.title);
        setTimer(saved);
        return;
      }
      // a leftover timer for another task still has a push scheduled: a "time's up" for work you put down would be a phantom
      if (saved && saved.taskId !== focus.taskId) cancelPush(`focus-${saved.taskId}`);
      const totalMs = (focus.minutes ?? task.estimateMin ?? 25) * MIN;
      const fresh: Session = { taskId: focus.taskId, totalMs, running: true, endAt: serverNow() + totalMs, remainingMs: totalMs, rev: 0, updatedAt: serverNow() };
      zeroFired.current = false;
      endedElsewhere.current = false;
      scheduleEndPush(fresh.endAt, focus.taskId, task.title);
      commit(fresh);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.taskId]);

  /* tick */
  useEffect(() => {
    if (!timer?.running) return;
    const first = setTimeout(() => setNow(serverNow()), 0);
    const iv = setInterval(() => setNow(serverNow()), 250);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [timer?.running]);

  /* task finished or deleted elsewhere: drop the session */
  useEffect(() => {
    if (focus && (!task || task.status === "done")) {
      save(userId, null);
      stopFocus();
    }
  }, [focus, task, stopFocus, userId]);

  /* Stopped, from here or anywhere (the row's menu, the sidebar): the saved copy, its push and the server's session go too. */
  useEffect(() => {
    if (!focus && timer) {
      const taskId = timer.taskId;
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        cancelPush(`focus-${taskId}`);
        save(userId, null);
        if (!guest && !endedElsewhere.current) void remote("DELETE");
        endedElsewhere.current = false;
        zeroFired.current = false;
        setTimer(null);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [focus, timer, userId, guest]);

  const remaining = timer ? (timer.running && now > 0 ? timer.endAt - now : timer.running ? timer.endAt - serverNow() : timer.remainingMs) : 0;
  const overtime = remaining < 0;
  const full = Boolean(focus && task && timer && !focus.minimized);
  const running = Boolean(timer?.running);

  /* time's up chime, once. If the page is visibly open, the in-page chime is enough; drop the pending push so it doesn't double-notify. */
  useEffect(() => {
    if (timer && remaining <= 0 && !zeroFired.current) {
      zeroFired.current = true;
      playComplete();
      try {
        navigator.vibrate?.([60, 40, 60]);
      } catch {}
      if (document.visibilityState === "visible") cancelPush(`focus-${timer.taskId}`);
    }
  });

  /* the tab carries the countdown, for when you're working somewhere else */
  const clock = `${overtime ? "+" : ""}${fmtClock(remaining)}`;
  useEffect(() => {
    if (!timer) return;
    const base = document.title.replace(TITLE_PREFIX, "");
    document.title = `${clock} · ${base}`;
    return () => {
      document.title = document.title.replace(TITLE_PREFIX, "");
    };
  }, [timer, clock]);

  /* keep the screen awake while the focus screen is up and the clock is running */
  useEffect(() => {
    if (!full || !running) return;
    type Lock = { release: () => Promise<void> };
    let lock: Lock | null = null;
    let gone = false;
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Lock> } }).wakeLock;
    const ask = () => {
      if (!wl || document.hidden) return;
      wl.request("screen")
        .then((l) => {
          if (gone) void l.release();
          else lock = l;
        })
        .catch(() => {});
    };
    ask();
    document.addEventListener("visibilitychange", ask);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", ask);
      void lock?.release().catch(() => {});
    };
  }, [full, running]);

  /* the controls step back while the clock runs and nothing is touched */
  useEffect(() => {
    if (!full || !running) {
      const t = setTimeout(() => setIdle(false), 0);
      return () => clearTimeout(t);
    }
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 4000);
    };
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [full, running]);

  if (!focus || !task || !timer) return null;

  const fraction = overtime ? 1 : 1 - Math.min(1, Math.max(0, remaining / timer.totalMs));

  const pause = () => {
    cancelPush(`focus-${task.id}`);
    commit({ ...timer, running: false, remainingMs: remaining });
  };
  const resume = () => {
    const endAt = serverNow() + timer.remainingMs;
    scheduleEndPush(endAt, task.id, task.title);
    commit({ ...timer, running: true, endAt });
  };
  const restart = () => {
    zeroFired.current = false;
    const endAt = serverNow() + timer.totalMs;
    scheduleEndPush(endAt, task.id, task.title);
    commit({ ...timer, running: true, endAt, remainingMs: timer.totalMs });
  };
  /** Five minutes more, or five fewer. It never takes the clock under a minute: that's what ending is for. */
  const canTrim = remaining - STEP >= MIN;
  const adjust = (by: number) => {
    if (by < 0 && !canTrim) return;
    if (by > 0) zeroFired.current = false;
    const totalMs = Math.max(MIN, timer.totalMs + by);
    if (timer.running) {
      const endAt = Math.max(timer.endAt, serverNow()) + by;
      cancelPush(`focus-${task.id}`);
      scheduleEndPush(endAt, task.id, task.title);
      commit({ ...timer, totalMs, endAt });
    } else {
      commit({ ...timer, totalMs, remainingMs: Math.max(timer.remainingMs, 0) + by });
    }
  };
  const finish = () => {
    cancelPush(`focus-${task.id}`);
    save(userId, null);
    stopFocus();
    completeTask(task.id);
    showToast({ message: "Done. One more in the log." });
  };
  const exit = () => {
    cancelPush(`focus-${task.id}`);
    save(userId, null);
    stopFocus();
  };

  /* ---------- minimized: a pill that still lets you pause, clear of the plus in the corner ---------- */
  if (focus.minimized) {
    return (
      <div className="qc-float anim-pop fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 overflow-hidden rounded-full bg-[#10201c] py-1 pl-1 pr-1.5 text-white shadow-xl shadow-black/25 ring-1 ring-white/10 md:bottom-5" data-focus-pill>
        <span className="pointer-events-none absolute inset-y-0 left-0 bg-white/[0.07] transition-[width] duration-500" style={{ width: `${fraction * 100}%` }} aria-hidden />
        <button onClick={timer.running ? pause : resume} aria-label={timer.running ? "Pause" : "Resume"} className="relative grid size-9 shrink-0 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20" data-focus-pill-toggle>
          {timer.running ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="4" width="4" height="16" rx="1.5" />
              <rect x="14" y="4" width="4" height="16" rx="1.5" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="translate-x-px">
              <path d="M7 4.8v14.4a1 1 0 001.53.85l11-7.2a1 1 0 000-1.7l-11-7.2A1 1 0 007 4.8z" />
            </svg>
          )}
        </button>
        <button onClick={() => minimizeFocus(false)} aria-label={`Open focus: ${task.title}`} className="relative flex min-w-0 items-center gap-2.5 rounded-full py-1.5 pl-2 pr-2.5" data-focus-pill-open>
          <span className="max-w-[9.5rem] truncate text-xs text-white/75">{task.title}</span>
          <span className={`font-mono text-sm font-bold tabular-nums ${overtime ? "text-[#ffb4a2]" : timer.running ? "text-white" : "text-white/60"}`}>{clock}</span>
        </button>
      </div>
    );
  }

  /* ---------- the focus screen ---------- */
  const R = 132;
  const CIRC = 2 * Math.PI * R;
  // the clock must stay inside the ring at any length: once hours arrive the type steps down
  const clockSize = clock.length <= 5 ? "text-7xl" : clock.length <= 7 ? "text-[3.4rem]" : "text-[2.7rem]";
  const accent = overtime ? "#ffb08a" : "#8be0c9";
  const steps = task.subtasks;
  const stepsLeft = steps.filter((s) => !s.done).length;
  const quiet = idle ? "opacity-25" : "opacity-100";

  return (
    <div className="fc-screen fixed inset-0 z-50 flex flex-col text-white" data-focus-screen data-running={timer.running || undefined} data-overtime={overtime || undefined}>
      <div className="fc-glow pointer-events-none absolute inset-0" aria-hidden />

      <div className={`relative flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] transition-opacity duration-700 ${quiet}`}>
        <button onClick={() => minimizeFocus(true)} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white" data-focus-minimize>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Minimize
        </button>
        <button onClick={exit} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white" data-focus-end>
          End session <IconX size={13} />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-y-auto px-6 pb-8">
        <div className="w-full max-w-md text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">{overtime ? "Overtime" : timer.running ? "Focusing on" : "Paused"}</p>
          <h1 className="font-display mt-2 break-words text-2xl leading-snug sm:text-3xl">{task.title}</h1>
        </div>

        {/* the ring and the clock, with five minutes less and more on either side */}
        <div className="flex items-center gap-3 sm:gap-6">
          <button
            onClick={() => adjust(-STEP)}
            disabled={!canTrim}
            aria-label="Five minutes less"
            title={canTrim ? "Five minutes less" : "Less than six minutes left"}
            className={`grid size-12 shrink-0 place-items-center rounded-full bg-white/[0.07] text-sm font-bold text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/15 active:scale-95 disabled:opacity-25 ${quiet}`}
            data-focus-less
          >
            −5
          </button>
          <div className="relative">
            <svg width="300" height="300" viewBox="0 0 300 300" className={`-rotate-90 max-w-[62vw] ${timer.running ? "fc-breathe" : ""}`} style={{ height: "auto" }} aria-hidden>
              <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle cx="150" cy="150" r={R} fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - fraction)} className="transition-[stroke-dashoffset] duration-300" style={{ filter: `drop-shadow(0 0 10px ${accent}66)` }} />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className={`font-mono font-semibold tabular-nums tracking-tight ${clockSize}`} style={overtime ? { color: accent } : undefined} data-focus-clock>
                  {clock}
                </div>
                <div className="mt-1.5 text-xs text-white/45" data-focus-sub>
                  {overtime ? `past ${fmtClock(timer.totalMs)}` : timer.running ? `until ${fmtLands(remaining)}` : `of ${fmtClock(timer.totalMs)}`}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => adjust(STEP)}
            aria-label="Five minutes more"
            title="Five minutes more"
            className={`grid size-12 shrink-0 place-items-center rounded-full bg-white/[0.07] text-sm font-bold text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/15 active:scale-95 ${quiet}`}
            data-focus-more
          >
            +5
          </button>
        </div>

        {/* the task's steps, to tick off without leaving */}
        {steps.length > 0 && (
          <ul className={`w-full max-w-sm space-y-1 transition-opacity duration-700 ${idle ? "opacity-40" : "opacity-100"}`} data-focus-steps>
            {steps.slice(0, 6).map((s) => (
              <li key={s.id}>
                <button onClick={() => toggleStep(task.id, s.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/[0.06]">
                  <span className={`grid size-[18px] shrink-0 place-items-center rounded-full border-2 ${s.done ? "border-transparent bg-[#8be0c9] text-[#10201c]" : "border-white/35 text-transparent"}`}>
                    <IconCheck size={10} />
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${s.done ? "text-white/35 line-through" : "text-white/85"}`}>{s.title}</span>
                </button>
              </li>
            ))}
            {steps.length > 6 && <li className="px-3 text-xs text-white/40">and {steps.length - 6} more, {stepsLeft} left in all</li>}
          </ul>
        )}

        <div className={`flex flex-col items-center gap-3 transition-opacity duration-700 ${quiet}`}>
          <div className="flex items-center gap-3">
            <button onClick={timer.running ? pause : resume} className="flex h-12 items-center gap-2 rounded-full bg-white/10 px-6 text-sm font-semibold ring-1 ring-white/15 transition-colors hover:bg-white/20" data-focus-toggle>
              {timer.running ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <rect x="6" y="4" width="4" height="16" rx="1.5" />
                  <rect x="14" y="4" width="4" height="16" rx="1.5" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M7 4.8v14.4a1 1 0 001.53.85l11-7.2a1 1 0 000-1.7l-11-7.2A1 1 0 007 4.8z" />
                </svg>
              )}
              {timer.running ? "Pause" : "Resume"}
            </button>
            <button onClick={finish} className="flex h-12 items-center gap-2 rounded-full bg-[#8be0c9] px-6 text-sm font-bold text-[#10201c] transition-transform hover:-translate-y-0.5 active:translate-y-0" data-focus-done>
              <IconCheck size={13} /> Done
            </button>
          </div>
          <button onClick={restart} className="rounded-full px-3 py-1 text-xs font-medium text-white/45 hover:text-white/80" data-focus-restart>
            Start the clock over
          </button>
          {pushOn === false && perm === "default" && !overtime && (
            <button
              onClick={async () => {
                const result = await enablePush();
                if (result.status === "enabled") {
                  setPushOn(true);
                  if (timer.running) scheduleEndPush(timer.endAt, task.id, task.title);
                  showToast({ message: "You'll get a ping when time's up." });
                } else {
                  setPerm(pushPermission());
                  showToast({ message: result.status === "denied" ? "Notifications are blocked for this site" : result.status === "insecure" ? "Push needs HTTPS or localhost" : result.status === "failed" ? `Couldn't enable: ${result.detail}` : "Push isn't supported here" });
                }
              }}
              className="rounded-full px-3 py-1 text-xs font-medium text-white/45 hover:text-white/80"
            >
              Tell me when time&apos;s up
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
