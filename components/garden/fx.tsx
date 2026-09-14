"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { WateringCan } from "./plants";

/**
 * The garden's moments: water pouring, a burst when something grows or
 * ripens, and a clock the sky can follow. All of it steps aside for anyone
 * who has asked their system for less motion.
 */

/* ----------------------------------------------------------------- clock */

let minutes = -1;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

const readMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/** Minutes past local midnight, ticking once a minute. */
export function useClock(): number {
  return useSyncExternalStore(
    (cb) => {
      clockListeners.add(cb);
      if (!clockTimer) {
        clockTimer = setInterval(() => {
          minutes = readMinutes();
          for (const l of clockListeners) l();
        }, 30_000);
      }
      return () => {
        clockListeners.delete(cb);
        if (clockListeners.size === 0 && clockTimer) {
          clearInterval(clockTimer);
          clockTimer = null;
        }
      };
    },
    () => {
      if (minutes < 0) minutes = readMinutes();
      return minutes;
    },
    () => 12 * 60
  );
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

/* ---------------------------------------------------------------- water */

/** The can tips, the water falls. Mounted for a moment by the plot that was watered. */
export function WaterPour() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      <div className="gd-can absolute -top-2 right-0">
        <WateringCan size={46} />
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="gd-drop absolute block rounded-full bg-sky"
          style={{ left: `${44 + (i % 3) * 7}%`, top: "18%", width: 5, height: 8, animationDelay: `${0.18 + i * 0.09}s` }}
        />
      ))}
      <span className="gd-splash absolute left-1/2 top-[78%] block h-3 w-16 -translate-x-1/2 rounded-full border-2 border-sky/70" />
    </div>
  );
}

/* ---------------------------------------------------------------- burst */

const BURST_COLORS = ["#ffd23f", "#ff7eb6", "#7fcd84", "#4e93c9", "#ff9f43", "#c77dff"];

/** A little burst of petals and sparks, for growing, ripening, and golden fruit. */
export function Burst({ golden = false, count = 18 }: { golden?: boolean; count?: number }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.2;
      const dist = 40 + ((i * 37) % 50);
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 20,
        color: golden ? (i % 2 ? "#ffd23f" : "#fff3a0") : BURST_COLORS[i % BURST_COLORS.length],
        round: i % 3 === 0,
        delay: (i % 5) * 0.03,
      };
    })
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-30" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`gd-burst absolute block ${p.round ? "rounded-full" : "rounded-sm"}`}
          style={{
            width: p.round ? 7 : 5,
            height: p.round ? 7 : 10,
            background: p.color,
            ["--bx" as string]: `${p.x}px`,
            ["--by" as string]: `${p.y}px`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Mounts its children for a moment, then takes them away again. */
export function Moment({ id, ms, children }: { id: number; ms: number; children: React.ReactNode }) {
  const [shown, setShown] = useState<number | null>(null);
  const visible = shown === id;
  useEffect(() => {
    if (id <= 0) return;
    const show = setTimeout(() => setShown(id), 0);
    const hide = setTimeout(() => setShown((s) => (s === id ? null : s)), ms);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [id, ms]);
  return visible ? <>{children}</> : null;
}

/** A buzz on phones that can. */
export function buzz(pattern: number | number[] = 18) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no vibration motor, no problem */
  }
}

/** A soft two-note "plink" for watering, synthesized so there's nothing to download. */
let audio: AudioContext | null = null;
export function plink(high = false) {
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return;
    audio ??= new AC();
    if (audio.state === "suspended") void audio.resume();
    const t = audio.currentTime;
    const notes: [number, number][] = high ? [[784, 0], [1046.5, 0.08], [1318.5, 0.16]] : [[587.33, 0], [880, 0.07]];
    for (const [freq, delay] of notes) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + delay);
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.08, t + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.35);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.4);
    }
  } catch {
    /* sound is a garnish */
  }
}
