"use client";

import { useEffect, useState } from "react";
import { Mark } from "@/components/mark";

/**
 * The launch film, second cut — /video-launch-v2.
 *
 * Same grammar as v1 (chaos first, arrive fast then freeze, slab cuts, one
 * idea per frame) but a longer, more cinematic story told entirely with
 * hand-animated product UI instead of the landing demos: a dashboard that
 * dollies in on parallax layers, a capture bar that types, a cursor that
 * stars and checks real-looking rows, a day that plans itself onto a
 * timeline, and a deterministic confetti burst when the day is won.
 *
 * The contract is unchanged: every visible property is a function of one
 * number, the current time. No CSS animations at all in this cut, which is
 * what lets `window.__seek` be exact without scrubbing anything.
 */

/* ----------------------------------------------------------------- easing */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
const expoOut = (x: number) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 - Math.pow(2, -10 * x));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const quintOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 5);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const seg = (t: number, from: number, dur: number) => clamp01((t - from) / dur);

/** A soft camera impulse: swells from zero, dies quietly. */
function impulse(t: number, at: number, span = 650): number {
  const x = (t - at) / span;
  if (x <= 0 || x > 2.5) return 0;
  return (x * Math.exp(-3 * x)) / 0.1226;
}

/** A pop with one small overshoot — for stars landing and checks filling. */
function popOut(x: number): number {
  const p = clamp01(x);
  if (p >= 1) return 1;
  const c = 1.70158 * 1.2;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
}

/* --------------------------------------------------------------- timeline */

const T = {
  chaos: 0, //         ink    a swarm of red, "Your day shouldn't feel like this."
  calm: 3400, //       paper  "There is a calmer way." — one quick breath
  intro: 4800, //             "Introducing" — a beat, not a hold
  reveal: 5700, //            mark + kairo + tagline, arriving with a bang
  dash: 8600, //              the dashboard dollies in
  capture: 13600, //          the capture bar types, AI files two tasks
  choose: 19600, //           the cursor stars what matters
  plan: 24600, //             times land on the day
  win: 29400, //              checks, ripples, confetti, "Day: won."
  m1: 35000, //        sun    AI capture.
  m2: 35850, //        ink    Fresh starts.
  m3: 36700, //        deep   Focus timer.
  m4: 37550, //        sky    Share with anyone.
  end: 38400, //       paper  Own your day.
};
export const DURATION = 43600;

/** Gentle camera swells, only where a landing deserves one. */
const KICKS: { at: number; amp: number }[] = [
  { at: T.reveal + 250, amp: 0.022 },
  { at: T.win + 2850, amp: 0.02 },
  { at: T.end + 500, amp: 0.012 },
];

/* ----------------------------------------------------------------- stage */

type Stage = { w: number; h: number; portrait: boolean };

