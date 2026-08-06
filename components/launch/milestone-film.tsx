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

const CHIP_TONE = {
  sun: { bg: C.sunSoft, fg: C.sunDeep },
  sky: { bg: "#e3f0f9", fg: "#2f6f9f" },
  clay: { bg: "#fae8e4", fg: "#b0453a" },
  plain: { bg: C.paperDeep, fg: C.inkSoft },
};

type Chip = { label: string; tone: keyof typeof CHIP_TONE };
type TaskLine = { title: string; chips: Chip[] };

/**
 * The pile. The first four are the ones the eye actually reads while the
 * pace is still slow, so they carry the story; the rest are the ordinary
 * business of a life, which is the point.
 *
 * Chips belong to their task rather than being picked by index — a row
 * tagged both "today" and "tomorrow" is a detail that quietly says nobody
 * looked.
 */
const TASKS: TaskLine[] = [
  { title: "Call Mom at 7", chips: [{ label: "today", tone: "sun" }, { label: "7 PM", tone: "sun" }] },
  { title: "Practice DSA", chips: [{ label: "today", tone: "sun" }, { label: "~1h", tone: "plain" }] },
  { title: "Instagram post for launch", chips: [{ label: "tomorrow", tone: "sky" }, { label: "#work", tone: "plain" }] },
  { title: "Finish the client report", chips: [{ label: "friday", tone: "clay" }, { label: "~2h", tone: "plain" }] },
  { title: "Book flights for Goa", chips: [{ label: "#life", tone: "plain" }] },
  { title: "Water the plants", chips: [{ label: "today", tone: "sun" }] },
  { title: "Reply to Sarah", chips: [{ label: "✦ spotlight", tone: "sun" }] },
  { title: "Buy groceries", chips: [{ label: "tomorrow", tone: "sky" }, { label: "#life", tone: "plain" }] },
  { title: "Pay rent before Friday", chips: [{ label: "friday", tone: "clay" }] },
  { title: "Renew the domain", chips: [{ label: "~15m", tone: "plain" }] },
  { title: "Dentist, Tuesday 4pm", chips: [{ label: "tuesday", tone: "sky" }] },
  { title: "Read 20 pages", chips: [{ label: "tonight", tone: "sun" }] },
  { title: "Fix the login bug", chips: [{ label: "today", tone: "sun" }, { label: "#work", tone: "plain" }] },
  { title: "Send the invoice", chips: [{ label: "✦ spotlight", tone: "sun" }] },
  { title: "Plan the weekend trip", chips: [{ label: "saturday", tone: "sky" }] },
  { title: "Back up the laptop", chips: [{ label: "~20m", tone: "plain" }] },
  { title: "Call the bank at 11", chips: [{ label: "tomorrow", tone: "sky" }, { label: "11 AM", tone: "sky" }] },
  { title: "Walk the dog", chips: [{ label: "today", tone: "sun" }] },
  { title: "Review the pull request", chips: [{ label: "#work", tone: "plain" }] },
  { title: "Meditate, 10 minutes", chips: [{ label: "every day", tone: "sky" }] },
  { title: "Cancel the subscription", chips: [{ label: "~5m", tone: "plain" }] },
  { title: "Write in the journal", chips: [{ label: "tonight", tone: "sun" }] },
  { title: "Order the birthday gift", chips: [{ label: "thursday", tone: "clay" }] },
  { title: "Clean the desk", chips: [{ label: "#life", tone: "plain" }] },
  { title: "Schedule the standup", chips: [{ label: "#work", tone: "plain" }] },
  { title: "Stretch for 15 minutes", chips: [{ label: "every day", tone: "sky" }] },
  { title: "Email the landlord", chips: [{ label: "today", tone: "sun" }] },
  { title: "Refill the prescription", chips: [{ label: "~10m", tone: "plain" }] },
  { title: "Update the résumé", chips: [{ label: "sunday", tone: "sky" }] },
  { title: "Text Dad back", chips: [{ label: "today", tone: "sun" }] },
  { title: "Wash the car", chips: [{ label: "saturday", tone: "sky" }] },
  { title: "Prep Monday's slides", chips: [{ label: "monday", tone: "clay" }, { label: "#work", tone: "plain" }] },
  { title: "Pick up the parcel", chips: [{ label: "tomorrow", tone: "sky" }] },
  { title: "Change the AC filter", chips: [{ label: "#life", tone: "plain" }] },
  { title: "Book the haircut", chips: [{ label: "~5m", tone: "plain" }] },
  { title: "Pay the electricity bill", chips: [{ label: "friday", tone: "clay" }] },
  { title: "Sort the photo album", chips: [{ label: "someday", tone: "plain" }] },
  { title: "Practice guitar", chips: [{ label: "every day", tone: "sky" }] },
  { title: "Return the library book", chips: [{ label: "wednesday", tone: "sky" }] },
  { title: "Check the tyre pressure", chips: [{ label: "~10m", tone: "plain" }] },
];

/* Deterministic per-index jitter so the stack breathes without randomness. */
const wob = (i: number, k: number) => Math.sin(i * 12.9898 + k * 78.233) * 0.5 + 0.5;

/**
 * The row pitch, in design units. It must clear the card's own height —
 * title, chips and padding — or rows sit on each other and eat their tags.
 * One constant, because the stack maths and the rows must never disagree.
 */
const ROW_H = 138;

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
  const rowH = ROW_H * unit;
  const settle = quintOut(seg(t, at, 420));

  const task = TASKS[i % TASKS.length];

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
            {task.title}
          </span>
          <span style={{ display: "flex", gap: 10 * unit, marginTop: 10 * unit }}>
            {task.chips.map((c) => {
              const tone = CHIP_TONE[c.tone];
              return (
                <span
                  key={c.label}
                  style={{
                    background: tone.bg,
                    color: tone.fg,
                    borderRadius: 999,
                    padding: `${5 * unit}px ${14 * unit}px`,
                    fontSize: 20 * unit,
                    fontWeight: 700,
                  }}
                >
                  {c.label}
                </span>
              );
            })}
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
  const rowH = ROW_H * unit;
  // eased IN, not out: the first few tasks must hold their high perch, and
  // only once the pile is real does the anchor slide down to make room
  const anchor = lerp(size * 0.4, size * 0.88, Math.pow(clamp01(count / 8), 1.7));
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
              {/* the lockup, as the app wears it: teal mark, ink wordmark.
                  The mark's bars fill barely half its viewBox, so it needs to
                  be drawn oversized to sit level with the word beside it. */}
              <div
                style={{
                  marginTop: 34 * unit,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6 * unit,
                  // the mark's bars sit inside a square of empty margin, so a
                  // geometrically centred lockup reads right of centre
                  transform: `translateX(${-22 * unit}px)`,
                  opacity: quintOut(seg(t, T.thanks + 380, 700)),
                }}
              >
                <span style={{ color: C.sun, display: "inline-flex", marginTop: -2 * unit }}>
                  <Mark size={92 * unit} />
                </span>
                <span
                  className="font-display"
                  style={{
                    fontSize: 62 * unit,
                    lineHeight: 1,
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
