"use client";

import { useEffect, useRef, useState } from "react";
import {
  CaptureDemo,
  FocusDemo,
  FreshStartDemo,
  TodayDemo,
} from "@/components/landing/demos";
import { Mark } from "@/components/mark";

/**
 * The launch film, at /video-launch.
 *
 * Built on the grammar every good product launch video shares:
 *
 * - Chaos first: three seconds of the pain (a badge counting overdue tasks)
 *   before the product is allowed to appear.
 * - Arrive fast, then FREEZE. Every element enters on an expo curve that
 *   spends its speed in the first 150ms, lands, and then holds perfectly
 *   still. The stillness is what reads as confidence; constant idle motion
 *   is what reads as amateur.
 * - Scene changes are full-bleed colour slabs that wipe across and become
 *   the next background. No crossfades.
 * - One idea per frame, five words or fewer, concrete over clever.
 *
 * Same contract as the /launch film: every visible property is a function
 * of one number, the current time. In a browser it free-runs on a loop as
 * its own preview; the recorder's first __seek takes the wheel permanently
 * and from then on nothing reads the wall clock.
 */

/* ----------------------------------------------------------------- easing */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
/** The whip: nearly all of the travel happens in the first fifth. */
const expoOut = (x: number) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 - Math.pow(2, -10 * x));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const seg = (t: number, from: number, dur: number) => clamp01((t - from) / dur);

/** A soft camera impulse: swells from zero, dies quietly. */
function impulse(t: number, at: number, span = 650): number {
  const x = (t - at) / span;
  if (x <= 0 || x > 2.5) return 0;
  return (x * Math.exp(-3 * x)) / 0.1226;
}

/* --------------------------------------------------------------- timeline */

/**
 * The cut. Scene starts double as slab-wipe moments; inside a scene,
 * everything is timed from the scene's own zero.
 */
const T = {
  chaos: 0, //          ink   the badge counts up, "Sound familiar?"
  promise: 4400, //     paper "Your to-do list shouldn't make you feel bad."
  reveal: 7900, //            mark + kairo + tagline
  f1: 11600, //               Type it. AI plans it.       (capture demo)
  f2: 16100, //               See only today.             (today demo)
  f3: 20600, //               Nothing turns red.          (fresh start demo)
  f4: 25100, //               One task at a time.         (focus demo)
  m1: 29800, //         teal  Share lists.
  m2: 31300, //         ink   Lock what's private.
  m3: 32800, //         teal  See your month.
  offer: 34300, //      teal  Free for 7 days.
  end: 38600, //        paper the mark, the name, the address
};
export const DURATION = 44500;

const FEATURES = [
  {
    start: T.f1,
    dur: T.f2 - T.f1,
    demo: <CaptureDemo />,
    tilt: -1.2,
    head: [{ text: "Type it. " }, { text: "AI plans it.", accent: true }],
    sub: "Date, time and list, filled in for you.",
  },
  {
    start: T.f2,
    dur: T.f3 - T.f2,
    demo: <TodayDemo />,
    tilt: 1.2,
    head: [{ text: "See " }, { text: "only today.", accent: true }],
    sub: "Just what fits in your day. Nothing else.",
  },
  {
    start: T.f3,
    dur: T.f4 - T.f3,
    demo: <FreshStartDemo />,
    tilt: -1.2,
    head: [{ text: "Nothing " }, { text: "turns red.", accent: true }],
    sub: "Unfinished tasks start fresh tomorrow.",
  },
  {
    start: T.f4,
    dur: T.m1 - T.f4 - 300,
    demo: <FocusDemo />,
    tilt: 1.2,
    head: [{ text: "One task " }, { text: "at a time.", accent: true }],
    sub: "A timer for the thing in front of you.",
  },
];

const MONTAGE = [
  { start: T.m1, dur: T.m2 - T.m1, bg: "var(--color-sun)", text: "Share lists." },
  { start: T.m2, dur: T.m3 - T.m2, bg: "var(--color-ink)", text: "Lock what's private." },
  { start: T.m3, dur: T.offer - T.m3, bg: "var(--color-sun-deep)", text: "See your month." },
];

