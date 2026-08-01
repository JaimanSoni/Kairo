"use client";

import { useEffect, useState } from "react";
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
 * in the mould of the minimal SaaS launch video — soft neumorphic rings that
 * ripple the whole way through, sentences that build word by word with one
 * slammed emphasis word, product cards on springs, a camera that punches in
 * on every landing, a teal flood for the offer, and out. Under fifty
 * seconds, made for feeds.
 *
 * Same contract as the other film: every visible property is a function of
 * one number, the current time. In a browser it free-runs on a loop as its
 * own preview; the recorder's first __seek takes the wheel permanently and
 * from then on nothing reads the wall clock.
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

/** Word cadence: how the pops are spaced. Fast — the cut lives on rhythm. */
const CADENCE = 165;
const ACCENT_LAG = 90;

const HOOKS: Kinetic[] = [
  { kind: "kinetic", start: 800, dur: 2350, words: [{ text: "Too" }, { text: "many" }, { text: "tasks.", accent: true }] },
  { kind: "kinetic", start: 3400, dur: 2350, words: [{ text: "Too" }, { text: "little" }, { text: "time.", accent: true }] },
  { kind: "kinetic", start: 6000, dur: 3000, words: [{ text: "And" }, { text: "your" }, { text: "list" }, { text: "keeps" }, { text: "score.", accent: true, clay: true }] },
];

const BREATHE = { start: 9400, dur: 2400 };
const REVEAL = { start: 12200, dur: 4000 };

const SHOTS: Shot[] = [
  { kind: "shot", start: 16600, dur: 4500, demo: <CaptureDemo />, from: "right", words: [{ text: "Say" }, { text: "it." }, { text: "AI" }, { text: "files", accent: true }, { text: "it.", accent: true }] },
  { kind: "shot", start: 21400, dur: 4500, demo: <TodayDemo />, from: "left", words: [{ text: "A" }, { text: "day" }, { text: "with" }, { text: "edges.", accent: true }] },
  { kind: "shot", start: 26200, dur: 4500, demo: <FreshStartDemo />, from: "right", words: [{ text: "Mornings" }, { text: "start" }, { text: "clean.", accent: true }], sub: "Nothing ever turns red." },
  { kind: "shot", start: 31000, dur: 4500, demo: <FocusDemo />, from: "left", words: [{ text: "One" }, { text: "thing" }, { text: "at" }, { text: "a" }, { text: "time.", accent: true }] },
];

const RAPID: { start: number; words: Word[] }[] = [
  { start: 35900, words: [{ text: "Share" }, { text: "lists.", accent: true }] },
  { start: 36750, words: [{ text: "Lock" }, { text: "what's" }, { text: "private.", accent: true }] },
  { start: 37600, words: [{ text: "See" }, { text: "the" }, { text: "month.", accent: true }] },
  { start: 38450, words: [{ text: "Never" }, { text: "feel" }, { text: "behind.", accent: true }] },
];
const RAPID_DUR = 700;

const FLOOD = { start: 39500, dur: 3800 };
const END = { start: 43600 };
export const DURATION = 48000;

/** How much faster the in-card demos run than they do on the landing page. */
const DEMO_SPEED = 1.4;

/** Demo-bearing beats, for scrubbing their CSS animations from beat-start. */
const SCRUB_BEATS = SHOTS.map((s) => ({ start: s.start, dur: s.dur }));

/** When an accent word actually lands, for bursts and camera kicks. */
const accentAt = (k: Kinetic | Shot, textStart: number) => {
  const i = k.words.findIndex((w) => w.accent);
  return textStart + i * CADENCE + ACCENT_LAG + 220;
};

/** Ripple bursts: rings that expand from the centre and die. */
const BURSTS: { at: number; big?: boolean; sun?: boolean }[] = [
  { at: accentAt(HOOKS[0], HOOKS[0].start) },
  { at: accentAt(HOOKS[1], HOOKS[1].start) },
  { at: accentAt(HOOKS[2], HOOKS[2].start) },
  { at: BREATHE.start + 300, big: true, sun: true },
  { at: REVEAL.start + 250, big: true, sun: true },
  ...RAPID.map((r) => ({ at: r.start + 150 })),
  { at: END.start + 200, big: true, sun: true },
];

/**
 * Camera kicks: a sharp little punch-in that decays, one per landing. The
 * sum of live kicks rides on a slow push across the whole film — the frame
 * is never quite still, which is most of what "expensive" looks like.
 */
