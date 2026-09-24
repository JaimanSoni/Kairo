"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { GardenScene } from "../garden/scene";

/**
 * The garden is most of the cost of a frame: painted art, weather, and a
 * plant apiece drawn in SVG. Left alone it redrew sixty times a second for a
 * picture that changes a handful of times a second, and the end of the film
 * -- every plant grown, rain, rainbow, petals -- fell to half frame rate.
 * Memoised, and handed a bed that keeps its identity between ticks, it
 * redraws only when something in it has actually changed.
 */
const MemoScene = memo(GardenScene);
import { Plot } from "../garden/plot";
import { setSkyPreview } from "../garden/live-sky";
import { strengthLevel, type HabitView, type LiveHabit } from "@/lib/habits-shared";
import type { Moments, PlotInfo } from "../garden/use-garden";

/**
 * The garden film — fifteen seconds of the habits garden, and nothing but it.
 *
 * Every frame here is the real component. The sky, the hour, the weather, the
 * rain, the rainbow when the day is done, the plants and the ground they grow
 * in are `GardenScene` and `GardenBed` exactly as Today and the Habits page
 * draw them; the film only decides what to hand them, and when. The hour and
 * the weather move through the same preview the admin sky panel uses, so what
 * gets recorded is the product running, not a drawing of it.
 *
 * Same contract as the other films: everything is a function of one number
 * and nothing reads the wall clock, so the recorder can set a time,
 * photograph it, and repeat:
 *
 *   LAUNCH_URL=http://localhost:3010/gardenlaunch node scripts/record-launch.mjs --aspect 16:9 --out kairo-garden.mp4
 *
 * Left alone in a browser it plays and loops, which is what a screen
 * recording needs.
 */

/* ----------------------------------------------------------------- easing */

/** Nothing to do here: the film is watched, not tended. */
const noop = () => {};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
const seg = (t: number, from: number, dur: number) => clamp01((t - from) / dur);
const beat = (t: number, start: number, dur: number, fade: number) =>
  t < start - fade || t > start + dur + fade ? 0 : Math.min(seg(t, start - fade, fade), 1 - seg(t, start + dur, fade));

/* ------------------------------------------------------------------ time */

export const DURATION = 26000;

/**
 * The weather never cuts. It walks to the next thing along: sun to a few
 * clouds, clouds to an overcast, a drizzle, then the rain -- and out the same
 * way, easing to showers so the sun is already back through it when the
 * rainbow comes. The scene tweens the gloom over 700ms and the sun over a
 * second between any two of these, so neighbouring steps dissolve into each
 * other instead of switching.
 */
const SKIES: { at: number; w: string }[] = [
  { at: 0, w: "partly" },
  { at: 4600, w: "clear" },
  { at: 11000, w: "partly" },
  { at: 12400, w: "cloudy" },
  { at: 13400, w: "drizzle" },
  { at: 14200, w: "rain" },
  { at: 16600, w: "drizzle" },
  { at: 17600, w: "showers" },
  { at: 19800, w: "partly" },
  { at: 20900, w: "clear" },
];

const B = {
  first: 2900, // one plant, at sunrise
  more: 4600, // the others arrive, unhurried
  rain: 14200, // real weather
  done: 18700, // the day is done: the rainbow
  end: 21300, // the card
};

/* -------------------------------------------------------- what grows here */

type Seed = { id: string; name: string; species: HabitView["species"]; color: HabitView["color"]; at: number };

/** Nine habits, in the order they arrive. */
const SEEDS: Seed[] = [
  { id: "read", name: "Read", species: "sunflower", color: "amber", at: 0 },
  { id: "walk", name: "Walk", species: "tulip", color: "rose", at: 1500 },
  { id: "stretch", name: "Stretch", species: "lavender", color: "lilac", at: 2900 },
  { id: "journal", name: "Journal", species: "monstera", color: "moss", at: 4300 },
  { id: "meditate", name: "Meditate", species: "bonsai", color: "sun", at: 5700 },
  { id: "cook", name: "Cook", species: "strawberry", color: "moss", at: 7100 },
  { id: "water", name: "Water", species: "lotus", color: "sky", at: 8500 },
  { id: "practise", name: "Practise", species: "cherry", color: "rose", at: 9900 },
  { id: "call", name: "Call a friend", species: "apple", color: "amber", at: 11300 },
];