function useStage(): Stage {
  const [stage, setStage] = useState<Stage>({ w: 1920, h: 1080, portrait: false });
  useEffect(() => {
    const read = () =>
      setStage({
        w: window.innerWidth,
        h: window.innerHeight,
        portrait: window.innerHeight > window.innerWidth,
      });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return stage;
}

/* ------------------------------------------------------------------ text */

type Word = { text: string; accent?: boolean };

function rise(lt: number, at: number, ms = 760, dist = 30): React.CSSProperties {
  const p = quintOut(seg(lt, at, ms));
  const f = easeOut(seg(lt, at, ms * 0.45));
  return { opacity: f, transform: `translateY(${lerp(dist, 0, p)}px)` };
}

function LineIn({
  lt,
  at,
  words,
  fontSize,
  color,
  riseMs = 780,
}: {
  lt: number;
  at: number;
  words: Word[];
  fontSize: number;
  color?: string;
  riseMs?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: fontSize * 0.24,
        rowGap: fontSize * 0.05,
      }}
    >
      {words.map((w, i) => (
        <span
          key={i}
          className={w.accent ? "font-display" : undefined}
          style={{
            fontSize,
            lineHeight: 1.1,
            fontWeight: w.accent ? 500 : 700,
            fontStyle: w.accent ? "italic" : undefined,
            letterSpacing: w.accent ? "-0.02em" : "-0.035em",
            color: color ?? "var(--color-ink)",
            display: "inline-block",
            whiteSpace: "pre",
            ...rise(lt, at + i * 70, riseMs, 0.5 * fontSize),
          }}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
}

function exitLift(lt: number, at: number): React.CSSProperties {
  const x = seg(lt, at, 240);
  if (x <= 0) return {};
  const p = x * x * x;
  return { opacity: 1 - p, transform: `translateY(${-46 * p}px)` };
}

/* ----------------------------------------------------------------- slabs */

function Slab({
  t,
  at,
  bg,
  from,
  wipeMs,
  children,
}: {
  t: number;
  at: number;
  bg: string;
  from: "left" | "right" | "circle";
  wipeMs?: number;
  children?: React.ReactNode;
}) {
  if (t < at) return null;
  if (from === "circle") {
    const p = easeInOut(seg(t, at, wipeMs ?? 750));
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: bg,
          clipPath: p < 1 ? `circle(${p * 150}% at 50% 50%)` : undefined,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    );
  }
  const p = expoOut(seg(t, at, wipeMs ?? 560));
  if (p <= 0) return null;
  const off = (from === "left" ? -1 : 1) * (1 - p) * 102;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: bg,
        transform: `translateX(${off}%)`,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------- atmosphere */

/**
 * Two soft gradient pools drifting very slowly behind the paper act. The
 * drift is felt as depth, not seen as motion, and its rate differs from the
 * camera's, which is what makes the parallax read.
 */
function GradientPools({ t, unit }: { t: number; unit: number }) {
  const drift1 = Math.sin((t / 16000) * Math.PI * 2);
  const drift2 = Math.cos((t / 21000) * Math.PI * 2);
  const pool = (
    x: string,
    y: string,
    size: number,
    color: string,
    dx: number,
    dy: number
  ): React.CSSProperties => ({
    position: "absolute",
    left: `calc(${x} - ${size / 2}px)`,
    top: `calc(${y} - ${size / 2}px)`,
    width: size,
    height: size,
    borderRadius: "50%",
    background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
    transform: `translate3d(${dx}px, ${dy}px, 0)`,
  });
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={pool("22%", "24%", 1250 * unit, "rgba(12,147,132,0.10)", drift1 * 26 * unit, drift2 * 18 * unit)} />
      <div style={pool("82%", "76%", 1100 * unit, "rgba(122,162,247,0.09)", drift2 * -22 * unit, drift1 * 24 * unit)} />
    </div>
  );
}

/** The neumorphic ring field from v1, for the reveal and the close. */
function RingField({
  t,
  cx,
  cy,
  unit,
  opacity = 1,
}: {
  t: number;
  cx: number;
  cy: number;
  unit: number;
  /** Faded by the caller: a background that pops in reads as a glitch. */
  opacity?: number;
}) {
  const RINGS = [1560, 1160, 800, 470];
  if (opacity <= 0) return null;
  return (
    <div aria-hidden style={{ position: "absolute", left: `${cx}%`, top: `${cy}%`, width: 0, height: 0, opacity }}>
      {RINGS.map((d, i) => {
        const breathe = 1 + 0.016 * Math.sin((t / 7400) * Math.PI * 2 + i * 1.1);
        const size = d * unit;
        const raised = i % 2 === 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: -size / 2,
              top: -size / 2,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "var(--color-paper)",
              transform: `scale(${breathe})`,
              boxShadow: raised
                ? `${-34 * unit}px ${-34 * unit}px ${76 * unit}px rgba(255,255,255,0.9), ${34 * unit}px ${34 * unit}px ${76 * unit}px rgba(28,38,36,0.075)`
                : `inset ${-26 * unit}px ${-26 * unit}px ${58 * unit}px rgba(255,255,255,0.85), inset ${26 * unit}px ${26 * unit}px ${58 * unit}px rgba(28,38,36,0.06)`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- cursor */

type Waypoint = { t: number; x: number; y: number };

/** Where the cursor is at lt, gliding between waypoints on an easeInOut. */
function cursorAt(lt: number, path: Waypoint[]): { x: number; y: number } {
  if (lt <= path[0].t) return path[0];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (lt <= b.t) {
      const p = easeInOut(seg(lt, a.t, b.t - a.t));
      return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) };
    }
  }
  return path[path.length - 1];
}

/**
 * The film's hand: a dark dot with a glass halo trailing a beat behind it,
 * pressing at its click moments. Coordinates are in the 480-wide design
 * space of whichever mock it is over.
 */
function Cursor({
  lt,
  path,
  clicks,
}: {
  lt: number;
  path: Waypoint[];
  clicks: number[];
}) {
  const pos = cursorAt(lt, path);
  const halo = cursorAt(Math.max(0, lt - 90), path);
  let press = 0;
  for (const c of clicks) {
    const x = (lt - c) / 260;
    if (x >= 0 && x <= 1) press = Math.max(press, Math.sin(x * Math.PI));
  }
  const inP = quintOut(seg(lt, path[0].t - 200, 500));
  return (
    <>
      {/* z-index 10: the rows carry their own z for the reorder shuffle, and
          a hand that slips underneath the thing it is clicking breaks the
          illusion completely */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: halo.x - 22,
          top: halo.y - 22,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(12,147,132,0.14)",
          border: "1px solid rgba(12,147,132,0.25)",
          opacity: inP,
          transform: `scale(${1 + press * 0.35})`,
          zIndex: 10,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: pos.x - 9,
          top: pos.y - 9,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "var(--color-ink)",
          border: "2.5px solid #fff",
          boxShadow: "0 4px 14px rgba(28,38,36,0.35)",
          opacity: inP,
          transform: `scale(${1 - press * 0.25})`,
          zIndex: 10,
        }}
      />
    </>
  );
}

/* ---------------------------------------------------------------- UI kit */

/** Everything product-shaped lives in a 480-wide design space, then zooms. */
const CARD_W = 480;

function Shell({
  children,
  pad = 22,
}: {
  children: React.ReactNode;
  pad?: number;
}) {
  return (
    <div
      style={{
        width: CARD_W,
        borderRadius: 26,
        background: "var(--color-paper)",
        boxShadow:
          "0 30px 80px rgba(28,38,36,0.17), 0 8px 22px rgba(28,38,36,0.08)",
        padding: pad,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function ChipUI({
  children,
  tone = "neutral",
  style,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "sun" | "sky" | "lilac";
  style?: React.CSSProperties;
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: "rgba(28,38,36,0.06)", fg: "var(--color-ink-soft)" },
    sun: { bg: "rgba(12,147,132,0.12)", fg: "var(--color-sun-deep)" },
    sky: { bg: "rgba(122,162,247,0.16)", fg: "#4b6cc9" },
    lilac: { bg: "rgba(178,148,235,0.16)", fg: "#7c5fc9" },
  };
  const c = tones[tone];
  return (
    <span
      style={{
        display: "inline-block",
        borderRadius: 7,
        padding: "3px 8px",
        fontSize: 11.5,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** A task row in the film's design language, controlled entirely by props. */
function RowUI({
  title,
  chips,
  done,
  checkP = 0,
  starP = 0,
  lift,
  y = 0,
  opacity = 1,
  highlight = 0,
}: {
  title: string;
  /** `p` makes a chip pop in on cue; its width is reserved from the start. */
  chips: { label: string; tone?: "neutral" | "sun" | "sky" | "lilac"; p?: number }[];
  done?: boolean;
  /** 0..1 pop of the check filling in. */
  checkP?: number;
  /** 0..1 pop of the spotlight star. */
  starP?: number;
  /** Row elevation while it is being moved. */
  lift?: number;
  y?: number;
  opacity?: number;
  highlight?: number;
}) {
  const checked = done || checkP > 0.02;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderRadius: 16,
        background: "#fff",
        border: `1.5px solid ${
          highlight > 0.02 ? `rgba(12,147,132,${0.55 * highlight})` : "rgba(28,38,36,0.09)"
        }`,
        boxShadow: lift
          ? `0 ${14 * lift}px ${34 * lift}px rgba(28,38,36,${0.16 * lift})`
          : "0 1.5px 5px rgba(28,38,36,0.05)",
        padding: "12px 14px",
        transform: `translateY(${y}px) scale(${1 + (lift ?? 0) * 0.02})`,
        opacity,
        position: "relative",
      }}
    >
      <span
        style={{
          width: 21,
          height: 21,
          borderRadius: "50%",
          flexShrink: 0,
          border: `2px solid ${checked ? "var(--color-moss, #5a9a68)" : "rgba(28,38,36,0.35)"}`,
          background: checked ? "var(--color-moss, #5a9a68)" : "transparent",
          display: "grid",
          placeItems: "center",
          transform: `scale(${checkP > 0 ? popOut(checkP) : 1})`,
        }}
      >
        {checked && (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.5L5 9l4.5-5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 15.5,
          fontWeight: 500,
          color: checked ? "rgba(28,38,36,0.42)" : "var(--color-ink)",
          textDecoration: checked ? "line-through" : undefined,
          textDecorationColor: "rgba(28,38,36,0.35)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </span>
      {starP > 0.02 && (
        <span
          style={{
            color: "var(--color-sun)",
            transform: `scale(${popOut(starP)}) rotate(${lerp(-80, 0, popOut(starP))}deg)`,
            display: "inline-flex",
            flexShrink: 0,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 1.5l2.47 5.29 5.8.62-4.32 3.92 1.18 5.71L10 14.1l-5.13 2.94 1.18-5.71-4.32-3.92 5.8-.62L10 1.5z" />
          </svg>
        </span>
      )}
      <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {chips.map((c, i) => (
          <ChipUI
            key={i}
            tone={c.tone}
            style={
              c.p !== undefined
                ? { opacity: clamp01(c.p * 2), transform: `scale(${popOut(c.p)})` }
                : undefined
            }
          >
            {c.label}
          </ChipUI>
        ))}
      </span>
    </div>
  );
}

/** An expanding tap ripple, spent in 700ms. */
function Ripple({ lt, at, x, y }: { lt: number; at: number; x: number; y: number }) {
  const p = seg(lt, at, 700);
  if (p <= 0 || p >= 1) return null;
  const size = lerp(20, 130, easeOut(p));
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid rgba(90,154,104,${0.5 * (1 - p)})`,
      }}
    />
  );
}

/* -------------------------------------------------------------- confetti */

/** Deterministic burst: every particle's flight is a pure function of lt. */
const CONFETTI = Array.from({ length: 30 }, (_, i) => {
  const r1 = Math.abs(Math.sin(i * 127.1 + 311.7)) % 1;
  const r2 = Math.abs(Math.sin(i * 269.5 + 183.3)) % 1;
  const r3 = Math.abs(Math.sin(i * 419.2 + 371.9)) % 1;
  const angle = -Math.PI / 2 + (r1 - 0.5) * 1.9;
  const speed = 340 + r2 * 420;
  return {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    spin: (r3 - 0.5) * 900,
    size: 6 + r2 * 7,
    color: ["var(--color-sun)", "#d96354", "#7aa2f7", "#b294eb", "#5a9a68"][i % 5],
    shape: i % 3,
  };
});

function Confetti({ lt, at, ox, oy }: { lt: number; at: number; ox: number; oy: number }) {
  const tt = (lt - at) / 1000;
  if (tt <= 0 || tt > 1.9) return null;
  const fade = 1 - clamp01((tt - 1.1) / 0.8);
  return (
    <div aria-hidden style={{ position: "absolute", left: ox, top: oy, width: 0, height: 0 }}>
      {CONFETTI.map((c, i) => {
        const x = c.vx * tt;
        const y = c.vy * tt + 0.5 * 1350 * tt * tt;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: c.size,
              height: c.shape === 0 ? c.size : c.size * 0.45,
              borderRadius: c.shape === 2 ? "50%" : 2,
              background: c.color,
              opacity: fade,
              transform: `rotate(${c.spin * tt}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------- chaos cards */

/** The mess: real-sounding tasks drifting in the dark, none of them done. */
const CHAOS = [
  { text: "Finish the deck!!", top: "16%", left: "9%", tilt: -7, depth: 0.7, badge: "overdue 4d", hot: true },
  { text: "Reply to 47 emails", top: "64%", left: "10%", tilt: 5, depth: 1, badge: "today??" },
  { text: "Call the bank", top: "23%", left: "66%", tilt: 6, depth: 0.85, badge: "missed", hot: true },
  { text: "URGENT: invoices", top: "70%", left: "63%", tilt: -5, depth: 0.6, badge: "overdue 12d", hot: true },
  { text: "Gym (lol)", top: "44%", left: "80%", tilt: 8, depth: 1.15, badge: "skipped x9" },
  { text: "Plan the sprint", top: "8%", left: "40%", tilt: -4, depth: 0.9, badge: "overdue" },
  { text: "Mom's birthday gift", top: "80%", left: "36%", tilt: 4, depth: 1.25, badge: "3 apps ago" },
  { text: "Taxes. Actual taxes.", top: "36%", left: "22%", tilt: -6, depth: 0.65, badge: "overdue 30d", hot: true },
  { text: "Renew the domain", top: "54%", left: "58%", tilt: 5, depth: 0.75, badge: "expired!", hot: true },
];

/** The swarm: red notification counts raining in like a bad Monday. */
const RED_BADGES = [
  { top: "10%", left: "27%", text: "12", size: 54, at: 260 },
  { top: "31%", left: "13%", text: "4", size: 44, at: 420 },
  { top: "18%", left: "85%", text: "47", size: 64, at: 340 },
  { top: "58%", left: "89%", text: "9+", size: 46, at: 560 },
  { top: "77%", left: "21%", text: "!!", size: 50, at: 500 },
  { top: "87%", left: "75%", text: "31", size: 58, at: 640 },
  { top: "6%", left: "59%", text: "8", size: 40, at: 700 },
  { top: "43%", left: "5%", text: "22", size: 48, at: 760 },
  { top: "67%", left: "46%", text: "5", size: 42, at: 820 },
  { top: "28%", left: "45%", text: "99+", size: 52, at: 880 },
];

function ChaosField({ t, unit }: { t: number; unit: number }) {
  return (
    <>
      {CHAOS.map((c, i) => {
        const inP = quintOut(seg(t, 200 + i * 90, 650));
        const driftX = Math.sin((t / 5200) * Math.PI * 2 + i * 1.7) * 10 * c.depth * unit;
        const driftY = Math.cos((t / 6200) * Math.PI * 2 + i * 2.3) * 12 * c.depth * unit;
        const blur = c.depth < 0.8 ? 2.5 : 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: c.top,
              left: c.left,
              transform: `translate3d(${driftX}px, ${driftY + lerp(40 * unit, 0, inP)}px, 0) rotate(${c.tilt}deg) scale(${c.depth < 0.8 ? 0.82 : c.depth > 1.1 ? 1.1 : 1})`,
              opacity: inP * (c.depth < 0.8 ? 0.55 : 0.9),
              filter: blur ? `blur(${blur}px)` : undefined,
            }}
          >
            <div
              style={{
                borderRadius: 14 * unit,
                background: c.hot ? "rgba(217,99,84,0.16)" : "rgba(244,247,246,0.09)",
                border: c.hot ? "1px solid rgba(217,99,84,0.45)" : "1px solid rgba(244,247,246,0.14)",
                boxShadow: c.hot ? `0 0 ${34 * unit}px rgba(217,99,84,0.2)` : undefined,
                padding: `${13 * unit}px ${18 * unit}px`,
                display: "flex",
                alignItems: "center",
                gap: 12 * unit,
              }}
            >
              <span
                style={{
                  width: 17 * unit,
                  height: 17 * unit,
                  borderRadius: "50%",
                  border: `2px solid ${c.hot ? "rgba(217,99,84,0.7)" : "rgba(244,247,246,0.4)"}`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 19 * unit, fontWeight: 600, color: "rgba(244,247,246,0.85)", whiteSpace: "nowrap" }}>
                {c.text}
              </span>
              <span
                style={{
                  fontSize: 12.5 * unit,
                  fontWeight: 700,
                  color: "#fff",
                  background: "var(--color-clay)",
                  borderRadius: 7 * unit,
                  padding: `${3 * unit}px ${8 * unit}px`,
                  whiteSpace: "nowrap",
                }}
              >
                {c.badge}
              </span>
            </div>
          </div>
        );
      })}

      {RED_BADGES.map((b, i) => {
        const p = popOut(seg(t, b.at, 420));
        if (p <= 0) return null;
        const driftX = Math.sin((t / 4600) * Math.PI * 2 + i * 2.1) * 8 * unit;
        const driftY = Math.cos((t / 5400) * Math.PI * 2 + i * 1.3) * 10 * unit;
        // a slow angry pulse, out of phase per badge so the field shimmers red
        const pulse = 1 + 0.05 * Math.sin((t / 900) * Math.PI * 2 + i * 1.9);
        return (
          <div
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              top: b.top,
              left: b.left,
              width: b.size * unit,
              height: b.size * unit,
              borderRadius: "50%",
              background: "var(--color-clay)",
              display: "grid",
              placeItems: "center",
              transform: `translate3d(${driftX}px, ${driftY}px, 0) scale(${p * pulse})`,
              boxShadow: `0 0 ${26 * unit}px rgba(217,99,84,0.45)`,
            }}
          >
            <span style={{ fontSize: b.size * 0.42 * unit, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
              {b.text}
            </span>
          </div>
        );
      })}
    </>
  );
}

/* --------------------------------------------------------------- scene UI */

/** Scene: the dashboard. Rows arrive staggered under a Today header. */
function DashboardUI({ lt }: { lt: number }) {
  const rows = [
    { title: "Ship the pricing page", chips: [{ label: "10 AM", tone: "sun" as const }, { label: "~1h 30m" }] },
    { title: "Review the design handoff", chips: [{ label: "2 PM", tone: "sun" as const }, { label: "~45m" }] },
    { title: "Call the electrician", chips: [{ label: "5:30 PM", tone: "sun" as const }, { label: "~10m" }] },
    { title: "Evening run, 5k", chips: [{ label: "7 PM", tone: "sun" as const }, { label: "~40m" }] },
  ];
  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", ...rise(lt, 150, 700, 18) }}>
        <span className="font-display" style={{ fontSize: 30, letterSpacing: "-0.02em" }}>
          Today
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(28,38,36,0.45)" }}>Monday, 3 Aug</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: "var(--color-sun-deep)", ...rise(lt, 320, 700, 12) }}>
        holds ~3h 05m · fits
      </div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.map((r, i) => {
          const p = quintOut(seg(lt, 420 + i * 150, 800));
          return (
            <div key={i} style={{ opacity: easeOut(seg(lt, 420 + i * 150, 400)), transform: `translateY(${lerp(26, 0, p)}px)` }}>
              <RowUI title={r.title} chips={r.chips} />
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/** Scene: capture. A sentence types itself; the AI files two tasks. */
const SENTENCE = "call the bank tomorrow at 11 and gym today at 7";
const TYPE_START = 500;
const TYPE_MS = 1900;
const THINK_AT = TYPE_START + TYPE_MS + 300;
const FILED_AT = THINK_AT + 750;

function CaptureUI({ lt }: { lt: number }) {
  const typedChars = Math.floor(easeInOut(seg(lt, TYPE_START, TYPE_MS)) * SENTENCE.length);
  const typed = SENTENCE.slice(0, typedChars);
  const caretOn = lt < THINK_AT && Math.floor(lt / 430) % 2 === 0;
  const thinking = lt >= THINK_AT && lt < FILED_AT;
  const filed = lt >= FILED_AT;
  return (
    <Shell>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderRadius: 16,
          border: `1.5px solid ${filed ? "rgba(28,38,36,0.1)" : "var(--color-sun)"}`,
          background: "#fff",
          padding: "14px 16px",
          boxShadow: filed ? undefined : "0 0 0 4px rgba(12,147,132,0.1)",
          ...rise(lt, 100, 700, 20),
        }}
      >
        <span style={{ color: "var(--color-sun)", flexShrink: 0, display: "inline-flex" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2c.7 5.2 4.8 9.3 10 10-5.2.7-9.3 4.8-10 10-.7-5.2-4.8-9.3-10-10 5.2-.7 9.3-4.8 10-10z" />
          </svg>
        </span>
        <span style={{ fontSize: 15, fontWeight: 500, color: typed ? "var(--color-ink)" : "rgba(28,38,36,0.35)", whiteSpace: "nowrap", overflow: "hidden" }}>
          {typed || "What needs doing?"}
          {caretOn && typedChars > 0 && (
            <span style={{ display: "inline-block", width: 2, height: 16, background: "var(--color-sun)", marginLeft: 1, verticalAlign: "-2.5px" }} />
          )}
        </span>
      </div>

      {thinking && (
        <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--color-sun-deep)", display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              border: "2px solid rgba(12,147,132,0.25)",
              borderTopColor: "var(--color-sun)",
              display: "inline-block",
              transform: `rotate(${(lt - THINK_AT) * 0.55}deg)`,
            }}
          />
          filing two tasks
        </div>
      )}

      {filed && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
          {[
            { title: "Call the bank", chips: [{ label: "Tomorrow 11 AM", tone: "sun" as const }, { label: "Errands", tone: "lilac" as const }] },
            { title: "Gym session", chips: [{ label: "Today 7 PM", tone: "sun" as const }, { label: "~1h" }, { label: "Fitness", tone: "sky" as const }] },
          ].map((r, i) => {
            const p = quintOut(seg(lt, FILED_AT + i * 180, 750));
            return (
              <div key={i} style={{ opacity: easeOut(seg(lt, FILED_AT + i * 180, 380)), transform: `translateY(${lerp(24, 0, p)}px) scale(${lerp(0.97, 1, p)})` }}>
                <RowUI title={r.title} chips={r.chips} />
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

/** Scene: choose. The cursor stars two rows; the starred rise to the top. */
const CHOOSE_ROWS = [
  { title: "Clear the inbox", chips: [{ label: "~20m" }] },
  { title: "Write the launch post", chips: [{ label: "~1h" }] },
  { title: "Book flights for Goa", chips: [{ label: "~15m" }] },
];
const STAR1 = 1100; // launch post
const SWAP1 = STAR1 + 380;
const STAR2 = 2450; // flights
const ROW_H = 57;

function ChooseUI({ lt }: { lt: number }) {
  const star1 = popOut(seg(lt, STAR1, 500));
  const star2 = popOut(seg(lt, STAR2, 500));
  const swap = quintOut(seg(lt, SWAP1, 650));
  // row 1 rises to slot 0, row 0 steps down to slot 1
  const yFor = (i: number) => (i === 0 ? swap * ROW_H : i === 1 ? -swap * ROW_H : 0);
  const cursorPath: Waypoint[] = [
    { t: 250, x: 430, y: 150 },
    { t: 950, x: 404, y: ROW_H + 51 },
    { t: STAR1 + 420, x: 404, y: ROW_H + 51 },
    { t: STAR1 + 480, x: 404, y: 51 },
    { t: 2250, x: 404, y: 2 * ROW_H + 51 },
    { t: STAR2 + 550, x: 404, y: 2 * ROW_H + 51 },
    // exits through the right edge at row height, never under the card
    { t: STAR2 + 1000, x: 560, y: 2 * ROW_H + 30 },
  ];
  return (
    <Shell>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(28,38,36,0.4)", ...rise(lt, 100, 650, 12) }}>
        Spotlight, pick three
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9, position: "relative" }}>
        {CHOOSE_ROWS.map((r, i) => {
          const p = quintOut(seg(lt, 200 + i * 120, 700));
          const starP = i === 1 ? star1 : i === 2 ? star2 : 0;
          const lifting = i === 1 ? Math.sin(clamp01((lt - SWAP1) / 650) * Math.PI) : 0;
          return (
            <div key={i} style={{ opacity: easeOut(seg(lt, 200 + i * 120, 380)), transform: `translateY(${lerp(22, 0, p)}px)`, position: "relative", zIndex: i === 1 ? 2 : 1 }}>
              <RowUI title={r.title} chips={r.chips} starP={starP} y={yFor(i)} lift={lifting} highlight={i === 1 ? Math.max(0, star1 - swap) : 0} />
            </div>
          );
        })}
        <Cursor lt={lt} path={cursorPath} clicks={[STAR1, STAR2]} />
      </div>
    </Shell>
  );
}

/**
 * Scene: plan, in the product's own language. The rows are already there;
 * planning is times landing on them one by one while the Today header's
 * capacity line counts up, and the day answers with "fits ✓" — the exact
 * header every Kairo user reads each morning.
 */
const PLAN_ROWS = [
  { title: "Deep work on the deck", est: "~2h", time: "9 AM", rowAt: 250, timeAt: 1450 },
  { title: "Review the handoff", est: "~45m", time: "2 PM", rowAt: 430, timeAt: 1950 },
  { title: "Evening run, 5k", est: "~40m", time: "7 PM", rowAt: 610, timeAt: 2450 },
];
const HOLDS = [
  { at: 1450, text: "holds ~2h" },
  { at: 1950, text: "holds ~2h 45m" },
  { at: 2450, text: "holds ~3h 25m" },
];
const FITS_AT = 3050;

function PlanUI({ lt }: { lt: number }) {
  const holds = [...HOLDS].reverse().find((h) => lt >= h.at);
  const fitsP = popOut(seg(lt, FITS_AT, 500));
  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", ...rise(lt, 100, 650, 16) }}>
        <span className="font-display" style={{ fontSize: 30, letterSpacing: "-0.02em" }}>
          Today
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(28,38,36,0.45)" }}>Monday, 3 Aug</span>
      </div>
      <div style={{ marginTop: 4, minHeight: 18, fontSize: 12, fontWeight: 600, color: "rgba(28,38,36,0.45)", display: "flex", alignItems: "center", gap: 6 }}>
        {holds && <span key={holds.at}>{holds.text}</span>}
        {lt >= FITS_AT && (
          <span
            style={{
              color: "var(--color-sun-deep)",
              display: "inline-block",
              opacity: clamp01(fitsP * 2),
              transform: `scale(${fitsP})`,
            }}
          >
            · fits ✓
          </span>
        )}
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9, position: "relative" }}>
        {PLAN_ROWS.map((r, i) => {
          const p = quintOut(seg(lt, r.rowAt, 750));
          return (
            <div key={i} style={{ opacity: easeOut(seg(lt, r.rowAt, 380)), transform: `translateY(${lerp(24, 0, p)}px)` }}>
              <RowUI
                title={r.title}
                chips={[
                  { label: r.time, tone: "sun", p: seg(lt, r.timeAt, 450) },
                  { label: r.est },
                ]}
              />
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/** Scene: win. Checks land one by one, then the day celebrates. */
const WIN_ROWS = [
  { title: "Deep work: the deck", chips: [{ label: "~2h" }] },
  { title: "Write the launch post", chips: [{ label: "~1h" }] },
  { title: "Gym session", chips: [{ label: "~40m" }] },
];
const CHECKS = [700, 1450, 2200];
const WON_AT = 2850;

function WinUI({ lt }: { lt: number }) {
  const cursorPath: Waypoint[] = [
    { t: 200, x: 440, y: 30 },
    { t: 620, x: 36, y: 30 },
    { t: 1050, x: 36, y: 30 + ROW_H },
    { t: 1400, x: 36, y: 30 + ROW_H },
    { t: 1800, x: 36, y: 30 + 2 * ROW_H },
    { t: 2150, x: 36, y: 30 + 2 * ROW_H },
    // done with its work, the hand leaves the frame before the celebration
    { t: 2800, x: 540, y: 30 + 2 * ROW_H },
  ];
  const wonP = popOut(seg(lt, WON_AT, 650));
  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, position: "relative" }}>
        {WIN_ROWS.map((r, i) => {
          const checkP = seg(lt, CHECKS[i], 420);
          return (
            <div key={i} style={{ position: "relative" }}>
              <RowUI title={r.title} chips={r.chips} checkP={checkP} />
              <Ripple lt={lt} at={CHECKS[i]} x={25} y={23} />
            </div>
          );
        })}
        <Cursor lt={lt} path={cursorPath} clicks={CHECKS} />
        {/* bursts from among the finished rows, clear of the Day: won line */}
        <Confetti lt={lt} at={WON_AT + 120} ox={CARD_W / 2 - 22} oy={2 * ROW_H - 20} />
      </div>
      {lt >= WON_AT && (
        <div
          style={{
            marginTop: 16,
            textAlign: "center",
            transform: `scale(${Math.max(0.001, wonP)})`,
          }}
        >
          <span
            className="font-display"
            style={{ fontSize: 30, fontStyle: "italic", letterSpacing: "-0.02em", color: "var(--color-sun-deep)" }}
          >
            Day: won.
          </span>
        </div>
      )}
    </Shell>
  );
}

/* -------------------------------------------------------------- features */

type Feature = {
  start: number;
  dur: number;
  ui: (lt: number) => React.ReactNode;
  tilt: number;
  head: Word[];
  sub: string;
  /** Optional shot choreography: replaces the default dolly-in. */
  zoom?: (lt: number) => { scale: number; origin: string };
};

const FEATURES: Feature[] = [
  {
    start: T.dash,
    dur: T.capture - T.dash,
    ui: (lt) => <DashboardUI lt={lt} />,
    tilt: -1.2,
    head: [{ text: "Your whole day, " }, { text: "on one page.", accent: true }],
    sub: "A short list you chose. Never the endless backlog.",
    // opens tight on the header, pulls back to reveal the day
    zoom: (lt) => ({ scale: lerp(1.2, 1, quintOut(seg(lt, 200, 1500))), origin: "50% 26%" }),
  },
  {
    start: T.capture,
    dur: T.choose - T.capture,
    ui: (lt) => <CaptureUI lt={lt} />,
    tilt: 1.2,
    head: [{ text: "Capture " }, { text: "everything.", accent: true }],
    sub: "Type it the way you'd say it. AI fills the rest.",
  },
  {
    start: T.choose,
    dur: T.plan - T.choose,
    ui: (lt) => <ChooseUI lt={lt} />,
    tilt: -1.2,
    head: [{ text: "Choose " }, { text: "what matters.", accent: true }],
    sub: "Three real wins beat thirty maybes.",
  },
  {
    start: T.plan,
    dur: T.win - T.plan,
    ui: (lt) => <PlanUI lt={lt} />,
    tilt: 1.2,
    head: [{ text: "Plan " }, { text: "your day.", accent: true }],
    sub: "Give each thing a time. The day says if it fits.",
    // pushes in on the capacity line for the "fits" verdict
    zoom: (lt) => ({ scale: 1 + 0.13 * quintOut(seg(lt, 2900, 850)), origin: "50% 30%" }),
  },
  {
    start: T.win,
    dur: T.m1 - T.win - 300,
    ui: (lt) => <WinUI lt={lt} />,
    tilt: -1.2,
    head: [{ text: "Finish, " }, { text: "and feel it.", accent: true }],
    sub: "Done feels like something here.",
  },
];

const MONTAGE = [
  { start: T.m1, dur: T.m2 - T.m1, bg: "var(--color-sun)", text: "AI capture." },
  { start: T.m2, dur: T.m3 - T.m2, bg: "var(--color-ink)", text: "Fresh starts." },
  { start: T.m3, dur: T.m4 - T.m3, bg: "var(--color-sun-deep)", text: "Focus timer." },
  { start: T.m4, dur: T.end - T.m4, bg: "#4b6cc9", text: "Share with anyone." },
];

/* ------------------------------------------------------------------- film */

export function VideoLaunchFilmV2() {
  const stage = useStage();
  const [t, setT] = useState(0);

  useEffect(() => {
    const w = window as unknown as {
      __seek?: (ms: number) => Promise<void>;
      __duration?: number;
      __ready?: boolean;
    };
    const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

    let raf = 0;
    let driven = false;
    const t0 = performance.now();
    const freeRun = (now: number) => {
      if (driven) return;
      setT((now - t0) % DURATION);
      raf = requestAnimationFrame(freeRun);
    };
    raf = requestAnimationFrame(freeRun);

    w.__duration = DURATION;
    // no CSS animations in this cut, so a seek is just a state set + paint
    w.__seek = async (ms: number) => {
      driven = true;
      cancelAnimationFrame(raf);
      setT(ms);
      await nextFrame();
      await nextFrame();
    };
    w.__ready = true;
    return () => {
      driven = true;
      cancelAnimationFrame(raf);
      delete w.__seek;
      delete w.__ready;
    };
  }, []);

  const unit = stage.portrait ? stage.w / 1080 : stage.w / 1920;
  const { portrait } = stage;

  /* the camera: one slow push over the film, soft swells on big landings */
  let kick = 0;
  for (const k of KICKS) kick += k.amp * impulse(t, k.at);
  const camera = lerp(1, 1.05, easeInOut(t / DURATION)) + kick;

  const headSize = (portrait ? 78 : 88) * unit;
  const slabSize = (portrait ? 100 : 122) * unit;
  const mockScale = (portrait ? stage.w * 0.78 : stage.w * 0.3) / CARD_W;

  const markP = quintOut(seg(t, T.reveal + 60, 600));
  const eMark = quintOut(seg(t, T.end + 250, 850));

  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        position: "relative",
        background: "var(--color-ink)",
        color: "var(--color-ink)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, transform: `scale(${camera})`, transformOrigin: "center 48%" }}>
        {/* ---------------------------------------------- 1 · chaos (ink) */}
        {t < T.calm + 700 && (
          <div style={{ position: "absolute", inset: 0, background: "var(--color-ink)" }}>
            <div style={{ position: "absolute", inset: 0, ...exitLift(t, T.calm - 300) }}>
              <ChaosField t={t} unit={unit} />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  padding: "0 8%",
                  background: "radial-gradient(circle at 50% 50%, rgba(20,25,23,0.25) 0%, rgba(20,25,23,0.86) 72%)",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <LineIn
                    lt={t}
                    at={850}
                    words={[{ text: "Your day shouldn't" }]}
                    fontSize={headSize * 1.04}
                    color="var(--color-paper)"
                    riseMs={620}
                  />
                  <div style={{ height: 8 * unit }} />
                  <LineIn
                    lt={t}
                    at={1150}
                    words={[{ text: "feel like " }, { text: "this.", accent: true }]}
                    fontSize={headSize * 1.04}
                    color="var(--color-paper)"
                    riseMs={620}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------- 2 · the paper act */}
        {t >= T.calm - 600 && t < T.m1 + 700 && (
          <Slab t={t} at={T.calm - 560} bg="var(--color-paper)" from="right">
            <GradientPools t={t} unit={unit} />
            {t >= T.reveal - 1200 && t < T.dash + 1000 && (
              <RingField
                t={t}
                cx={portrait ? 50 : 58}
                cy={portrait ? 42 : 46}
                unit={unit}
                // breathes in through the Introducing hold, breathes out as
                // the dashboard arrives — never a hard cut in the background
                opacity={
                  easeInOut(seg(t, T.reveal - 1200, 1100)) *
                  (1 - easeInOut(seg(t, T.dash + 100, 800)))
                }
              />
            )}

            {/* the calmer way */}
            {t < T.intro + 400 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  padding: "0 8%",
                  ...exitLift(t, T.intro - 280),
                }}
              >
                <div style={{ textAlign: "center", maxWidth: portrait ? "96%" : "78%" }}>
                  <LineIn lt={t} at={T.calm} words={[{ text: "There is a" }]} fontSize={headSize * 1.06} riseMs={600} />
                  <div style={{ height: 8 * unit }} />
                  <LineIn
                    lt={t}
                    at={T.calm + 180}
                    words={[{ text: "calmer way ", accent: true }, { text: "to plan." }]}
                    fontSize={headSize * 1.06}
                    riseMs={600}
                  />
                </div>
              </div>
            )}

            {/* the held breath */}
            {t >= T.intro - 100 && t < T.reveal + 400 && (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", ...exitLift(t, T.reveal - 280) }}>
                <LineIn lt={t} at={T.intro} words={[{ text: "Introducing", accent: true }]} fontSize={headSize * 0.92} riseMs={480} />
              </div>
            )}

            {/* the reveal */}
            {t >= T.reveal - 100 && t < T.dash + 400 && (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", ...exitLift(t, T.dash - 280) }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 * unit }}>
                    <span
                      style={{
                        color: "var(--color-sun)",
                        transform: `scale(${Math.max(0.001, markP)}) rotate(${lerp(-100, 0, markP)}deg)`,
                        display: "inline-flex",
                      }}
                    >
                      <Mark size={(portrait ? 96 : 106) * unit} />
                    </span>
                    <span
                      className="font-display"
                      style={{
                        fontSize: (portrait ? 104 : 116) * unit,
                        letterSpacing: "-0.03em",
                        display: "inline-block",
                        ...rise(t, T.reveal + 200, 620, 34),
                      }}
                    >
                      kairo
                    </span>
                  </div>
                  <p
                    style={{
                      marginTop: 24 * unit,
                      fontSize: (portrait ? 40 : 36) * unit,
                      fontWeight: 500,
                      color: "var(--color-ink-soft)",
                      ...rise(t, T.reveal + 480, 640, 26),
                    }}
                  >
                    A daily planner that forgives.
                  </p>
                </div>
              </div>
            )}

            {/* the product story: headline above, the living mock below */}
            {FEATURES.map((f, i) => {
              if (t < f.start - 100 || t > f.start + f.dur + 400) return null;
              const lt = t - f.start;
              const cardP = quintOut(seg(lt, 320, 950));
              // each shot begins a breath closer and settles back: the dolly.
              // a scene with its own zoom choreography takes the wheel instead.
              const shot = f.zoom
                ? f.zoom(lt)
                : { scale: lerp(1.05, 1, quintOut(seg(lt, 0, 1250))), origin: "center 48%" };
              // merged, not spread: the exit's translate must compose with the
              // shot's zoom, or a zoomed scene would snap flat as it leaves
              const exit = exitLift(lt, f.dur - 280);
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: portrait ? 40 * unit : 34 * unit,
                    padding: portrait ? "0 5%" : "0 8%",
                    opacity: exit.opacity,
                    transform: `${exit.transform ?? ""} scale(${shot.scale})`,
                    transformOrigin: shot.origin,
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <LineIn lt={lt} at={0} words={f.head} fontSize={headSize} />
                    <p
                      style={{
                        marginTop: 14 * unit,
                        fontSize: headSize * 0.36,
                        fontWeight: 500,
                        color: "var(--color-ink-soft)",
                        ...rise(lt, 900, 760, 20),
                      }}
                    >
                      {f.sub}
                    </p>
                  </div>
                  <div
                    style={{
                      opacity: clamp01(cardP * 1.6),
                      transform: `translateY(${lerp(110 * unit, 0, cardP)}px) scale(${lerp(0.96, 1, cardP)}) rotate(${f.tilt * cardP}deg)`,
                    }}
                  >
                    <div style={{ width: CARD_W, zoom: mockScale }}>{f.ui(lt)}</div>
                  </div>
                </div>
              );
            })}
          </Slab>
        )}

        {/* --------------------------------------- 3 · the montage (slabs) */}
        {MONTAGE.map((m, i) => {
          if (t < m.start - 100 || t > m.start + m.dur + 700) return null;
          return (
            <Slab key={i} t={t} at={m.start} bg={m.bg} from="circle" wipeMs={500}>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: "0 6%" }}>
                <LineIn lt={t - m.start} at={90} words={[{ text: m.text }]} fontSize={slabSize} color="#fff" riseMs={500} />
              </div>
            </Slab>
          );
        })}

        {/* ----------------------------------------------- 4 · end (paper) */}
        {t >= T.end - 100 && (
          <Slab t={t} at={T.end} bg="var(--color-paper)" from="circle" wipeMs={800}>
            <RingField t={t} cx={50} cy={portrait ? 44 : 46} unit={unit} />
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 * unit }}>
                  <span
                    style={{
                      color: "var(--color-sun)",
                      transform: `scale(${Math.max(0.001, eMark)}) rotate(${lerp(-100, 0, eMark)}deg)`,
                      display: "inline-flex",
                    }}
                  >
                    <Mark size={(portrait ? 80 : 88) * unit} />
                  </span>
                  <span
                    className="font-display"
                    style={{
                      fontSize: (portrait ? 88 : 96) * unit,
                      letterSpacing: "-0.03em",
                      display: "inline-block",
                      ...rise(t, T.end + 450, 780, 30),
                    }}
                  >
                    kairo
                  </span>
                </div>
                <div style={{ marginTop: 26 * unit }}>
                  <LineIn
                    lt={t}
                    at={T.end + 850}
                    words={[{ text: "Own " }, { text: "your day.", accent: true }]}
                    fontSize={(portrait ? 64 : 58) * unit}
                  />
                </div>
                <div
                  style={{
                    marginTop: 38 * unit,
                    background: "var(--color-ink)",
                    color: "var(--color-paper)",
                    borderRadius: 999,
                    padding: `${18 * unit}px ${44 * unit}px`,
                    fontSize: (portrait ? 34 : 30) * unit,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    ...rise(t, T.end + 1450, 780, 26),
                    display: "inline-block",
                  }}
                >
                  Start planning today
                </div>
                <p
                  style={{
                    marginTop: 20 * unit,
                    fontSize: (portrait ? 30 : 26) * unit,
                    fontWeight: 600,
                    color: "var(--color-ink-soft)",
                    ...rise(t, T.end + 1750, 780, 20),
                  }}
                >
                  kairo.jaimansoni.com
                </p>
              </div>
            </div>
          </Slab>
        )}
      </div>
    </div>
  );
}
