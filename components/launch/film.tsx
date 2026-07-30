"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDemo,
  CaptureDemo,
  FocusDemo,
  FreshStartDemo,
  LockDemo,
  ShareDemo,
  TodayDemo,
} from "@/components/landing/demos";
import { Laptop } from "./laptop";

/**
 * The launch film.
 *
 * Every visible property is a function of one number — the current time — and
 * nothing reads the wall clock. That is what makes the render reproducible:
 * the recorder sets a time, waits for paint, photographs, and repeats, so the
 * output is frame-exact regardless of how slowly the machine draws it.
 *
 * The demos inside the laptop are the same components the landing page uses.
 * Their CSS animations are paused and scrubbed to match, in `seek` below.
 */

/* ----------------------------------------------------------------- easing */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;

/** Progress through a window that starts at `from` and lasts `dur`. */
const seg = (t: number, from: number, dur: number) => clamp01((t - from) / dur);

/**
 * Fade a beat in and out at its edges.
 *
 * The gaps matter more than the fades: cutting straight from a sentence to a
 * product shot reads as a slideshow. A held breath of background between them
 * is what makes it feel deliberate.
 */
function beatOpacity(t: number, start: number, dur: number, fade: number): number {
  if (t < start - fade || t > start + dur + fade) return 0;
  return Math.min(seg(t, start - fade, fade), 1 - seg(t, start + dur, fade));
}

/* --------------------------------------------------------------- timeline */

type Common = {
  start: number;
  dur: number;
  /**
   * Half-length of the crossfade at each edge. The default suits a beat that
   * gets several seconds on screen; quick cuts need a shorter one, or the
   * outgoing and incoming shots are both legible at once and the frame turns
   * to mush.
   */
  fade?: number;
};

type Title = Common & {
  kind: "title";
  lines: string[];
  /** Index of the line to set in the accent colour. */
  accent?: number;
};

type Shot = Common & {
  kind: "shot";
  demo: React.ReactNode;
  caption: string;
};

type Beat = Title | Shot;

const DEFAULT_FADE = 700;
const CUT_FADE = 320;

/**
 * ~76 seconds. Four demos carry the story and three more appear as a closing
 * montage — a launch film argues one idea, so the rest of the feature list
 * stays on the landing page where someone can read it at their own pace.
 */
export const TIMELINE: Beat[] = [
  { kind: "title", start: 4200, dur: 4600, lines: ["Your to-do list", "shouldn't make you", "feel bad."], accent: 2 },

  { kind: "shot", start: 10000, dur: 7600, demo: <CaptureDemo />, caption: "Just say it" },
  { kind: "title", start: 18600, dur: 3200, lines: ["Say it.", "AI files it."], accent: 1 },

  { kind: "shot", start: 23000, dur: 7200, demo: <TodayDemo />, caption: "Today, and only today" },
  { kind: "title", start: 31400, dur: 3200, lines: ["A day", "with edges."], accent: 1 },

  { kind: "shot", start: 35800, dur: 7600, demo: <FreshStartDemo />, caption: "Yesterday, forgiven" },
  { kind: "title", start: 44600, dur: 3400, lines: ["Nothing ever", "turns red."], accent: 1 },

  { kind: "shot", start: 49200, dur: 6600, demo: <FocusDemo />, caption: "One thing at a time" },

  // closing montage — short holds, so short fades and a clear gap between them
  { kind: "shot", start: 57400, dur: 2600, fade: CUT_FADE, demo: <ShareDemo />, caption: "Share a list" },
  { kind: "shot", start: 60600, dur: 2600, fade: CUT_FADE, demo: <LockDemo />, caption: "Lock what's private" },
  { kind: "shot", start: 63800, dur: 2600, fade: CUT_FADE, demo: <CalendarDemo />, caption: "See the month" },

  { kind: "title", start: 67600, dur: 3400, lines: ["Win today.", "Repeat tomorrow."], accent: 0 },
];

const OPEN_END = 4000;
const END_CARD = 72400;

/** Held just under the 76s music bed so the track never runs out under picture. */
export const DURATION = 76000;

/* ----------------------------------------------------------------- layout */

type Stage = { w: number; h: number; portrait: boolean };

/** One scale factor drives every size, so both aspect ratios stay in proportion. */
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

/* ------------------------------------------------------------------ marks */

function Star({ size, color = "var(--color-sun)" }: { size: number; color?: string }) {
  return (
    <span style={{ fontSize: size, lineHeight: 1, color }} aria-hidden>
      ✱
    </span>
  );
}

/* ------------------------------------------------------------------- film */