/** A plot the real bed can draw, at whatever stage the film has reached. */
function plotOf(seed: Seed, i: number, stage: number, streak: number, done: boolean): PlotInfo {
  const strength = Math.round(clamp01((stage - 1) / 4) * 100);
  const habit: HabitView = {
    id: seed.id,
    name: seed.name,
    emoji: "🌱",
    species: seed.species,
    color: seed.color,
    seedId: null,
    schedule: { kind: "daily" },
    target: 1,
    unit: "",
    reminder: null,
    why: "",
    startDate: "2026-01-01",
    createdAt: "2026-01-01",
    archivedAt: null,
    order: i,
    growth: strength,
    settled: { through: null, streak, best: streak, drops: 0 },
    harvested: { fruit: 0, golden: 0 },
  };
  const live: LiveHabit = {
    streak,
    best: streak,
    drops: 0,
    dueToday: !done,
    todayCount: done ? 1 : 0,
    todayDone: done,
    week: null,
    rescue: null,
    health: stage >= 4 ? "thriving" : "healthy",
  };
  return { habit, live, strength, level: strengthLevel(strength), stage, due: !done, streak };
}

/* ------------------------------------------------------------------ film */

type Stage = { w: number; h: number; portrait: boolean };

function useStage(): Stage {
  const [stage, setStage] = useState<Stage>({ w: 1920, h: 1080, portrait: false });
  useEffect(() => {
    const read = () => setStage({ w: window.innerWidth, h: window.innerHeight, portrait: window.innerHeight > window.innerWidth });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return stage;
}

export function GardenFilm() {
  const stage = useStage();
  const { w: width, portrait } = stage;
  const [t, setT] = useState(0);

  useEffect(() => {
    const w = window as unknown as { __seek?: (ms: number) => Promise<void>; __duration?: number; __ready?: boolean };
    const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

    let raf = 0;
    let driven = false;
    const t0 = performance.now();
    const freeRun = (now: number) => {
      if (driven) return;
      setT((now - t0) % (DURATION + 1200));
      raf = requestAnimationFrame(freeRun);
    };
    raf = requestAnimationFrame(freeRun);

    w.__duration = DURATION;
    w.__seek = async (ms: number) => {
      driven = true;
      cancelAnimationFrame(raf);
      setT(ms);
      // three frames, not two: the hour and the weather go out through the sky
      // store, so the scene re-renders a beat after the film does
      await nextFrame();
      await nextFrame();
      await nextFrame();
      for (const anim of document.getAnimations()) anim.pause();
      await nextFrame();
    };
    w.__ready = true;
    return () => {
      cancelAnimationFrame(raf);
      delete w.__seek;
      delete w.__ready;
    };
  }, []);

  /* -------------------------------------------------- the hour and the sky */

  // the scene is rebuilt about twelve times a second; the captions, the card
  // and the drift stay at the refresh rate, where they cost nothing
  const tq = Math.round(t / 80) * 80;


  // Sunrise while the first habit takes, morning as the garden fills, a shower
  // at the top of the afternoon, then golden hour for the finish.
  // the hour moves in small steps the scene can glide between, rather than
  // sixty a second the sky store has to absorb
  const minuteRaw =
    tq < B.rain
      ? lerp(6 * 60 + 20, 12 * 60 + 30, easeInOut(seg(tq, B.first - 400, B.rain - B.first)))
      : lerp(12 * 60 + 30, 17 * 60 + 40, easeInOut(seg(tq, B.rain, 7000)));
  const minute = Math.round(minuteRaw / 3) * 3;
  const weather = SKIES.reduce((w, step) => (tq >= step.at ? step.w : w), SKIES[0].w);

  const applied = useRef("");
  useEffect(() => {
    const key = `${minute}|${weather}`;
    if (applied.current === key) return;
    applied.current = key;
    setSkyPreview({ minute, weather: weather as never });
  }, [minute, weather]);

  // the preview belongs to this film, not to the person: hand the sky back
  useEffect(() => () => setSkyPreview({ weather: null, minute: null }), []);

  /* -------------------------------------------------------------- the bed */

  // A phone-shaped frame gets four plants in two rows. Nine at three across
  // were thumbnails with their names cut short; six still had the front row
  // standing over the names behind it. Four are large, clearly named, and
  // clear of each other, which says more about the feature than nine
  // unreadable ones.
  const cast = useMemo(() => (portrait ? SEEDS.slice(0, 4) : SEEDS), [portrait]);
  const perRow = portrait ? 2 : 5;
  /**
   * A tall frame needs its own composition, not the wide one squeezed.
   *
   * The garden is laid out for a screen wider than it is tall: in 9:16 the
   * horizon sits a third of the way down and the rest is empty meadow, which
   * is exactly what the real immersive garden does at this size too. So the
   * portrait cut pushes in from the top: the horizon drops to the middle of
   * the frame, the far meadow falls off the bottom, and what is left is the
   * part worth looking at, closer. The plants are then placed in the band
   * that survives, three to a row, well inside both edges.
   */
  const zoom = portrait ? 1.35 : 1;

  const garden = useMemo(() => {
    const grown = cast.map((seed, i) => {
      const born = B.first + seed.at;
      // each plant grows its four stages over the beats that follow it
      const life = seg(tq, born, 11000);
      const st = 1 + Math.min(4, Math.floor(easeOut(life) * 4.999));
      const streak = Math.round(lerp(1, 96, easeOut(life)));
      const done = tq > B.done - 600 || life > 0.9;
      return { seed, i, born, info: plotOf(seed, i, st, streak, done), stage: st };
    });
    // no watering splash on arrival: a plant that simply comes up is calmer.
    // The burst is kept for the end, where the garden finishes together.
    const moments: Moments = {};
    for (const g of grown) moments[g.seed.id] = { water: 0, burst: tq > B.done ? 1 : 0 };

    // Each shape of frame is planted differently. A wide one has room for five
    // across and a shallow horizon; a phone has two, each big enough to read,
    // so its rows sit much further apart and the back row steps a quarter of a
    // cell sideways to keep out from behind the names in front.
    const plan = portrait
      ? { band: 66, near: 47, far: 74, big: 0.46, small: 0.34, odd: -0.25, even: 0 }
      : { band: 100, near: 19, far: 38, big: 0.52, small: 0.4, odd: 0.5, even: 0 };

    const bed = (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {grown.map((g) => {
          // a plant fades up out of the grass over a second, and never pops
          const up = easeOut(seg(tq, g.born, 1300));
          if (up <= 0) return null;
          const row = Math.floor(g.i / perRow);
          const col = g.i % perRow;
          const rows = Math.max(1, Math.ceil(cast.length / perRow));
          const depth = rows > 1 ? row / (rows - 1) : 0;

          // back rows sit higher, smaller, and offset sideways, so nothing
          // stands directly behind anything else. Portrait keeps to the middle
          // of the frame, because the push-in crops the sides.
          const cell = plan.band / perRow;
          const edge = (100 - plan.band) / 2;
          const left = edge + cell * (col + 0.5) + cell * (row % 2 === 1 ? plan.odd : plan.even);
          // sizes are pre-zoom: the push-in enlarges them again
          const size = (width / perRow) * lerp(plan.big, plan.small, depth);
          return (
            <div
              key={g.seed.id}
              style={{
                position: "absolute",
                left: `${left}%`,
                bottom: `${lerp(plan.near, plan.far, depth)}%`,
                transform: `translate(-50%, ${lerp(14, 0, up)}px) scale(${lerp(0.88, 1, up)})`,
                transformOrigin: "bottom center",
                opacity: up,
                zIndex: 10 - row,
              }}
            >
              <Plot info={g.info} index={g.i} moments={moments} onWater={noop} size={size} />
            </div>
          );
        })}
      </div>
    );
    return { bed, thriving: grown.filter((g) => tq > g.born && g.stage >= 4).length, allDone: tq > B.done };
  }, [tq, perRow, width, portrait, cast]);


  const unit = stage.portrait ? stage.w / 1080 : stage.w / 1920;
  const u = stage.portrait ? unit * 1.5 : unit;
  const endIn = easeOut(seg(t, B.end, 1800));

  return (
    <div style={{ width: "100vw", height: "100dvh", overflow: "hidden", position: "relative", background: "#08120f" }}>
      {/* the dev overlay would otherwise sit in the corner of every recording */}
      <style>{"nextjs-portal{display:none!important}"}</style>

      {/* the real scene, at the size of the screen, drifting slowly closer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoom * lerp(1.02, 1.07, seg(t, 0, DURATION))})`,
          transformOrigin: portrait ? "50% 15%" : "50% 76%",
          // its own layer: the drift is then the compositor's job, not a repaint
          willChange: "transform",
        }}
      >
        <MemoScene variant="immersive" weather="clear" thriving={garden.thriving} allDone={garden.allDone} celebrate={garden.allDone ? 1 : 0} decorLevel={1} live>
          {garden.bed}
        </MemoScene>
      </div>

      <Caption t={t} u={u} portrait={stage.portrait} />

      {/* --------------------------------------------------------- end card */}
      {endIn > 0 && (
        <>
          <div style={{ position: "absolute", inset: 0, background: "rgba(8,18,15,0.7)", opacity: endIn }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              color: "#fff",
              opacity: endIn,
              transform: `translateY(${lerp(30, 0, endIn) * u}px)`,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 * u }}>
                <span style={{ fontSize: 76 * u, color: "#8be0c9", lineHeight: 1, display: "inline-block", transform: `rotate(${lerp(-30, 0, endIn)}deg)` }}>✱</span>
                <span className="font-display" style={{ fontSize: 96 * u, letterSpacing: "-0.03em" }}>
                  kairo
                </span>
              </div>
              <div className="font-display" style={{ fontSize: 52 * u, marginTop: 18 * u, opacity: easeOut(seg(t, B.end + 1100, 1300)) }}>
                Habits that grow a garden.
              </div>
              <div style={{ marginTop: 24 * u, fontSize: 28 * u, color: "rgba(255,255,255,0.74)", opacity: easeOut(seg(t, B.end + 2000, 1300)) }}>
                kairo.jaimansoni.com
              </div>
            </div>
          </div>
        </>
      )}

      {/* a breath of black at each end, so a loop reads as a repeat */}
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: Math.max(1 - seg(t, 0, 1100), seg(t, DURATION - 1400, 1400)), pointerEvents: "none" }} />
    </div>
  );
}

