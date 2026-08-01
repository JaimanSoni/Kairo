"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CaptureDemo,
  FocusDemo,
  FreshStartDemo,
  TodayDemo,
} from "@/components/landing/demos";
import { Mark } from "@/components/mark";

/**
 * The kinetic launch film, at /video-launch.
 *
 * A different cut from the /launch product film: this one is motion graphics
 * in the mould of the minimal SaaS launch video — soft neumorphic rings
 * breathing on paper, sentences that build word by word with one slammed
 * emphasis word, product cards that spring in, a colour flood for the offer,
 * and out. Under a minute, made for feeds.
 *
 * Same contract as the other film: every visible property is a function of
 * one number, the current time. Nothing reads the wall clock, so the recorder
 * can photograph it frame by frame and the result is exact.
 */

/* ----------------------------------------------------------------- easing */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutQuint = (x: number) => 1 - Math.pow(1 - x, 5);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** Overshoots to ~1.1 then settles — the spring in every pop. */
function backOut(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
const seg = (t: number, from: number, dur: number) => clamp01((t - from) / dur);

function beatOpacity(t: number, start: number, dur: number, fade: number): number {
  if (t < start - fade || t > start + dur + fade) return 0;
  return Math.min(seg(t, start - fade, fade), 1 - seg(t, start + dur, fade));
}

/* --------------------------------------------------------------- timeline */

type Word = { text: string; accent?: boolean; clay?: boolean };

type Kinetic = {
  kind: "kinetic";
  start: number;
  dur: number;
  words: Word[];
  /** Frame-relative size multiplier for short punchy lines. */
  size?: number;
};

type Shot = {
  kind: "shot";
  start: number;
  dur: number;
  demo: React.ReactNode;
  words: Word[];
  sub?: string;
  from: "left" | "right";
};

type Beat = Kinetic | Shot;

/**
 * The cut. Three hooks, a breath, the reveal, four product shots, a rapid
 * burst of feature words, the teal flood with the offer, the end card.
 */
const HOOKS: Kinetic[] = [
  { kind: "kinetic", start: 1100, dur: 3050, words: [{ text: "Too" }, { text: "many" }, { text: "tasks.", accent: true }] },
  { kind: "kinetic", start: 4550, dur: 3050, words: [{ text: "Too" }, { text: "little" }, { text: "time.", accent: true }] },
  { kind: "kinetic", start: 8000, dur: 3600, words: [{ text: "And" }, { text: "your" }, { text: "list" }, { text: "keeps" }, { text: "score.", accent: true, clay: true }] },
  { kind: "kinetic", start: 12100, dur: 2900, size: 1.35, words: [{ text: "Breathe.", accent: true }] },
];

const REVEAL = { start: 15400, dur: 4600 };

const SHOTS: Shot[] = [
  { kind: "shot", start: 20400, dur: 5200, demo: <CaptureDemo />, from: "right", words: [{ text: "Say" }, { text: "it." }, { text: "AI" }, { text: "files", accent: true }, { text: "it.", accent: true }] },
  { kind: "shot", start: 26000, dur: 5200, demo: <TodayDemo />, from: "left", words: [{ text: "A" }, { text: "day" }, { text: "with" }, { text: "edges.", accent: true }] },
  { kind: "shot", start: 31600, dur: 5200, demo: <FreshStartDemo />, from: "right", words: [{ text: "Mornings" }, { text: "start" }, { text: "clean.", accent: true }], sub: "Nothing ever turns red." },
  { kind: "shot", start: 37200, dur: 5000, demo: <FocusDemo />, from: "left", words: [{ text: "One" }, { text: "thing" }, { text: "at" }, { text: "a" }, { text: "time.", accent: true }] },
];

const RAPID: { start: number; words: Word[] }[] = [
  { start: 42600, words: [{ text: "Share" }, { text: "lists.", accent: true }] },
  { start: 43600, words: [{ text: "Lock" }, { text: "what's" }, { text: "private.", accent: true }] },
  { start: 44600, words: [{ text: "See" }, { text: "the" }, { text: "month.", accent: true }] },
  { start: 45600, words: [{ text: "Never" }, { text: "feel" }, { text: "behind.", accent: true }] },
];

const FLOOD = { start: 46900, dur: 4100 };
const END = { start: 51300 };
export const DURATION = 56000;

/** Demo-bearing beats, for scrubbing their CSS animations from beat-start. */
const SCRUB_BEATS = SHOTS.map((s) => ({ start: s.start, dur: s.dur }));

/** Ripple bursts: rings that expand from the centre and die. */
const BURSTS: { at: number; big?: boolean; sun?: boolean }[] = [
  { at: 1900 },
  { at: 5350 },
  { at: 9450 },
  { at: 12300, big: true, sun: true },
  { at: 15700, big: true, sun: true },
  { at: 42600 },
  { at: 43600 },
  { at: 44600 },
  { at: 45600 },
  { at: 51500, big: true, sun: true },
];

/* ----------------------------------------------------------------- layout */

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

/* ------------------------------------------------------------------ rings */

/**
 * The neumorphic field: concentric embossed circles, breathing so slowly the
 * motion is felt rather than seen. Alternating raised and pressed circles is
 * what gives the field its depth of a soft relief rather than of a target.
 */
function RingField({ t, cx, cy, unit, fade }: { t: number; cx: number; cy: number; unit: number; fade: number }) {
  const RINGS = [1560, 1160, 800, 470];
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, opacity: fade }}>
      {RINGS.map((d, i) => {
        const breathe = 1 + 0.022 * Math.sin((t / 8200) * Math.PI * 2 + i * 0.95);
        const size = d * unit * breathe;
        const raised = i % 2 === 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(${cx}% - ${size / 2}px)`,
              top: `calc(${cy}% - ${size / 2}px)`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "var(--color-paper)",
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

/** One expanding ripple ring, three echoes deep. */
function Burst({ t, at, cx, cy, unit, big, sun }: { t: number; at: number; cx: number; cy: number; unit: number; big?: boolean; sun?: boolean }) {
  const echoes = [0, 200, 420];
  const reach = (big ? 2100 : 1300) * unit;
  return (
    <>
      {echoes.map((delay, i) => {
        const p = seg(t, at + delay, big ? 1900 : 1400);
        if (p <= 0 || p >= 1) return null;
        const size = lerp(120 * unit, reach, easeOut(p));
        return (
          <div
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              left: `calc(${cx}% - ${size / 2}px)`,
              top: `calc(${cy}% - ${size / 2}px)`,
              width: size,
              height: size,
              borderRadius: "50%",
              border: `${Math.max(1.5, 2.5 * unit)}px solid ${sun ? "var(--color-sun)" : "var(--color-ink)"}`,
              opacity: (1 - p) * (sun ? 0.4 : 0.16),
            }}
          />
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ words */

/**
 * A sentence that assembles itself. Plain words rise in quietly; the accent
 * word slams down from half again its size, serif and italic, and lands with
 * a ripple. The contrast between the two arrivals IS the style.
 */
function KineticLine({
  t,
  start,
  words,
  fontSize,
  exitAt,
  align = "center",
}: {
  t: number;
  start: number;
  words: Word[];
  fontSize: number;
  exitAt: number;
  align?: "left" | "center";
}) {
  const gone = seg(t, exitAt, 380);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "left" ? "flex-start" : "center",
        columnGap: fontSize * 0.26,
        rowGap: fontSize * 0.06,
        opacity: 1 - gone,
        transform: `translateY(${-26 * gone}px)`,
        filter: gone > 0 ? `blur(${gone * 6}px)` : undefined,
      }}
    >
      {words.map((w, i) => {
        const wStart = start + i * 240 + (w.accent ? 120 : 0);
        const p = seg(t, wStart, w.accent ? 520 : 460);
        if (p <= 0) return null;
        const scale = w.accent ? lerp(1.55, 1, easeOutQuint(p)) : lerp(0.96, 1, backOut(p));
        const rise = w.accent ? 0 : lerp(0.34 * fontSize, 0, easeOut(p));
        return (
          <span
            key={i}
            className={w.accent ? "font-display" : undefined}
            style={{
              fontSize,
              lineHeight: 1.12,
              fontWeight: w.accent ? 500 : 600,
              fontStyle: w.accent ? "italic" : undefined,
              letterSpacing: w.accent ? "-0.02em" : "-0.035em",
              color: w.clay
                ? "var(--color-clay)"
                : w.accent
                  ? "var(--color-ink)"
                  : "var(--color-ink-faint)",
              opacity: clamp01(p * 1.5),
              transform: `translateY(${rise}px) scale(${scale})`,
              transformOrigin: align === "left" ? "left 70%" : "center 70%",
              filter: p < 1 ? `blur(${(1 - p) * 9}px)` : undefined,
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

/* ------------------------------------------------------------------- film */

export function VideoLaunchFilm() {
  const stage = useStage();
  const [t, setT] = useState(0);

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
      await nextFrame();
      await nextFrame();
      // demo CSS animations run from the start of the shot they live in
      const active = SCRUB_BEATS.filter((b) => ms >= b.start - 900 && ms <= b.start + b.dur + 900);
      const base = active.length > 0 ? active[active.length - 1].start : 0;
      for (const anim of document.getAnimations()) {
        anim.pause();
        try {
          anim.currentTime = Math.max(0, ms - base);
        } catch {
          // a finished, non-looping animation refuses a new time; harmless
        }
      }
      await nextFrame();
    };
    w.__ready = true;
    return () => {
      delete w.__seek;
      delete w.__ready;
    };
  }, []);

  const unit = stage.portrait ? stage.w / 1080 : stage.w / 1920;
  const { portrait } = stage;

  // the field sits right of centre in landscape, like the reference; the
  // hooks type left of it, into the empty paper
  const ringCx = portrait ? 50 : 60;
  const ringCy = portrait ? 42 : 46;

  const fieldIn = easeOut(seg(t, 0, 1400));
  const floodP = easeInOut(seg(t, FLOOD.start, 850));
  const floodOut = easeInOut(seg(t, FLOOD.start + FLOOD.dur - 700, 700));
  const floodR = lerp(0, 160, floodP) * (1 - floodOut);

  const hookSize = (portrait ? 96 : 116) * unit;

  /* reveal */
  const rIn = seg(t, REVEAL.start, 900);
  const rOut = 1 - seg(t, REVEAL.start + REVEAL.dur - 500, 500);
  const markP = backOut(seg(t, REVEAL.start + 150, 950));

  /* end card */
  const eIn = seg(t, END.start, 800);
  const eMark = backOut(seg(t, END.start + 100, 900));

  const demoScale = ((portrait ? stage.w * 0.78 : stage.w * 0.34) / 420) * 1;

  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        position: "relative",
        background: "var(--color-paper)",
        color: "var(--color-ink)",
      }}
    >
      <RingField t={t} cx={ringCx} cy={ringCy} unit={unit} fade={fieldIn} />
      {BURSTS.map((b) => (
        <Burst key={b.at} t={t} at={b.at} cx={ringCx} cy={ringCy} unit={unit} big={b.big} sun={b.sun} />
      ))}

      {/* -------------------------------------------------------- the hooks */}
      {HOOKS.map((beat, i) => {
        const o = beatOpacity(t, beat.start, beat.dur, 250);
        if (o <= 0.001) return null;
        const isBreathe = i === 3;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: portrait || isBreathe ? "center" : "flex-start",
              paddingLeft: portrait || isBreathe ? 0 : "9%",
              paddingRight: portrait ? "6%" : undefined,
              opacity: o,
            }}
          >
            <div style={{ maxWidth: portrait ? "94%" : "62%" }}>
              <KineticLine
                t={t}
                start={beat.start}
                words={beat.words}
                fontSize={hookSize * (beat.size ?? 1) * (isBreathe ? 1 : 1)}
                exitAt={beat.start + beat.dur - 150}
                align={portrait || isBreathe ? "center" : "left"}
              />
            </div>
          </div>
        );
      })}

      {/* Breathe lands in teal: recolour just that word via a tinted overlay */}
      {t > 12100 && t < 15300 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            opacity: beatOpacity(t, 12100, 2900, 250),
            pointerEvents: "none",
          }}
        >
          <span
            className="font-display"
            style={{
              fontSize: hookSize * 1.35,
              fontStyle: "italic",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: "var(--color-sun)",
              opacity: clamp01(seg(t, 12220, 520) * 1.5),
              transform: `scale(${lerp(1.55, 1, easeOutQuint(seg(t, 12220, 520)))})`,
              filter: seg(t, 12220, 520) < 1 ? `blur(${(1 - seg(t, 12220, 520)) * 9}px)` : undefined,
            }}
          >
            Breathe.
          </span>
        </div>
      )}

      {/* ----------------------------------------------------------- reveal */}
      {t >= REVEAL.start - 100 && t <= REVEAL.start + REVEAL.dur + 600 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            opacity: clamp01(rIn * 1.4) * rOut,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 20 * unit,
                transform: `scale(${Math.max(0.001, markP)})`,
              }}
            >
              <span style={{ color: "var(--color-sun)", transform: `rotate(${lerp(-120, 0, markP)}deg)`, display: "inline-flex" }}>
                <Mark size={(portrait ? 96 : 108) * unit} />
              </span>
              <span
                className="font-display"
                style={{
                  fontSize: (portrait ? 104 : 118) * unit,
                  letterSpacing: "-0.03em",
                  opacity: clamp01(seg(t, REVEAL.start + 550, 700) * 1.4),
                  transform: `translateX(${lerp(-18, 0, easeOut(seg(t, REVEAL.start + 550, 700))) * unit}px)`,
                }}
              >
                kairo
              </span>
            </div>
            <p
              style={{
                marginTop: 26 * unit,
                fontSize: (portrait ? 40 : 36) * unit,
                color: "var(--color-ink-soft)",
                letterSpacing: "0.01em",
                opacity: clamp01(seg(t, REVEAL.start + 1250, 800)),
                transform: `translateY(${lerp(14, 0, easeOut(seg(t, REVEAL.start + 1250, 800)))}px)`,
              }}
            >
              A daily planner that forgives.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ shots */}
      {SHOTS.map((shot, i) => {
        const o = beatOpacity(t, shot.start, shot.dur, 350);
        if (o <= 0.001) return null;
        const inP = backOut(seg(t, shot.start, 750));
        const float = 7 * Math.sin((t - shot.start) / 1350 + i * 2.1);
        const dir = shot.from === "left" ? -1 : 1;
        const textSize = (portrait ? 72 : 80) * unit;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: portrait ? "column" : shot.from === "left" ? "row" : "row-reverse",
              alignItems: "center",
              justifyContent: "center",
              gap: portrait ? 54 * unit : 90 * unit,
              padding: portrait ? `${90 * unit}px 6%` : "0 7%",
              opacity: o,
            }}
          >
            {/* the sentence */}
            <div style={{ flex: portrait ? undefined : "0 1 46%", width: portrait ? "94%" : undefined }}>
              <KineticLine
                t={t}
                start={shot.start + 350}
                words={shot.words}
                fontSize={textSize}
                exitAt={shot.start + shot.dur - 100}
                align={portrait ? "center" : "left"}
              />
              {shot.sub && (
                <p
                  style={{
                    marginTop: 22 * unit,
                    fontSize: textSize * 0.42,
                    color: "var(--color-ink-soft)",
                    textAlign: portrait ? "center" : "left",
                    opacity: clamp01(seg(t, shot.start + 1900, 700)),
                    transform: `translateY(${lerp(12, 0, easeOut(seg(t, shot.start + 1900, 700)))}px)`,
                  }}
                >
                  {shot.sub}
                </p>
              )}
            </div>
            {/* the card */}
            <div
              style={{
                transform: `translateY(${lerp(110, 0, inP) + float}px) translateX(${lerp(dir * 70, 0, inP)}px) rotate(${lerp(dir * 6, dir * 1.2, inP)}deg) scale(${lerp(0.92, 1, inP)})`,
              }}
            >
              <div
                style={{
                  width: "fit-content",
                  borderRadius: 30 * unit,
                  background: "var(--color-paper)",
                  boxShadow: `0 ${26 * unit}px ${70 * unit}px rgba(28,38,36,0.16), 0 ${6 * unit}px ${18 * unit}px rgba(28,38,36,0.08)`,
                  padding: 10 * unit,
                }}
              >
                {/* zoom, not transform: it scales layout too, so the card
                    wraps the demo at its rendered size. Chrome-only is fine —
                    this page only ever renders in the recorder. */}
                <div style={{ width: 420, zoom: demoScale }}>{shot.demo}</div>
              </div>
            </div>
          </div>
        );
      })}

      {/* ------------------------------------------------------ rapid burst */}
      {RAPID.map((r, i) => {
        const o = beatOpacity(t, r.start, 780, 140);
        if (o <= 0.001) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              opacity: o,
            }}
          >
            <div style={{ transform: `translateY(${(i % 2 === 0 ? -1 : 1) * 30 * unit}px)` }}>
              <KineticLine
                t={t}
                start={r.start - 120}
                words={r.words}
                fontSize={(portrait ? 92 : 104) * unit}
                exitAt={r.start + 760}
              />
            </div>
          </div>
        );
      })}

      {/* ------------------------------------------------------- teal flood */}
      {floodR > 0.5 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--color-sun)",
            clipPath: `circle(${floodR}% at 50% 50%)`,
            display: "grid",
            placeItems: "center",
          }}
        >
          {/* white ripples inside the flood */}
          {[0, 260, 540].map((delay, i) => {
            const p = seg(t, FLOOD.start + 500 + delay, 2000);
            if (p <= 0 || p >= 1) return null;
            const size = lerp(200 * unit, 2000 * unit, easeOut(p));
            return (
              <div
                key={i}
                aria-hidden
                style={{
                  position: "absolute",
                  left: `calc(50% - ${size / 2}px)`,
                  top: `calc(50% - ${size / 2}px)`,
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  border: `${2.5 * unit}px solid rgba(255,255,255,0.35)`,
                  opacity: 1 - p,
                }}
              />
            );
          })}
          <div style={{ textAlign: "center", color: "#fff" }}>
            <div
              className="font-display"
              style={{
                fontSize: (portrait ? 128 : 148) * unit,
                fontStyle: "italic",
                fontWeight: 500,
                letterSpacing: "-0.025em",
                lineHeight: 1,
                opacity: clamp01(seg(t, FLOOD.start + 450, 500) * 1.5),
                transform: `scale(${lerp(1.5, 1, easeOutQuint(seg(t, FLOOD.start + 450, 550)))})`,
                filter: seg(t, FLOOD.start + 450, 550) < 1 ? `blur(${(1 - seg(t, FLOOD.start + 450, 550)) * 10}px)` : undefined,
              }}
            >
              7 days free.
            </div>
            <p
              style={{
                marginTop: 26 * unit,
                fontSize: (portrait ? 44 : 42) * unit,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                opacity: clamp01(seg(t, FLOOD.start + 1250, 600)) * 0.92,
                transform: `translateY(${lerp(16, 0, easeOut(seg(t, FLOOD.start + 1250, 600)))}px)`,
              }}
            >
              Everything unlocked. No card.
            </p>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- end card */}
      {t >= END.start - 100 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            opacity: clamp01(eIn * 1.4),
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 18 * unit,
                transform: `scale(${Math.max(0.001, eMark)})`,
              }}
            >
              <span style={{ color: "var(--color-sun)", transform: `rotate(${lerp(-90, 0, eMark)}deg)`, display: "inline-flex" }}>
                <Mark size={(portrait ? 84 : 92) * unit} />
              </span>
              <span className="font-display" style={{ fontSize: (portrait ? 92 : 100) * unit, letterSpacing: "-0.03em" }}>
                kairo
              </span>
            </div>
            <p
              style={{
                marginTop: 22 * unit,
                fontSize: (portrait ? 38 : 34) * unit,
                color: "var(--color-ink-soft)",
                opacity: clamp01(seg(t, END.start + 900, 700)),
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
                opacity: clamp01(seg(t, END.start + 1500, 700)),
                transform: `scale(${lerp(0.92, 1, backOut(seg(t, END.start + 1500, 800)))})`,
              }}
            >
              kairo.jaimansoni.com
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
