"use client";

import { useEffect, useRef, useState } from "react";
import { Mark } from "@/components/mark";

/**
 * The 250-tasks milestone film — /video-milestone.
 *
 * Ten seconds, square, one idea: tasks arriving. They start as a slow
 * heartbeat you can read, then accelerate into a blur of a stack that
 * outruns the eye, and the whole pile collapses into the number it earned.
 *
 * Same contract as the launch films: every visible property is a function of
 * one number, the current time, so `window.__seek(ms)` can photograph any
 * instant exactly. No CSS animations anywhere in this file.
 *
 * The light palette is hardcoded rather than read from CSS variables — this
 * is a video, and it must not change colour because the viewer's laptop is
 * in dark mode.
 */

/* ------------------------------------------------------------------ paint */

const C = {
  paper: "#f4f7f6",
  paperDeep: "#e8eeec",
  card: "#ffffff",
  ink: "#1c2624",
  inkSoft: "#54655f",
  inkFaint: "#93a39d",
  line: "#dfe7e4",
  sun: "#0c9384",
  sunDeep: "#076b60",
  sunSoft: "#ddf1ee",
  moss: "#4ca75b",
  sky: "#4e93c9",
  clay: "#d96354",
  lilac: "#8d7bd4",
  onAccent: "#ffffff",
};

/* ----------------------------------------------------------------- easing */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const quintOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 5);
const expoOut = (x: number) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 - Math.pow(2, -10 * x));
const seg = (t: number, from: number, dur: number) => clamp01((t - from) / dur);

/** One overshoot, for a row that lands with a little weight. */
function popOut(x: number): number {
  const p = clamp01(x);
  if (p >= 1) return 1;
  const c = 1.70158 * 1.1;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
}

/* --------------------------------------------------------------- timeline */

const T = {
  first: 250, //    the first task lands, alone, readable
  ramp: 2600, //    the pace starts folding in on itself
  blur: 5200, //    a stack too fast to read
  collapse: 6900, //rows rush together into the number
  number: 7150, //  250+ counts up
  thanks: 8300, //  thanks for all the love
};
export const DURATION = 10000;

/**
 * When task number `i` lands. Slow, readable beats at first, then each gap
 * shrinks geometrically — the curve is the whole story, so it lives here as
 * one honest formula rather than a table of hand-placed times.
 */
function landsAt(i: number): number {
  // gap starts at 620ms and decays toward ~34ms
  let t = T.first;
  for (let k = 0; k < i; k++) {
    t += 34 + 586 * Math.pow(0.895, k);
  }
  return t;
}

const TASK_TEXT = [
  "Call mom at 7pm",
  "Gym, tomorrow morning",
  "Pay rent before Friday",
  "Finish the client report",
  "Book flights for Goa",
  "Water the plants",
  "Reply to Sarah",
  "Buy groceries",
  "Draft the launch post",
  "Renew the domain",
  "Dentist, Tuesday 4pm",
  "Read 20 pages",
  "Fix the login bug",
  "Send the invoice",
  "Plan the weekend trip",
  "Backup the laptop",
  "Call the bank at 11",
  "Walk the dog",
  "Review the pull request",
  "Meditate, 10 minutes",
  "Cancel the subscription",
  "Write in the journal",
  "Order the birthday gift",
  "Clean the desk",
  "Schedule the standup",
  "Stretch for 15 minutes",
  "Email the landlord",
  "Refill the prescription",
  "Update the résumé",
  "Text Dad back",
  "Wash the car",
  "Prep Monday's slides",
  "Pick up the parcel",
  "Change the AC filter",
  "Book the haircut",
  "Pay the electricity bill",
  "Sort the photo album",
  "Practice guitar",
  "Return the library book",
  "Check the tyre pressure",
];

const CHIPS: { label: string; tone: keyof typeof CHIP_TONE }[] = [
  { label: "today", tone: "sun" },
  { label: "7 PM", tone: "sun" },
  { label: "tomorrow", tone: "sky" },
  { label: "#work", tone: "plain" },
  { label: "#life", tone: "plain" },
  { label: "~30m", tone: "plain" },
  { label: "✦ spotlight", tone: "sun" },
  { label: "friday", tone: "clay" },
];

const CHIP_TONE = {
  sun: { bg: C.sunSoft, fg: C.sunDeep },
  sky: { bg: "#e3f0f9", fg: "#2f6f9f" },
  clay: { bg: "#fae8e4", fg: "#b0453a" },
  plain: { bg: C.paperDeep, fg: C.inkSoft },
};