const KICKS: { at: number; amp: number }[] = [
  ...HOOKS.map((h) => ({ at: accentAt(h, h.start), amp: 0.028 })),
  { at: BREATHE.start + 320, amp: 0.034 },
  { at: REVEAL.start + 350, amp: 0.03 },
  ...SHOTS.map((s) => ({ at: s.start + 280, amp: 0.024 })),
  ...RAPID.map((r) => ({ at: r.start + 180, amp: 0.034 })),
  { at: FLOOD.start + 400, amp: 0.045 },
  { at: END.start + 1250, amp: 0.026 },
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
 * The neumorphic field. Alternating raised and pressed circles give it the
 * depth of a soft relief; a visible breath, a slow drift of the whole
 * centre, and a ripple emitted every couple of seconds keep it alive in
 * every single frame. `zoom` lets a beat dive through the rings.
 */
function RingField({ t, cx, cy, unit, fade, zoom }: { t: number; cx: number; cy: number; unit: number; fade: number; zoom: number }) {
  const RINGS = [1560, 1160, 800, 470];
  const dx = 1.6 * Math.sin(t / 5100);
  const dy = 1.2 * Math.cos(t / 6300);
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, opacity: fade }}>
      {RINGS.map((d, i) => {
        const breathe = 1 + 0.05 * Math.sin((t / 4600) * Math.PI * 2 + i * 1.15);
        const size = d * unit * breathe * zoom;
        const raised = i % 2 === 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(${cx + dx}% - ${size / 2}px)`,
              top: `calc(${cy + dy}% - ${size / 2}px)`,
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
      {/* a soft light that orbits the field — cheap life in every frame */}
      <div
        style={{
          position: "absolute",
          left: `calc(${cx + 9 * Math.cos(t / 4200)}% - ${430 * unit}px)`,
          top: `calc(${cy + 9 * Math.sin(t / 4200)}% - ${430 * unit}px)`,
          width: 860 * unit,
          height: 860 * unit,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 62%)",
        }}
      />
      {/* the heartbeat: one ripple born every 2.2s, for the whole film */}
      {Array.from({ length: Math.ceil(DURATION / 2200) }, (_, k) => {
        const p = seg(t, k * 2200, 2600);
        if (p <= 0 || p >= 1) return null;
        const size = lerp(180 * unit, 1750 * unit, easeOut(p)) * zoom;
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: `calc(${cx + dx}% - ${size / 2}px)`,
              top: `calc(${cy + dy}% - ${size / 2}px)`,
              width: size,
              height: size,
              borderRadius: "50%",
              border: `${Math.max(1, 1.8 * unit)}px solid var(--color-ink)`,
              opacity: (1 - p) * 0.07,
            }}
          />
        );
      })}
    </div>
  );
}

/** One expanding ripple ring, three echoes deep — the loud punctuation. */
function Burst({ t, at, cx, cy, unit, big, sun }: { t: number; at: number; cx: number; cy: number; unit: number; big?: boolean; sun?: boolean }) {
  const echoes = [0, 150, 320];
  const reach = (big ? 2100 : 1300) * unit;
  return (
    <>
      {echoes.map((delay, i) => {
        const p = seg(t, at + delay, big ? 1500 : 1050);
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
              opacity: (1 - p) * (sun ? 0.42 : 0.17),
            }}
          />
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ words */

/**
 * A sentence that assembles itself, fast. Plain words rise in; the accent
 * word slams down from over half again its size, serif and italic, and
 * lands with a ripple and a camera kick. The contrast between the two
 * arrivals IS the style.
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
  const gone = seg(t, exitAt, 300);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "left" ? "flex-start" : "center",
        columnGap: fontSize * 0.26,
        rowGap: fontSize * 0.06,
        opacity: 1 - gone,
        transform: `translateY(${-30 * gone}px)`,
        filter: gone > 0 ? `blur(${gone * 7}px)` : undefined,
      }}
    >
      {words.map((w, i) => {
        const wStart = start + i * CADENCE + (w.accent ? ACCENT_LAG : 0);
        const p = seg(t, wStart, w.accent ? 400 : 340);
        if (p <= 0) return null;
        const scale = w.accent ? lerp(1.6, 1, easeOutQuint(p)) : lerp(0.93, 1, backOut(p));
        const rise = w.accent ? 0 : lerp(0.36 * fontSize, 0, easeOut(p));
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
              opacity: clamp01(p * 1.6),
              transform: `translateY(${rise}px) scale(${scale})`,
              transformOrigin: align === "left" ? "left 70%" : "center 70%",
              filter: p < 1 ? `blur(${(1 - p) * 10}px)` : undefined,
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
      for (const anim of document.getAnimations()) anim.playbackRate = DEMO_SPEED;
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

  // the field sits right of centre in landscape, like the reference; the
  // hooks type left of it, into the empty paper
  const ringCx = portrait ? 50 : 60;
  const ringCy = portrait ? 42 : 46;

  const fieldIn = easeOut(seg(t, 0, 900));
  const floodP = easeInOut(seg(t, FLOOD.start, 700));
  const floodOut = easeInOut(seg(t, FLOOD.start + FLOOD.dur - 600, 600));
  const floodR = lerp(0, 160, floodP) * (1 - floodOut);

  /* the camera: a slow push for the whole film plus a kick on every landing */
  let kick = 0;
  for (const k of KICKS) {
    if (t >= k.at && t < k.at + 1400) kick += k.amp * Math.exp(-(t - k.at) / 260);
  }
  const camera = lerp(1, 1.05, t / DURATION) + kick;

  /* the dive: rings blow up as the film passes through them */
  const dive =
    1 +
    1.05 * easeOut(seg(t, REVEAL.start - 500, 700)) * (1 - seg(t, REVEAL.start + 250, 900)) +
    0.75 * easeOut(seg(t, FLOOD.start - 350, 550)) * (1 - seg(t, FLOOD.start + 300, 800));

  const hookSize = (portrait ? 96 : 116) * unit;

  /* reveal */
  const rIn = seg(t, REVEAL.start, 700);
  const rOut = 1 - seg(t, REVEAL.start + REVEAL.dur - 400, 400);
  const markP = backOut(seg(t, REVEAL.start + 120, 750));

  /* end card */
  const eIn = seg(t, END.start, 650);
  const eMark = backOut(seg(t, END.start + 80, 750));

  const demoScale = (portrait ? stage.w * 0.78 : stage.w * 0.34) / 420;

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
      {/* everything the camera sees */}
      <div style={{ position: "absolute", inset: 0, transform: `scale(${camera})`, transformOrigin: "center 48%" }}>
        <RingField t={t} cx={ringCx} cy={ringCy} unit={unit} fade={fieldIn} zoom={dive} />
        {BURSTS.map((b) => (
          <Burst key={b.at} t={t} at={b.at} cx={ringCx} cy={ringCy} unit={unit} big={b.big} sun={b.sun} />
        ))}

        {/* ------------------------------------------------------ the hooks */}
        {HOOKS.map((beat, i) => {
          const o = beatOpacity(t, beat.start, beat.dur, 200);
          if (o <= 0.001) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: portrait ? "center" : "flex-start",
                paddingLeft: portrait ? 0 : "9%",
                paddingRight: portrait ? "6%" : undefined,
                opacity: o,
              }}
            >
              <div style={{ maxWidth: portrait ? "94%" : "62%" }}>
                <KineticLine
                  t={t}
                  start={beat.start}
                  words={beat.words}
                  fontSize={hookSize * (beat.size ?? 1)}
                  exitAt={beat.start + beat.dur - 120}
                  align={portrait ? "center" : "left"}
                />
              </div>
            </div>
          );
        })}

        {/* "Breathe." lands alone, in teal, dead centre */}
        {t > BREATHE.start - 100 && t < BREATHE.start + BREATHE.dur + 300 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              opacity: beatOpacity(t, BREATHE.start, BREATHE.dur, 200),
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
                opacity: clamp01(seg(t, BREATHE.start + 90, 400) * 1.6),
                transform: `scale(${lerp(1.6, 1, easeOutQuint(seg(t, BREATHE.start + 90, 400)))})`,
                filter:
                  seg(t, BREATHE.start + 90, 400) < 1
                    ? `blur(${(1 - seg(t, BREATHE.start + 90, 400)) * 10}px)`
                    : undefined,
              }}
            >
              Breathe.
            </span>
          </div>
        )}

        {/* --------------------------------------------------------- reveal */}
        {t >= REVEAL.start - 100 && t <= REVEAL.start + REVEAL.dur + 500 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              opacity: clamp01(rIn * 1.5) * rOut,
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
                <span style={{ color: "var(--color-sun)", transform: `rotate(${lerp(-140, 0, markP)}deg)`, display: "inline-flex" }}>
                  <Mark size={(portrait ? 96 : 108) * unit} />
                </span>
                <span
                  className="font-display"
                  style={{
                    fontSize: (portrait ? 104 : 118) * unit,
                    letterSpacing: "-0.03em",
                    opacity: clamp01(seg(t, REVEAL.start + 420, 500) * 1.5),
                    transform: `translateX(${lerp(-20, 0, easeOut(seg(t, REVEAL.start + 420, 500))) * unit}px)`,
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
                  opacity: clamp01(seg(t, REVEAL.start + 950, 600)),
                  transform: `translateY(${lerp(16, 0, easeOut(seg(t, REVEAL.start + 950, 600)))}px)`,
                }}
              >
                A daily planner that forgives.
              </p>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- shots */}
        {SHOTS.map((shot, i) => {
          const o = beatOpacity(t, shot.start, shot.dur, 280);
          if (o <= 0.001) return null;
          const inP = backOut(seg(t, shot.start, 560));
          const float = 8 * Math.sin((t - shot.start) / 1100 + i * 2.1);
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
                  start={shot.start + 260}
                  words={shot.words}
                  fontSize={textSize}
                  exitAt={shot.start + shot.dur - 80}
                  align={portrait ? "center" : "left"}
                />
                {shot.sub && (
                  <p
                    style={{
                      marginTop: 22 * unit,
                      fontSize: textSize * 0.42,
                      color: "var(--color-ink-soft)",
                      textAlign: portrait ? "center" : "left",
                      opacity: clamp01(seg(t, shot.start + 1400, 550)),
                      transform: `translateY(${lerp(14, 0, easeOut(seg(t, shot.start + 1400, 550)))}px)`,
                    }}
                  >
                    {shot.sub}
                  </p>
                )}
              </div>
              {/* the card */}
              <div
                style={{
                  transform: `translateY(${lerp(130, 0, inP) + float}px) translateX(${lerp(dir * 90, 0, inP)}px) rotate(${lerp(dir * 7, dir * 1.2, inP)}deg) scale(${lerp(0.9, 1, inP)})`,
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

        {/* ---------------------------------------------------- rapid burst */}
        {RAPID.map((r, i) => {
          const o = beatOpacity(t, r.start, RAPID_DUR, 120);
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
                  start={r.start - 100}
                  words={r.words}
                  fontSize={(portrait ? 92 : 104) * unit}
                  exitAt={r.start + RAPID_DUR - 30}
                />
              </div>
            </div>
          );
        })}
      </div>

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
          {[0, 220, 460].map((delay, i) => {
            const p = seg(t, FLOOD.start + 400 + delay, 1600);
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
          <div style={{ textAlign: "center", color: "#fff", transform: `scale(${1 + kick * 1.6})` }}>
            <div
              className="font-display"
              style={{
                fontSize: (portrait ? 128 : 148) * unit,
                fontStyle: "italic",
                fontWeight: 500,
                letterSpacing: "-0.025em",
                lineHeight: 1,
                opacity: clamp01(seg(t, FLOOD.start + 380, 420) * 1.6),
                transform: `scale(${lerp(1.55, 1, easeOutQuint(seg(t, FLOOD.start + 380, 460)))})`,
                filter:
                  seg(t, FLOOD.start + 380, 460) < 1
                    ? `blur(${(1 - seg(t, FLOOD.start + 380, 460)) * 11}px)`
                    : undefined,
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
                opacity: clamp01(seg(t, FLOOD.start + 950, 450)) * 0.92,
                transform: `translateY(${lerp(18, 0, easeOut(seg(t, FLOOD.start + 950, 450)))}px)`,
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
            opacity: clamp01(eIn * 1.5),
          }}
        >
          <div style={{ textAlign: "center", transform: `scale(${1 + kick})` }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 18 * unit,
                transform: `scale(${Math.max(0.001, eMark)})`,
              }}
            >
              <span style={{ color: "var(--color-sun)", transform: `rotate(${lerp(-110, 0, eMark)}deg)`, display: "inline-flex" }}>
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
                opacity: clamp01(seg(t, END.start + 700, 550)),
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
                opacity: clamp01(seg(t, END.start + 1150, 550)),
                transform: `scale(${lerp(0.9, 1, backOut(seg(t, END.start + 1150, 650)))})`,
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