export function LaunchFilm() {
  const stage = useStage();
  const [t, setT] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  // The recorder's only entry point. Scrubbing the CSS animations rather than
  // letting them free-run is what stops the demos drifting out of sync with
  // the cut when a frame takes longer than its 33ms to draw.
  //
  // It has to be async, and the order is the whole trick: setting the time
  // only *schedules* a React render, and a beat entering the frame mounts
  // fresh DOM whose CSS animations start themselves at zero. Scrubbing before
  // that render commits would scrub the outgoing shot and leave the incoming
  // one running on wall-clock time.
  useEffect(() => {
    const w = window as unknown as {
      __seek?: (ms: number) => Promise<void>;
      __duration?: number;
      __ready?: boolean;
    };

    const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

    w.__duration = DURATION;
    w.__seek = async (ms: number) => {
      setT(ms);
      await nextFrame(); // React commits
      await nextFrame(); // …and the browser has laid it out

      // Time is measured from the start of the beat on screen, so the typing
      // in a shot begins when the shot does.
      const active = TIMELINE.filter((b) => ms >= b.start - 900 && ms <= b.start + b.dur + 900);
      const base = active.length > 0 ? active[active.length - 1].start : 0;
      for (const anim of document.getAnimations()) {
        anim.pause();
        try {
          anim.currentTime = Math.max(0, ms - base);
        } catch {
          // a finished, non-looping animation refuses a new time; harmless
        }
      }
      await nextFrame(); // the scrubbed frame is painted
    };
    w.__ready = true;
    return () => {
      delete w.__seek;
      delete w.__ready;
    };
  }, []);

  const unit = stage.portrait ? stage.w / 1080 : stage.w / 1920;
  const screenW = stage.portrait ? stage.w * 0.9 : stage.w * 0.54;

  // The demos were drawn for a ~420px landing-page column. Blown up to fill a
  // laptop screen they'd be a wall of 13px text, so they're rendered at their
  // native size and scaled — type, radii and strokes grow together.
  const DEMO_W = 420;
  const demoScale = (screenW * 0.82) / DEMO_W;

  /* opening: the mark draws itself, the wordmark follows */
  const openIn = easeOut(seg(t, 300, 1100));
  const openOut = 1 - seg(t, OPEN_END - 700, 700);
  const wordIn = easeOut(seg(t, 1400, 900));

  /* closing card */
  const endIn = easeOut(seg(t, END_CARD, 1200));
  const endLift = lerp(28, 0, endIn);

  return (
    <div
      ref={root}
      className="mesh"
      style={{
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        position: "relative",
        background: "var(--color-paper)",
      }}
    >
      {/* ---------------------------------------------------------- opening */}
      {t < OPEN_END + 200 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            opacity: openIn * openOut,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 * unit }}>
            <div style={{ transform: `scale(${lerp(0.7, 1, openIn)}) rotate(${lerp(-25, 0, openIn)}deg)` }}>
              <Star size={92 * unit} />
            </div>
            <span
              className="font-display"
              style={{
                fontSize: 84 * unit,
                letterSpacing: "-0.03em",
                opacity: wordIn,
                transform: `translateX(${lerp(-14, 0, wordIn) * unit}px)`,
              }}
            >
              kairo
            </span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ beats */}
      {TIMELINE.map((beat, i) => {
        const fade = beat.fade ?? DEFAULT_FADE;
        const o = beatOpacity(t, beat.start, beat.dur, fade);
        if (o <= 0.001) return null;
        const p = seg(t, beat.start, beat.dur);

        if (beat.kind === "title") {
          // a slow drift upward — motion that reads as intent, not animation
          const drift = lerp(18, -18, easeInOut(clamp01((t - beat.start + fade) / (beat.dur + fade * 2))));
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                opacity: o,
                padding: `0 ${8 * unit}%`,
              }}
            >
              <h2
                className="font-display"
                style={{
                  fontSize: (stage.portrait ? 96 : 104) * unit,
                  lineHeight: 1.04,
                  letterSpacing: "-0.035em",
                  textAlign: "center",
                  transform: `translateY(${drift * unit}px)`,
                  margin: 0,
                }}
              >
                {beat.lines.map((line, n) => (
                  <span
                    key={n}
                    style={{
                      display: "block",
                      color: n === beat.accent ? "var(--color-sun)" : undefined,
                      fontStyle: n === beat.accent ? "italic" : undefined,
                      opacity: clamp01(seg(t, beat.start - fade + n * 190, 800)),
                    }}
                  >
                    {line}
                  </span>
                ))}
              </h2>
            </div>
          );
        }

        // shot: a slow push in across the whole beat
        const push = lerp(1, 1.045, easeInOut(p));
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
              gap: 44 * unit,
              opacity: o,
            }}
          >
            <div style={{ transform: `scale(${push})`, transformOrigin: "center 55%" }}>
              <Laptop width={screenW}>
                <div
                  className="mesh"
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: DEMO_W,
                      transform: `scale(${demoScale})`,
                      transformOrigin: "center",
                    }}
                  >
                    {beat.demo}
                  </div>
                </div>
              </Laptop>
            </div>
            <p
              style={{
                // a caption sized for a 1080-wide phone has to be far larger
                // as a fraction of the frame than one on a 1920 timeline
                fontSize: (stage.portrait ? 38 : 26) * unit,
                letterSpacing: "0.01em",
                color: "var(--color-ink-soft)",
                margin: 0,
                opacity: clamp01(seg(t, beat.start + 400, 900)),
              }}
            >
              {beat.caption}
            </p>
          </div>
        );
      })}

      {/* ------------------------------------------------------- end card */}
      {t >= END_CARD - 200 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            opacity: endIn,
          }}
        >
          <div style={{ textAlign: "center", transform: `translateY(${endLift * unit}px)` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 * unit }}>
              <Star size={72 * unit} />
              <span className="font-display" style={{ fontSize: 68 * unit, letterSpacing: "-0.03em" }}>
                kairo
              </span>
            </div>
            <p
              style={{
                marginTop: 22 * unit,
                fontSize: 30 * unit,
                color: "var(--color-ink-soft)",
                opacity: clamp01(seg(t, END_CARD + 700, 900)),
              }}
            >
              A daily planner that forgives.
            </p>
            <p
              style={{
                marginTop: 34 * unit,
                fontSize: 26 * unit,
                fontWeight: 600,
                opacity: clamp01(seg(t, END_CARD + 1400, 900)),
              }}
            >
              kairo.jaimansoni.com
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