/** One line at a time, low in the frame and out of the garden's way. */
function Caption({ t, u, portrait }: { t: number; u: number; portrait: boolean }) {
  const lines = [
    { text: "One small thing, most days.", at: 1500, dur: 3200 },
    { text: "Every habit grows its own plant.", at: B.more + 1800, dur: 4200 },
    { text: "It rains here when it rains where you are.", at: B.rain + 900, dur: 3000 },
    { text: "Finish the day, and the rainbow comes out.", at: B.done + 500, dur: 1700 },
  ];
  return (
    <>
      {lines.map((l) => {
        const o = beat(t, l.at, l.dur, 1000);
        if (o <= 0.01) return null;
        const rise = easeOut(seg(t, l.at - 1000, 1600));
        return (
          <div
            key={l.text}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              // a tall frame reads top-down, and the sky is the one place nothing collides
              ...(portrait ? { top: "7%" } : { bottom: 0 }),
              textAlign: "center",
              opacity: o,
              padding: portrait ? `${40 * u}px ${56 * u}px` : `${90 * u}px ${40 * u}px 70px`,
              background: portrait ? "none" : "linear-gradient(to top, rgba(6,14,12,0.6), rgba(6,14,12,0))",
              pointerEvents: "none",
            }}
          >
            <span
              className="font-display"
              style={{
                color: "#fff",
                fontSize: (portrait ? 40 : 50) * u,
                letterSpacing: "-0.02em",
                // three shadows, not one: a tight dark edge so white letters
                // still read against a pale dawn sky, and two soft pools so
                // that edge never looks like an outline
                textShadow: `0 ${1 * u}px ${3 * u}px rgba(0,0,0,0.55), 0 ${2 * u}px ${14 * u}px rgba(0,0,0,0.5), 0 ${6 * u}px ${40 * u}px rgba(0,0,0,0.4)`,
                transform: `translateY(${lerp(16, 0, rise) * u}px)`,
                display: "inline-block",
              }}
            >
              {l.text}
            </span>
          </div>
        );
      })}
    </>
  );
}