/* Deterministic per-index jitter so the stack breathes without randomness. */
const wob = (i: number, k: number) => Math.sin(i * 12.9898 + k * 78.233) * 0.5 + 0.5;

/* ------------------------------------------------------------------ rows */

function TaskRow({
  i,
  t,
  unit,
}: {
  i: number;
  t: number;
  unit: number;
}) {
  const at = landsAt(i);
  if (t < at - 260) return null;

  const age = t - at;
  const inP = popOut(seg(t, at - 240, 340));
  const fade = easeOut(seg(t, at - 240, 200));

  // rows slide up the stack as newer ones arrive below the pointer
  const rowH = 104 * unit;
  const settle = quintOut(seg(t, at, 420));

  const chip = CHIPS[i % CHIPS.length];
  const chip2 = CHIPS[(i * 3 + 2) % CHIPS.length];
  const tone = CHIP_TONE[chip.tone];
  const tone2 = CHIP_TONE[chip2.tone];
  const showSecond = wob(i, 5) > 0.45;

  // the collapse: every row rushes toward the centre and dissolves
  const col = quintOut(seg(t, T.collapse, 420));
  const dx = lerp(0, (wob(i, 2) - 0.5) * 90 * unit, col);
  const dy = lerp(0, -(0.5 + wob(i, 3)) * 260 * unit, col);
  const colFade = 1 - col;

  const tilt = lerp((wob(i, 1) - 0.5) * 3.4, 0, settle);
  const scale = lerp(0.94, 1, inP) * lerp(1, 0.86, col);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: i * rowH,
        opacity: fade * colFade,
        transform: `translate3d(${dx}px, ${lerp(26 * unit, 0, inP) + dy}px, 0) scale(${scale}) rotate(${tilt}deg)`,
        transformOrigin: "50% 50%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20 * unit,
          background: C.card,
          border: `${1.5 * unit}px solid ${C.line}`,
          borderRadius: 22 * unit,
          padding: `${20 * unit}px ${26 * unit}px`,
          boxShadow: `0 ${10 * unit}px ${30 * unit}px rgba(28,38,36,${0.05 + 0.05 * (1 - clamp01(age / 900))})`,
        }}
      >
        {/* the tick, drawn empty — these are tasks captured, not finished */}
        <span
          style={{
            width: 30 * unit,
            height: 30 * unit,
            borderRadius: "50%",
            border: `${2.4 * unit}px solid ${C.inkFaint}`,
            flexShrink: 0,
          }}
        />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              display: "block",
              fontSize: 30 * unit,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: C.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {TASK_TEXT[i % TASK_TEXT.length]}
          </span>
          <span style={{ display: "flex", gap: 10 * unit, marginTop: 10 * unit }}>
            <span
              style={{
                background: tone.bg,
                color: tone.fg,
                borderRadius: 999,
                padding: `${5 * unit}px ${14 * unit}px`,
                fontSize: 20 * unit,
                fontWeight: 700,
              }}
            >
              {chip.label}
            </span>
            {showSecond && (
              <span
                style={{
                  background: tone2.bg,
                  color: tone2.fg,
                  borderRadius: 999,
                  padding: `${5 * unit}px ${14 * unit}px`,
                  fontSize: 20 * unit,
                  fontWeight: 700,
                }}
              >
                {chip2.label}
              </span>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- film */

export function MilestoneFilm() {
  const [t, setT] = useState(0);
  const [size, setSize] = useState(1080);
  const raf = useRef<number | null>(null);
  const seeking = useRef(false);

  useEffect(() => {
    const read = () => setSize(Math.min(window.innerWidth, window.innerHeight));
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  /* Play in the browser; a recorder takes the wheel via __seek. */
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      if (!seeking.current) {
        const elapsed = (now - start) % (DURATION + 900);
        setT(Math.min(elapsed, DURATION));
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    const w = window as unknown as {
      __seek?: (ms: number) => Promise<void>;
      __duration?: number;
      __ready?: boolean;
    };
    w.__duration = DURATION;
    w.__seek = (ms: number) =>
      new Promise<void>((resolve) => {
        seeking.current = true;
        setT(ms);
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    w.__ready = true;

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const unit = size / 1080;

  /* how many rows exist by now */
  let count = 0;
  while (count < 400 && landsAt(count) <= t + 260) count++;

  /* The newest row is the one being read, so it holds the eye: centred while
     the first few land alone, sliding down as the pile builds until the
     frame is full of tasks above it. */
  const rowH = 104 * unit;
  const anchor = lerp(size * 0.5, size * 0.88, quintOut(clamp01(count / 7)));
  const stackY = anchor - count * rowH;

  /* the blur only arrives when the pace does — motion the eye can't hold */
  const speed = clamp01((t - T.ramp) / (T.blur - T.ramp));
  const blurPx = lerp(0, 7, speed * speed) * unit * (t > T.collapse ? 1 - quintOut(seg(t, T.collapse, 300)) : 1);

  /* the counter: 0 → 250 while the rows dissolve */
  const numP = expoOut(seg(t, T.number, 1500));
  const shown = Math.round(lerp(0, 250, numP));

  /* the paper warms very slightly as the pile grows — pace you can feel */
  const warm = lerp(0, 1, clamp01((t - T.first) / (T.blur - T.first)));
  const bg = t > T.collapse ? C.paper : `color-mix(in srgb, ${C.sunSoft} ${warm * 22}%, ${C.paper})`;

  const numberIn = popOut(seg(t, T.number, 620));
  const plusIn = quintOut(seg(t, T.number + 420, 620));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "#0b0f0e",
        overflow: "hidden",
      }}
    >
      {/* the square stage — everything inside is sized off `unit` */}
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          overflow: "hidden",
          background: bg,
          color: C.ink,
          fontFamily: "var(--font-sans)",
        }}
      >
        {/* ------------------------------------------------ the rising stack */}
        {t < T.collapse + 500 && (
          <div
            style={{
              position: "absolute",
              left: size * 0.11,
              right: size * 0.11,
              top: 0,
              height: size,
              filter: blurPx > 0.05 ? `blur(${blurPx}px)` : undefined,
            }}
          >
            <div style={{ position: "absolute", left: 0, right: 0, top: stackY }}>
              {Array.from({ length: count }, (_, i) => (
                <TaskRow key={i} i={i} t={t} unit={unit} />
              ))}
            </div>
          </div>
        )}

        {/* a soft vignette top and bottom so rows enter and leave, not pop */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `linear-gradient(${bg} 0%, rgba(244,247,246,0) 18%, rgba(244,247,246,0) 74%, ${bg} 96%)`,
            opacity: t > T.collapse ? 1 - quintOut(seg(t, T.collapse, 350)) : 1,
          }}
        />

        {/* ------------------------------------------------------ the number */}
        {t >= T.number - 100 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 80 * unit,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                transform: `scale(${lerp(0.86, 1, numberIn)})`,
              }}
            >
              <span
                className="font-display"
                style={{
                  fontSize: 300 * unit,
                  lineHeight: 0.9,
                  fontWeight: 500,
                  letterSpacing: "-0.045em",
                  color: C.ink,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {shown}
              </span>
              <span
                className="font-display"
                style={{
                  fontSize: 150 * unit,
                  lineHeight: 0.9,
                  fontWeight: 500,
                  color: C.sun,
                  opacity: plusIn,
                  transform: `translateY(${lerp(18 * unit, 0, plusIn)}px)`,
                  display: "inline-block",
                }}
              >
                +
              </span>
            </div>

            <div
              style={{
                marginTop: 26 * unit,
                fontSize: 46 * unit,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: C.ink,
                opacity: quintOut(seg(t, T.number + 700, 700)),
                transform: `translateY(${lerp(20 * unit, 0, quintOut(seg(t, T.number + 700, 700)))}px)`,
              }}
            >
              tasks created
            </div>

            {/* the thank-you, and the mark that earned it */}
            <div
              style={{
                marginTop: 54 * unit,
                opacity: quintOut(seg(t, T.thanks, 700)),
                transform: `translateY(${lerp(24 * unit, 0, quintOut(seg(t, T.thanks, 700)))}px)`,
              }}
            >
              <div
                className="font-display"
                style={{
                  fontSize: 52 * unit,
                  fontStyle: "italic",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: C.sunDeep,
                }}
              >
                thanks for all the love
              </div>
              <div
                style={{
                  marginTop: 34 * unit,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 14 * unit,
                  opacity: quintOut(seg(t, T.thanks + 380, 700)),
                }}
              >
                <Mark size={46 * unit} />
                <span
                  className="font-display"
                  style={{
                    fontSize: 54 * unit,
                    letterSpacing: "-0.03em",
                    color: C.ink,
                  }}
                >
                  kairo
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