/** How much faster the in-card demos run than they do on the landing page. */
const DEMO_SPEED = 1.4;

/** Demo-bearing beats, for scrubbing their CSS animations from beat-start. */
const SCRUB_BEATS = FEATURES.map((f) => ({ start: f.start, dur: f.dur }));

/** Gentle camera swells, only on the moments that deserve one. */
const KICKS: { at: number; amp: number }[] = [
  { at: 2450, amp: 0.016 }, // the badge tops out
  { at: T.reveal + 350, amp: 0.014 },
  { at: T.offer + 450, amp: 0.018 },
];

/* ----------------------------------------------------------------- pieces */

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

type Word = { text: string; accent?: boolean; clay?: boolean };

/**
 * A line that whips in and stops: the words share one entrance, staggered
 * 55ms, each spending its speed immediately and freezing. After ~700ms the
 * line is at perfect rest and stays there.
 */
function LineIn({
  lt,
  at,
  words,
  fontSize,
  color,
  align = "center",
}: {
  lt: number;
  at: number;
  words: Word[];
  fontSize: number;
  color?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "left" ? "flex-start" : "center",
        columnGap: fontSize * 0.24,
        rowGap: fontSize * 0.05,
      }}
    >
      {words.map((w, i) => {
        const p = expoOut(seg(lt, at + i * 55, 620));
        if (p <= 0) return null;
        return (
          <span
            key={i}
            className={w.accent ? "font-display" : undefined}
            style={{
              fontSize,
              lineHeight: 1.1,
              fontWeight: w.accent ? 500 : 700,
              fontStyle: w.accent ? "italic" : undefined,
              letterSpacing: w.accent ? "-0.02em" : "-0.035em",
              color: w.clay ? "var(--color-clay)" : (color ?? "var(--color-ink)"),
              opacity: clamp01(p * 1.25),
              transform: `translateY(${lerp(0.55 * fontSize, 0, p)}px)`,
              display: "inline-block",
              whiteSpace: "pre",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}

/** Content leaving a scene: a quick lift, gone before the next beat. */
function exitLift(lt: number, at: number): React.CSSProperties {
  const x = seg(lt, at, 240);
  if (x <= 0) return {};
  const p = x * x * x;
  return { opacity: 1 - p, transform: `translateY(${-46 * p}px)` };
}

/**
 * The neumorphic ring field, nearly at rest: a breath so slow it is felt on
 * a re-watch, not seen. Painted once, transformed after — never repainted.
 */
function RingField({ t, cx, cy, unit }: { t: number; cx: number; cy: number; unit: number }) {
  const RINGS = [1560, 1160, 800, 470];
  return (
    <div aria-hidden style={{ position: "absolute", left: `${cx}%`, top: `${cy}%`, width: 0, height: 0 }}>
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

/** A soft pulse of light — the film's only punctuation mark. */
function Glow({ t, at, unit, sun }: { t: number; at: number; unit: number; sun?: boolean }) {
  const p = seg(t, at, 1400);
  if (p <= 0 || p >= 1) return null;
  const size = 1100 * unit;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: `calc(50% - ${size / 2}px)`,
        top: `calc(50% - ${size / 2}px)`,
        width: size,
        height: size,
        borderRadius: "50%",
        background: sun
          ? "radial-gradient(circle, rgba(12,147,132,0.20) 0%, rgba(12,147,132,0.06) 45%, rgba(12,147,132,0) 70%)"
          : "radial-gradient(circle, rgba(28,38,36,0.10) 0%, rgba(28,38,36,0) 65%)",
        transform: `scale(${lerp(0.35, 2.2, easeOut(p))})`,
        opacity: 1 - p,
      }}
    />
  );
}

/**
 * A scene slab: a full-bleed colour that wipes across at its moment and
 * then IS the background until the next slab covers it. The wipe is the
 * cut — nothing ever crossfades between scenes.
 */
function Slab({
  t,
  at,
  bg,
  from,
  children,
}: {
  t: number;
  at: number;
  bg: string;
  from: "left" | "right";
  children?: React.ReactNode;
}) {
  const p = expoOut(seg(t, at, 560));
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

/* ----------------------------------------------------------- badge opener */

/** When tick k of the badge count lands, 3 → 47 on a decelerating curve. */
const BADGE_TICKS = 44;
const tickTime = (k: number) => 350 + 2100 * (1 - Math.pow(1 - k / BADGE_TICKS, 1 / 3));

function badgeCount(lt: number): { n: number; kick: number } {
  let n = 3;
  let last = -1e9;
  for (let k = 1; k <= BADGE_TICKS; k++) {
    const tk = tickTime(k);
    if (lt >= tk) {
      n = 3 + k;
      last = tk;
    } else break;
  }
  return { n, kick: Math.exp(-(lt - last) / 120) };
}

/* ------------------------------------------------------------------- film */

export function VideoLaunchFilm() {
  const stage = useStage();
  const [t, setT] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const w = window as unknown as {
      __seek?: (ms: number) => Promise<void>;
      __duration?: number;
      __ready?: boolean;
    };
    const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

    // In a browser the film plays itself on a loop — the page doubles as its
    // own preview, with the demo animations sped to match the recorded cut.
    // The recorder's first __seek takes the wheel permanently, which is what
    // keeps the recorded output deterministic: from that moment nothing
    // reads the wall clock.
    let raf = 0;
    let driven = false;
    const t0 = performance.now();
    const freeRun = (now: number) => {
      if (driven) return;
      setT((now - t0) % DURATION);
      if (frame.current++ % 60 === 0) {
        for (const anim of document.getAnimations()) anim.playbackRate = DEMO_SPEED;
      }
      raf = requestAnimationFrame(freeRun);
    };
    raf = requestAnimationFrame(freeRun);

    w.__duration = DURATION;
    w.__seek = async (ms: number) => {
      driven = true;
      cancelAnimationFrame(raf);
      setT(ms);
      await nextFrame();
      await nextFrame();
      // demo CSS animations run from the start of the shot they live in,
      // faster than on the landing page — a film cut has no patience
      const active = SCRUB_BEATS.filter((b) => ms >= b.start - 900 && ms <= b.start + b.dur + 900);
      const base = active.length > 0 ? active[active.length - 1].start : 0;
      for (const anim of document.getAnimations()) {
        anim.pause();
        try {
          anim.currentTime = Math.max(0, (ms - base) * DEMO_SPEED);
        } catch {
          // a finished, non-looping animation refuses a new time; harmless
        }
      }
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

  /* the camera: one slow push over the film, a soft swell on big landings */
  let kick = 0;
  for (const k of KICKS) kick += k.amp * impulse(t, k.at);
  const camera = lerp(1, 1.045, easeInOut(t / DURATION)) + kick;

  const demoScale = (portrait ? stage.w * 0.72 : stage.w * 0.295) / 420;
  const headSize = (portrait ? 82 : 92) * unit;
  const slabSize = (portrait ? 104 : 126) * unit;

  /* chaos scene */
  const { n: badgeN, kick: badgeKick } = badgeCount(t);
  const badgeIn = expoOut(seg(t, 250, 600));

  /* reveal */
  const markP = expoOut(seg(t, T.reveal + 100, 800));
  const wordP = expoOut(seg(t, T.reveal + 320, 650));

  /* end */
  const eMark = expoOut(seg(t, T.end + 250, 800));

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
        {t < T.promise + 700 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--color-ink)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 34 * unit,
            }}
          >
            <div style={{ ...exitLift(t, T.promise - 300), display: "flex", flexDirection: "column", alignItems: "center", gap: 34 * unit }}>
              <div
                style={{
                  minWidth: 210 * unit,
                  height: 210 * unit,
                  borderRadius: 999,
                  background: "var(--color-clay)",
                  display: "grid",
                  placeItems: "center",
                  padding: `0 ${44 * unit}px`,
                  transform: `scale(${badgeIn * (1 + 0.05 * badgeKick)})`,
                  boxShadow: `0 ${22 * unit}px ${70 * unit}px rgba(217,99,84,0.35)`,
                }}
              >
                <span
                  style={{
                    fontSize: 108 * unit,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: "#fff",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {badgeN}
                </span>
              </div>
              <div
                style={{
                  fontSize: 34 * unit,
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(244,247,246,0.55)",
                  opacity: badgeIn,
                }}
              >
                overdue
              </div>
              <div style={{ marginTop: 10 * unit }}>
                <LineIn
                  lt={t}
                  at={2750}
                  words={[{ text: "Sound " }, { text: "familiar?", accent: true }]}
                  fontSize={(portrait ? 76 : 84) * unit}
                  color="var(--color-paper)"
                />
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------- 2 · the paper act (rings) */}
        {t >= T.promise - 600 && t < T.m1 + 700 && (
          <Slab t={t} at={T.promise - 560} bg="var(--color-paper)" from="right">
            <RingField t={t} cx={portrait ? 50 : 58} cy={portrait ? 42 : 46} unit={unit} />
            <Glow t={t} at={T.reveal + 250} unit={unit} sun />

            {/* the promise */}
            {t < T.reveal + 400 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  padding: "0 8%",
                  ...exitLift(t, T.reveal - 280),
                }}
              >
                <div style={{ textAlign: "center", maxWidth: portrait ? "96%" : "78%" }}>
                  <LineIn
                    lt={t}
                    at={T.promise}
                    words={[{ text: "Your to-do list" }]}
                    fontSize={headSize * 1.06}
                  />
                  <div style={{ height: 8 * unit }} />
                  <LineIn
                    lt={t}
                    at={T.promise + 240}
                    words={[{ text: "shouldn't make you " }, { text: "feel bad.", accent: true }]}
                    fontSize={headSize * 1.06}
                  />
                </div>
              </div>
            )}

            {/* the reveal */}
            {t >= T.reveal - 100 && t < T.f1 + 400 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  ...exitLift(t, T.f1 - 280),
                }}
              >
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
                        opacity: clamp01(wordP * 1.25),
                        transform: `translateY(${lerp(30, 0, wordP)}px)`,
                        display: "inline-block",
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
                      opacity: clamp01(expoOut(seg(t, T.reveal + 700, 600)) * 1.25),
                      transform: `translateY(${lerp(24, 0, expoOut(seg(t, T.reveal + 700, 600)))}px)`,
                    }}
                  >
                    A daily planner that forgives.
                  </p>
                </div>
              </div>
            )}

            {/* the features: headline up top, the product below, then rest */}
            {FEATURES.map((f, i) => {
              if (t < f.start - 100 || t > f.start + f.dur + 400) return null;
              const lt = t - f.start;
              const cardP = expoOut(seg(lt, 300, 700));
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
                    gap: portrait ? 44 * unit : 38 * unit,
                    padding: portrait ? "0 5%" : "0 8%",
                    ...exitLift(lt, f.dur - 280),
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
                        opacity: clamp01(expoOut(seg(lt, 900, 550)) * 1.25),
                        transform: `translateY(${lerp(18, 0, expoOut(seg(lt, 900, 550)))}px)`,
                      }}
                    >
                      {f.sub}
                    </p>
                  </div>
                  <div
                    style={{
                      transform: `translateY(${lerp(0.42 * stage.h, 0, cardP)}px) rotate(${f.tilt * cardP}deg)`,
                    }}
                  >
                    <div
                      style={{
                        width: "fit-content",
                        borderRadius: 28 * unit,
                        background: "var(--color-paper)",
                        boxShadow: `0 ${26 * unit}px ${70 * unit}px rgba(28,38,36,0.16), 0 ${6 * unit}px ${18 * unit}px rgba(28,38,36,0.08)`,
                        padding: 10 * unit,
                      }}
                    >
                      {/* zoom, not transform: it scales layout too, so the
                          card wraps the demo at its rendered size */}
                      <div style={{ width: 420, zoom: demoScale }}>{f.demo}</div>
                    </div>
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
            <Slab key={i} t={t} at={m.start} bg={m.bg} from={i % 2 === 0 ? "left" : "right"}>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: "0 6%" }}>
                <LineIn
                  lt={t - m.start}
                  at={160}
                  words={[{ text: m.text }]}
                  fontSize={slabSize}
                  color="#fff"
                />
              </div>
            </Slab>
          );
        })}

        {/* --------------------------------------------- 4 · offer (teal) */}
        {t >= T.offer - 100 && t < T.end + 700 && (
          <Slab t={t} at={T.offer} bg="var(--color-sun)" from="left">
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                padding: "0 6%",
              }}
            >
              <div style={{ textAlign: "center", color: "#fff", transform: `scale(${1 + kick * 1.3})` }}>
                <div
                  className="font-display"
                  style={{
                    fontSize: (portrait ? 122 : 142) * unit,
                    fontStyle: "italic",
                    fontWeight: 500,
                    letterSpacing: "-0.025em",
                    lineHeight: 1,
                    opacity: clamp01(expoOut(seg(t, T.offer + 260, 620)) * 1.25),
                    transform: `translateY(${lerp(70, 0, expoOut(seg(t, T.offer + 260, 620)))}px)`,
                  }}
                >
                  Free for 7 days.
                </div>
                <p
                  style={{
                    marginTop: 26 * unit,
                    fontSize: (portrait ? 42 : 40) * unit,
                    fontWeight: 600,
                    opacity: clamp01(expoOut(seg(t, T.offer + 850, 550)) * 1.25) * 0.95,
                    transform: `translateY(${lerp(22, 0, expoOut(seg(t, T.offer + 850, 550)))}px)`,
                  }}
                >
                  Everything unlocked. No card needed.
                </p>
              </div>
            </div>
          </Slab>
        )}

        {/* ----------------------------------------------- 5 · end (paper) */}
        {t >= T.end - 100 && (
          <Slab t={t} at={T.end} bg="var(--color-paper)" from="right">
            <RingField t={t} cx={50} cy={portrait ? 44 : 46} unit={unit} />
            <Glow t={t} at={T.end + 400} unit={unit} sun />
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
                    <Mark size={(portrait ? 84 : 92) * unit} />
                  </span>
                  <span
                    className="font-display"
                    style={{
                      fontSize: (portrait ? 92 : 100) * unit,
                      letterSpacing: "-0.03em",
                      opacity: clamp01(expoOut(seg(t, T.end + 450, 600)) * 1.25),
                      transform: `translateY(${lerp(26, 0, expoOut(seg(t, T.end + 450, 600)))}px)`,
                      display: "inline-block",
                    }}
                  >
                    kairo
                  </span>
                </div>
                <p
                  style={{
                    marginTop: 22 * unit,
                    fontSize: (portrait ? 38 : 34) * unit,
                    fontWeight: 500,
                    color: "var(--color-ink-soft)",
                    opacity: clamp01(expoOut(seg(t, T.end + 900, 600)) * 1.25),
                    transform: `translateY(${lerp(18, 0, expoOut(seg(t, T.end + 900, 600)))}px)`,
                  }}
                >
                  A daily planner that forgives.
                </p>
                <div
                  style={{
                    marginTop: 40 * unit,
                    display: "inline-block",
                    background: "var(--color-ink)",
                    color: "var(--color-paper)",
                    borderRadius: 999,
                    padding: `${18 * unit}px ${44 * unit}px`,
                    fontSize: (portrait ? 34 : 30) * unit,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    opacity: clamp01(expoOut(seg(t, T.end + 1350, 600)) * 1.25),
                    transform: `translateY(${lerp(22, 0, expoOut(seg(t, T.end + 1350, 600)))}px)`,
                  }}
                >
                  kairo.jaimansoni.com
                </div>
              </div>
            </div>
          </Slab>
        )}
      </div>
    </div>
  );
}
