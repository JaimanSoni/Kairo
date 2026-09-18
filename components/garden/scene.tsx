"use client";

import { Burst, Moment, useClock } from "./fx";
import { LevelDecor } from "./city/decor";
import { sunMinutes, useLiveSky } from "./live-sky";
import type { LiveSky } from "@/lib/weather-shared";

/**
 * The garden's world: a sky that follows the clock, a sun or moon on its arc,
 * the weather, mountains and hills, and the ground everything grows in. The
 * plots are passed in as children.
 *
 * The weather is the real weather where you are, when the garden is yours and
 * we know it (`live`): rain when it's raining, fog, snow, a storm with its
 * lightning, and the sun rising and setting when yours does. Otherwise, and
 * whenever the real weather is switched off, the garden has weather of its
 * own that clears as the day's habits get done.
 *
 * When every habit due today is done, the garden says so without words: a
 * rainbow comes out (through the rain, if it's raining) and petals drift
 * down.
 *
 * It comes in four sizes: a small card on Today ("mini"), the strip over one
 * habit ("compact"), the head of the Habits page ("hero") and the whole screen
 * ("immersive"), where the sky and hills also shift with the pointer, for depth.
 */

export type Weather = "clear" | "partly" | "cloudy";
export type SceneVariant = "mini" | "compact" | "hero" | "immersive";

type Phase = "night" | "dawn" | "day" | "golden" | "dusk";

/** Where in the day it is: by the real sunrise and sunset when we know them, otherwise by a sun that rises at 6 and sets at 7. */
export function phaseOf(min: number, sun?: { rise: number; set: number } | null): Phase {
  if (sun) {
    if (min < sun.rise - 60 || min >= sun.set + 100) return "night";
    if (min < sun.rise + 60) return "dawn";
    if (min < sun.set - 120) return "day";
    if (min < sun.set) return "golden";
    return "dusk";
  }
  const h = min / 60;
  if (h < 5 || h >= 21) return "night";
  if (h < 7) return "dawn";
  if (h < 17) return "day";
  if (h < 19) return "golden";
  return "dusk";
}

const SKY: Record<Phase, string> = {
  night: "linear-gradient(180deg, #081229 0%, #16284b 55%, #2a4570 100%)",
  dawn: "linear-gradient(180deg, #7489d8 0%, #e9aab0 58%, #ffd6a0 100%)",
  day: "linear-gradient(180deg, #3fa6ec 0%, #8fd3f7 58%, #d4f1fb 100%)",
  golden: "linear-gradient(180deg, #e9785a 0%, #f6aa63 52%, #ffe19e 100%)",
  dusk: "linear-gradient(180deg, #25286a 0%, #6e5199 52%, #ee8f70 100%)",
};

/** Far mountains, mid hills, near hills. */
const LAND: Record<Phase, { far: string; farSnow: string; trees: string; hills: [string, string, string] }> = {
  night: { far: "#243a5c", farSnow: "#3b5478", trees: "#16362f", hills: ["#1d3a3c", "#244a45", "#2d5a4c"] },
  dawn: { far: "#9d8fc4", farSnow: "#f4d9e2", trees: "#5f9a68", hills: ["#8cbf8a", "#74b073", "#5e9f63"] },
  day: { far: "#8fb3d6", farSnow: "#f4fbff", trees: "#4f9a5e", hills: ["#9fd48c", "#7fc475", "#62b163"] },
  golden: { far: "#c48f7c", farSnow: "#ffe9cf", trees: "#6f8f4e", hills: ["#b8c77a", "#94b765", "#74a557"] },
  dusk: { far: "#5b4f86", farSnow: "#b7a3cf", trees: "#35544a", hills: ["#4f6e6a", "#46655a", "#3d5c4f"] },
};

const GROUND: Record<Phase, string> = {
  night: "linear-gradient(180deg, #2f5a48 0%, #22443a 100%)",
  dawn: "linear-gradient(180deg, #6fae67 0%, #57955a 100%)",
  day: "linear-gradient(180deg, #74bd66 0%, #56a452 100%)",
  golden: "linear-gradient(180deg, #86b25e 0%, #67984d 100%)",
  dusk: "linear-gradient(180deg, #46705a 0%, #365a48 100%)",
};

const HILLS = [
  "M0 64 C 60 40, 120 44, 180 60 C 240 76, 300 40, 400 54 L400 110 L0 110 Z",
  "M0 80 C 80 60, 150 66, 220 78 C 290 90, 340 64, 400 72 L400 110 L0 110 Z",
  "M0 96 C 100 84, 200 90, 280 94 C 340 97, 370 88, 400 92 L400 110 L0 110 Z",
];

const STARS = Array.from({ length: 40 }, (_, i) => ({ x: (i * 53) % 100, y: (i * 29) % 70, r: i % 6 === 0 ? 1.7 : 1, d: (i % 7) * 0.4 }));
/** Grass tufts and wildflowers, placed once, the same on every visit. */
const TUFTS = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37 + 11) % 97, y: 8 + ((i * 53) % 86), s: 0.7 + ((i * 7) % 5) / 10, d: (i % 5) * 0.6 }));
const FLOWERS = Array.from({ length: 18 }, (_, i) => ({ x: (i * 61 + 5) % 96, y: 12 + ((i * 41) % 80), c: ["#ffffff", "#ffd54f", "#f48fb1", "#b39ddb", "#ffab91"][i % 5] }));
/** Raindrops and snowflakes: spread by the golden ratio, so any number of them looks scattered rather than lined up. */
const DROPS = Array.from({ length: 220 }, (_, i) => ({ x: (i * 61.803) % 100, lag: (i * 0.381966) % 1, pace: 0.85 + ((i * 7) % 6) * 0.05, far: i % 3 === 1, rest: (i * 47) % 100, size: 2.8 + ((i * 5) % 4) * 1.2 }));
/** Where the rain lands and rings out, across the ground. */
const PLIPS = Array.from({ length: 14 }, (_, i) => ({ x: 4 + ((i * 53) % 92), y: 10 + ((i * 37) % 82), lag: (i * 0.43) % 1.2 }));
const PUDDLES = [
  { left: "5%", top: "70%", width: "20%", height: "9%" },
  { left: "72%", top: "80%", width: "22%", height: "10%" },
  { left: "34%", top: "90%", width: "16%", height: "7%" },
];

/** A layer that drifts with the pointer by up to dx, dy pixels; nothing moves outside the immersive garden. */
const drift = (dx: number, dy: number) => ({ "--dx": `${dx}px`, "--dy": `${dy}px` }) as React.CSSProperties;

/** Everything the weather changes about the picture. */
type Look = {
  /** Clouds drifting across. */
  clouds: number;
  /** A ceiling of cloud across the top of the sky: overcast. */
  deck: boolean;
  tone: "white" | "grey" | "rain" | "storm" | "mist";
  /** How much the sky dims, 0 to 1, and the colour it dims towards. */
  gloom: number;
  gloomTone: "haze" | "grey" | "pale";
  /** How much of the sun or moon shows through. */
  orb: number;
  /** How much of the night sky shows. */
  stars: number;
  /** 0 for none, else 1 light, 2 steady, 3 heavy. */
  rain: number;
  snow: number;
  thunder: boolean;
  fog: boolean;
  windy: boolean;
  /** Snow lying on the hills and ground, 0 to 1. */
  frost: number;
};

function lookOf(sky: LiveSky | null, own: Weather, variant: SceneVariant): Look {
  const mini = variant === "mini";
  const immersive = variant === "immersive";
  const by = (m: number, h: number, i: number) => (mini ? m : immersive ? i : h);
  const calm: Look = { clouds: 0, deck: false, tone: "white", gloom: 0, gloomTone: "grey", orb: 1, stars: 1, rain: 0, snow: 0, thunder: false, fog: false, windy: false, frost: 0 };
  if (!sky) {
    // the garden's own weather, which clears as the day's habits get done
    const grey = own === "cloudy";
    return { ...calm, clouds: mini ? (own === "clear" ? 1 : 3) : own === "clear" ? 2 : own === "partly" ? 4 : immersive ? 7 : 6, tone: grey ? "grey" : "white", gloom: grey ? 0.25 : 0, gloomTone: "haze", orb: grey ? 0.5 : 1 };
  }
  const base: Look = { ...calm, windy: (sky.windMs ?? 0) >= 8 };
  const i = sky.intensity;
  switch (sky.kind) {
    case "clear":
      return { ...base, clouds: by(0, 1, 1) };
    case "fair":
      return { ...base, clouds: by(1, 2, 3), stars: 0.9 };
    case "partly":
      return { ...base, clouds: by(2, 4, 5), orb: 0.9, stars: 0.5 };
    case "cloudy":
      return { ...base, clouds: by(3, 6, 8), deck: true, tone: "grey", gloom: 0.45, orb: 0, stars: 0 };
    case "fog":
      return { ...base, clouds: by(1, 2, 3), tone: "mist", gloom: 0.5, gloomTone: "pale", orb: 0.5, stars: 0, fog: true };
    case "rain":
    case "sleet": {
      const sleet = sky.kind === "sleet" ? 1 : 0;
      // showers come and go: broken cloud, and the sun between them
      if (sky.showers && !sky.thunder) return { ...base, clouds: by(3, 5, 7), tone: "grey", gloom: 0.14 + i * 0.07, orb: 0.45, stars: 0, rain: i, snow: sleet };
      return { ...base, clouds: by(4, 7, 9), deck: true, tone: sky.thunder || i === 3 ? "storm" : "rain", gloom: 0.4 + i * 0.1 + (sky.thunder ? 0.1 : 0), orb: 0, stars: 0, rain: i, snow: sleet, thunder: sky.thunder };
    }
    case "snow":
      return { ...base, clouds: by(3, 6, 8), deck: true, tone: "grey", gloom: 0.32 + i * 0.08, gloomTone: "pale", orb: 0, stars: 0, snow: i, thunder: sky.thunder, frost: [0.62, 0.8, 0.9][i - 1] };
  }
}

const CLOUD_FILL: Record<Look["tone"], string> = { white: "#ffffff", grey: "#c9d3da", rain: "#a4afba", storm: "#78848f", mist: "#e6ebee" };

function cloudFill(tone: Look["tone"], night: boolean, dark: boolean): string {
  // rain clouds darken as soon as the light goes; the others wait for the night
  if (tone === "rain" || tone === "storm") return dark ? "#1f2a3b" : CLOUD_FILL[tone];
  return night ? "#3b4f73" : CLOUD_FILL[tone];
}

function gloomOf(look: Look, dark: boolean): string {
  const g = look.gloom;
  if (look.gloomTone === "haze") return `rgba(138, 160, 176, ${g})`;
  // fog and snow: a white-grey sky with only a hint of the hour's colour left in it
  if (look.gloomTone === "pale") return dark ? `rgba(40, 50, 64, ${Math.min(0.85, g + 0.2)})` : `rgba(212, 218, 223, ${Math.min(0.9, g + 0.3)})`;
  return dark ? `rgba(4, 8, 18, ${g})` : `linear-gradient(180deg, rgba(58, 70, 84, ${g}) 0%, rgba(96, 110, 124, ${g * 0.85}) 100%)`;
}

const RAIN_COUNT: Record<SceneVariant, [number, number, number]> = { mini: [14, 26, 40], compact: [28, 50, 80], hero: [40, 80, 150], immersive: [70, 140, 220] };
/** Seconds for a drop to cross the scene at a steady rain: a bigger scene is a longer fall. */
const RAIN_FALL: Record<SceneVariant, number> = { mini: 0.42, compact: 0.55, hero: 0.7, immersive: 0.95 };
const SNOW_COUNT: Record<SceneVariant, [number, number, number]> = { mini: [12, 20, 30], compact: [24, 40, 60], hero: [34, 56, 84], immersive: [56, 100, 150] };
const SNOW_FALL: Record<SceneVariant, number> = { mini: 5, compact: 7, hero: 9, immersive: 13 };

function Rain({ level, variant, windy }: { level: number; variant: SceneVariant; windy: boolean }) {
  const count = RAIN_COUNT[variant][level - 1];
  const fall = RAIN_FALL[variant] * [1.3, 1, 0.82][level - 1];
  return (
    <div className="gd-rain" style={{ "--slant": `${windy ? 18 : level === 1 ? 5 : 9}deg` } as React.CSSProperties}>
      {DROPS.slice(0, count).map((d, i) => (
        <i
          key={i}
          className={d.far ? "gd-far" : undefined}
          style={{ left: `${d.x}%`, animationDuration: `${(fall * d.pace).toFixed(2)}s`, animationDelay: `${(-d.lag * fall * 2).toFixed(2)}s`, "--rest": `${d.rest}%`, "--len": `${level === 3 ? 24 : 18}px` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function Snow({ level, variant, windy, count: asked }: { level: number; variant: SceneVariant; windy: boolean; count?: number }) {
  const count = asked ?? SNOW_COUNT[variant][level - 1];
  const fall = SNOW_FALL[variant] * [1.2, 1, 0.85][level - 1];
  return (
    <div className="gd-snow" style={{ "--slant": `${windy ? 14 : 4}deg` } as React.CSSProperties}>
      {DROPS.slice(0, count).map((d, i) => (
        <i
          key={i}
          style={{ left: `${d.x}%`, animationDuration: `${(fall * (2 - d.pace)).toFixed(2)}s`, animationDelay: `${(-d.lag * fall * 2).toFixed(2)}s`, "--rest": `${d.rest}%`, "--s": `${(variant === "mini" ? 0.7 : 1) * d.size}px` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/** A fork of lightning out of the cloud; it and the flash behind it share one clock. */
function Bolt({ left, delay, width }: { left: string; delay: string; width: number }) {
  return (
    <svg className="gd-bolt absolute top-[18%]" style={{ left, animationDelay: delay }} width={width} height={width * 2.4} viewBox="0 0 20 48" aria-hidden>
      <path d="M12 0 L4 22 L10 22 L3 48 L17 17 L10.5 17 L16 0 Z" fill="#f7f9ff" />
    </svg>
  );
}

export function GardenScene({
  weather,
  thriving = 0,
  children,
  compact = false,
  variant: asked,
  allDone = false,
  celebrate = 0,
  decorLevel = 1,
  hud,
  live = false,
}: {
  /** The garden's own weather, for when the real weather isn't shown. */
  weather: Weather;
  /** How many plants are thriving: the more, the more life flies about. */
  thriving?: number;
  children: React.ReactNode;
  /** The same as variant "compact". */
  compact?: boolean;
  variant?: SceneVariant;
  /** Everything due today is done: the rainbow comes out. */
  allDone?: boolean;
  /** Counts up the moment the last habit of the day is done, for a burst of colour. */
  celebrate?: number;
  /** The garden's level in Kairo City: what it has built shows on the ground. */
  decorLevel?: number;
  /** A small overlay on the sky: today's progress. */
  hud?: React.ReactNode;
  /** Your own garden: it has the sky you have, where you are. */
  live?: boolean;
}) {
  const variant: SceneVariant = asked ?? (compact ? "compact" : "hero");
  const mini = variant === "mini";
  const immersive = variant === "immersive";
  const small = mini || variant === "compact";
  const min = useClock();
  const sky = useLiveSky(live);
  const sun = sunMinutes(sky);
  const phase = phaseOf(min, sun);
  const night = phase === "night";
  const dark = night || phase === "dusk";
  // the sun crosses from sunrise to sunset; the moon crosses the rest of the night
  const rise = sun?.rise ?? 6 * 60;
  const set = sun?.set ?? 19 * 60;
  const dayT = Math.min(1, Math.max(0, (min - rise) / (set - rise)));
  const nightT = ((min - set + 1440) % 1440) / (1440 - (set - rise));
  const t = dark ? Math.min(1, nightT) : dayT;
  const orbX = 10 + t * 80;
  const orbY = 58 - Math.sin(t * Math.PI) * 40;
  const shown = allDone ? "clear" : weather;
  const look = lookOf(sky, shown, variant);
  const falling = look.rain > 0 || look.snow > 0;
  const calm = look.tone === "white" && !look.fog;
  const clouds = look.clouds;
  const fill = cloudFill(look.tone, night, dark);
  const land = LAND[phase];
  const birds = !dark && calm && !small;
  const bugs = falling || look.fog ? 0 : mini ? Math.min(2, thriving) : Math.min(immersive ? 8 : 5, Math.floor(thriving / 1.2) + (allDone ? 2 : 0) + (immersive ? 2 : 0));
  const stars = Math.round(STARS.length * look.stars);
  // wet or misty land loses its colour; snow brightens it
  const landFilter = look.fog
    ? "saturate(0.7) contrast(0.82) brightness(1.04)"
    : sky && look.gloom > 0 && !look.frost
      ? `saturate(${(1 - look.gloom * 0.45).toFixed(2)}) brightness(${(1 - look.gloom * 0.4).toFixed(2)})`
      : undefined;

  const skyHeight = { mini: "h-[4.5rem]", compact: "h-32", hero: "h-48 sm:h-60", immersive: "h-[36%] min-h-44 shrink-0" }[variant];
  const landHeight = { mini: "h-10", compact: "h-28 sm:h-32", hero: "h-28 sm:h-32", immersive: "h-36 sm:h-52" }[variant];

  return (
    <div
      className={`gd-scene relative isolate overflow-hidden ${
        immersive ? "flex h-full flex-col" : `${mini ? "rounded-2xl" : "rounded-[1.75rem]"} border border-line/60 shadow-xl shadow-ink/10`
      }`}
      data-phase={phase}
      data-weather={shown}
      data-sky={sky ? sky.kind : undefined}
      data-rain={look.rain || undefined}
      data-snow={look.snow || undefined}
      data-thunder={look.thunder || undefined}
      data-windy={look.windy || undefined}
      data-variant={variant}
      data-all-done={allDone || undefined}
    >
      {/* sky */}
      <div className={`relative ${skyHeight}`} style={{ background: SKY[phase] }}>
        <div className="gd-par pointer-events-none absolute inset-0" style={drift(-16, -8)} aria-hidden>
          {dark &&
            STARS.slice(0, stars).map((s, i) => (
              <span
                key={i}
                className="gd-star absolute rounded-full bg-white"
                style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.r * 2, height: s.r * 2, animationDelay: `${s.d}s`, opacity: phase === "dusk" ? 0.5 : 0.9 }}
              />
            ))}
          {night && !small && look.stars === 1 && <span className="gd-shooting absolute left-[62%] top-[14%] block h-px w-24 rounded-full bg-gradient-to-l from-white to-transparent" />}

          {/* the sun, or the moon */}
          {look.orb > 0 && (
            <div className="absolute transition-[left,top] duration-1000" style={{ left: `${orbX}%`, top: `${orbY}%`, transform: "translate(-50%, -50%)" }}>
              <div className={mini ? "scale-50" : immersive ? "sm:scale-125" : ""}>
                {dark ? (
                  <div className="relative size-11 rounded-full bg-[#f4f1de] shadow-[0_0_40px_12px_rgba(244,241,222,0.3)] transition-opacity duration-700" style={{ opacity: look.orb }}>
                    <span className="absolute left-2 top-3 size-2 rounded-full bg-[#dcd7bf]" />
                    <span className="absolute bottom-2.5 right-3 size-1.5 rounded-full bg-[#dcd7bf]" />
                    <span className="absolute right-2 top-2 size-1 rounded-full bg-[#dcd7bf]" />
                  </div>
                ) : (
                  <div className="relative grid place-items-center transition-opacity duration-700" style={{ opacity: look.orb }}>
                    <span className="gd-rays absolute size-40 rounded-full" />
                    <span className="relative size-14 rounded-full bg-[radial-gradient(circle_at_40%_38%,#fff6c4,#ffd35c_55%,#ffb938)] shadow-[0_0_50px_18px_rgba(255,211,92,0.55)]" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* the weather dims the light */}
        {look.gloom > 0 && <div className="pointer-events-none absolute inset-0 transition-[background] duration-700" style={{ background: gloomOf(look, dark) }} aria-hidden />}

        {/* the rainbow, once the day's habits are all done */}
        {!dark && (
          <svg
            className={`gd-rainbow gd-par pointer-events-none absolute inset-x-0 bottom-6 h-[85%] w-full transition-opacity duration-[1600ms] ${allDone ? "opacity-80" : "opacity-0"}`}
            style={drift(-10, -5)}
            viewBox="0 0 400 160"
            preserveAspectRatio="xMidYMax meet"
            aria-hidden
          >
            {["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#9775fa"].map((c, i) => (
              <path key={c} d={`M ${60 + i * 7} 160 A ${140 - i * 7} ${140 - i * 7} 0 0 1 ${340 - i * 7} 160`} fill="none" stroke={c} strokeWidth="6.5" opacity={0.85} />
            ))}
          </svg>
        )}

        {/* overcast: a ceiling of cloud, and lightning out of it */}
        {look.deck && (
          <svg className="gd-par pointer-events-none absolute inset-x-0 -top-1 h-[46%] w-full" style={drift(-20, -6)} viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden>
            <path
              d="M0 0 H400 V30 C 386 44, 362 42, 352 33 C 340 48, 312 48, 300 35 C 288 50, 256 48, 246 35 C 232 48, 204 46, 196 33 C 184 48, 152 48, 142 35 C 128 50, 100 46, 92 33 C 80 46, 52 46, 44 33 C 32 44, 12 42, 0 30 Z"
              fill={fill}
              opacity={dark ? 0.9 : 0.96}
            />
          </svg>
        )}
        {look.thunder && !mini && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <Bolt left="24%" delay="0s" width={immersive ? 26 : 18} />
            <Bolt left="68%" delay="-6.2s" width={immersive ? 20 : 14} />
          </div>
        )}

        <div className="gd-par pointer-events-none absolute inset-0" style={drift(-26, -6)} aria-hidden>
          {Array.from({ length: clouds }, (_, i) => (
            <div key={i} className="gd-cloud absolute" style={{ top: `${6 + ((i * 23) % 44)}%`, animationDuration: `${(80 + i * 22) * (look.windy ? 0.4 : 1)}s`, animationDelay: `${-i * 19}s` }}>
              <svg width={(mini ? 56 : immersive ? 130 : 100) + (i % 3) * (mini ? 16 : 36)} viewBox="0 0 120 44">
                <path
                  d="M20 40 C 4 40, 2 22, 18 20 C 18 6, 40 2, 48 14 C 56 2, 82 4, 84 20 C 102 16, 118 30, 104 40 Z"
                  fill={fill}
                  opacity={look.tone === "rain" || look.tone === "storm" ? (dark ? 0.85 : 0.95) : night ? 0.5 : look.tone === "white" ? 0.92 : 0.95}
                />
              </svg>
            </div>
          ))}
        </div>

        {birds &&
          [0, 1, 2].map((i) => (
            <svg
              key={i}
              className="gd-bird absolute"
              style={{ top: `${14 + i * 9}%`, animationDelay: `${-i * 7}s`, animationDuration: `${26 + i * 5}s` }}
              width={(immersive ? 20 : 14) - i * 2}
              height={immersive ? 11 : 8}
              viewBox="0 0 14 8"
              aria-hidden
            >
              <path className="gd-flap" d="M1 2 Q4 6 7 4 Q10 6 13 2" fill="none" stroke={phase === "golden" ? "#5b3a2e" : "#2f4858"} strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          ))}

        {/* the land: far mountains, a treeline, and the hills the garden sits in */}
        <svg className={`gd-par absolute -left-[3%] bottom-0 w-[106%] ${landHeight}`} style={{ ...drift(-10, -3), filter: landFilter }} viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden>
          <path d="M0 58 L38 30 L62 44 L96 16 L130 46 L160 34 L196 54 L232 22 L270 50 L300 36 L338 56 L372 28 L400 44 L400 110 L0 110 Z" fill={land.far} opacity="0.75" />
          <path d="M88 22 L96 16 L104 23 L99 22 L96 25 Z M226 28 L232 22 L239 29 L233 27 L230 30 Z M366 33 L372 28 L378 34 L373 32 Z" fill={land.farSnow} opacity="0.9" />
          {Array.from({ length: 34 }, (_, i) => (
            <ellipse key={i} cx={i * 12 + 4} cy={62 + ((i * 7) % 5)} rx={6 + (i % 3)} ry={8 + (i % 4)} fill={land.trees} opacity="0.85" />
          ))}
          {HILLS.map((d, i) => (
            <path key={i} d={d} fill={land.hills[i]} />
          ))}
          {/* snow lying on the hills */}
          {look.frost > 0 && (
            <g fill={night ? "#b9c6d6" : "#f4f8fb"} opacity={look.frost}>
              {HILLS.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
          )}
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={i} x={i * 19 + 4} y={84} width={2.2} height={12} fill={night ? "#50473b" : "#b98d5e"} opacity={0.75} />
          ))}
          <rect x={0} y={87} width={400} height={1.6} fill={night ? "#50473b" : "#b98d5e"} opacity={0.7} />
        </svg>

        {hud && <div className={`absolute z-10 ${mini ? "left-2.5 top-2.5" : "left-3 top-3 sm:left-4 sm:top-4"}`}>{hud}</div>}
      </div>

      {/* ground */}
      <div className={`relative ${immersive ? "flex min-h-0 flex-1 flex-col" : ""}`} style={{ background: GROUND[phase] }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 70% 60%, #fff 0 1px, transparent 1.5px)", backgroundSize: "34px 30px, 46px 38px" }}
          aria-hidden
        />
        {/* an overcast day dims the ground; rain darkens it and gathers in puddles; snow lies on it */}
        {sky && look.gloom > 0 && !look.rain && !look.frost && !look.fog && <div className="pointer-events-none absolute inset-0" style={{ background: `rgba(16, 32, 48, ${(look.gloom * 0.25).toFixed(2)})` }} aria-hidden />}
        {look.rain > 0 && <div className="pointer-events-none absolute inset-0" style={{ background: `rgba(16, 32, 48, ${0.14 + look.rain * 0.08})` }} aria-hidden />}
        {look.frost > 0 && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `linear-gradient(180deg, rgba(246, 249, 252, ${look.frost}) 0%, rgba(236, 242, 247, ${look.frost * 0.85}) 100%)` }}
            aria-hidden
          />
        )}
        {look.rain >= 2 && !small && PUDDLES.map((p, i) => <span key={i} className="gd-puddle pointer-events-none" style={p} aria-hidden />)}
        {!small && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden>
            {/* a winding path of stepping stones, from the gate to the front */}
            <path d="M200 0 C 170 60, 250 110, 205 170 C 170 220, 230 260, 210 300" fill="none" stroke={night ? "#3d6a55" : "#cdb88e"} strokeWidth="26" strokeLinecap="round" opacity={night ? 0.35 : 0.28} />
          </svg>
        )}
        {!small &&
          TUFTS.map((g, i) => (
            <svg key={i} className="gd-tuft pointer-events-none absolute" style={{ left: `${g.x}%`, top: `${g.y}%`, animationDelay: `${g.d}s` }} width={14 * g.s * (immersive ? 1.4 : 1)} height={10 * g.s * (immersive ? 1.4 : 1)} viewBox="0 0 14 10" aria-hidden>
              <path d="M2 10 Q3 4 1 1 M6 10 Q6 3 7 0 M10 10 Q10 4 13 2" fill="none" stroke={night ? "#4f8a6a" : "#3f8f4a"} strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          ))}
        {!small &&
          !night &&
          look.frost < 0.5 &&
          FLOWERS.map((f, i) => (
            <span
              key={i}
              className={`pointer-events-none absolute block rounded-full ${immersive ? "size-2" : "size-1.5"}`}
              style={{ left: `${f.x}%`, top: `${f.y}%`, background: f.c, boxShadow: "0 0 0 1.5px rgba(255,255,255,0.25)" }}
              aria-hidden
            />
          ))}
        {look.rain > 0 &&
          !mini &&
          PLIPS.slice(0, [4, 8, 14][look.rain - 1]).map((p, i) => (
            <span key={i} className="gd-plip pointer-events-none" style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.lag.toFixed(2)}s` }} aria-hidden />
          ))}

        {decorLevel > 1 && !small && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" data-decor-level={decorLevel} aria-hidden>
            <LevelDecor level={decorLevel} phase={phase} edges={!immersive} />
          </div>
        )}

        {immersive ? <div className="no-scrollbar relative flex min-h-0 flex-1 flex-col justify-center overflow-y-auto">{children}</div> : children}

        {night &&
          !falling &&
          Array.from({ length: mini ? 4 : immersive ? 16 : 10 }, (_, i) => (
            <span
              key={i}
              className="gd-firefly pointer-events-none absolute size-1.5 rounded-full bg-[#fff59d]"
              style={{ left: `${(i * 37) % 95}%`, top: `${8 + ((i * 17) % 78)}%`, animationDelay: `${-i * 1.3}s` }}
              aria-hidden
            />
          ))}
        {!dark &&
          Array.from({ length: bugs }, (_, i) => (
            <div
              key={i}
              className="gd-butterfly pointer-events-none absolute"
              style={{ left: `${10 + ((i * 31) % 72)}%`, top: `${6 + ((i * 19) % 44)}%`, animationDelay: `${-i * 2.7}s` }}
              aria-hidden
            >
              <svg width={mini ? 12 : immersive ? 24 : 18} height={mini ? 10 : immersive ? 20 : 15} viewBox="0 0 16 14">
                <g className="gd-wings">
                  <ellipse cx="4.5" cy="5" rx="4" ry="4.5" fill={["#ffb74d", "#f06292", "#9575cd", "#4fc3f7", "#aed581"][i % 5]} />
                  <ellipse cx="11.5" cy="5" rx="4" ry="4.5" fill={["#ffcc80", "#f48fb1", "#b39ddb", "#81d4fa", "#c5e1a5"][i % 5]} />
                </g>
                <rect x="7.3" y="3" width="1.4" height="9" rx="0.7" fill="#4e342e" />
              </svg>
            </div>
          ))}
        {!mini && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 z-20" aria-hidden>
            <Moment id={celebrate} ms={2200}>
              <Burst count={immersive ? 64 : 44} />
            </Moment>
          </div>
        )}
        {allDone && !small && !falling && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {Array.from({ length: immersive ? 24 : 14 }, (_, i) => (
              <span
                key={i}
                className="gd-petal absolute block size-2 rounded-[60%_0_60%_0]"
                style={
                  {
                    left: `${(i * 29 + 7) % 96}%`,
                    background: ["#f8bbd0", "#fff59d", "#ffffff", "#e1bee7"][i % 4],
                    animationDelay: `${-i * 0.9}s`,
                    animationDuration: `${(immersive ? 10 : 7) + (i % 4)}s`,
                    "--fall": immersive ? "900px" : undefined,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* fog banks, then whatever is falling, over everything but the words on the sky */}
      {look.fog && (
        <div className="gd-fog pointer-events-none absolute inset-0 z-[4] overflow-hidden" aria-hidden>
          <span style={{ top: "18%", height: "26%" }} />
          <span style={{ top: "40%", height: "30%", animationDelay: "-12s", opacity: 0.85 }} />
          <span style={{ top: "66%", height: "30%", animationDelay: "-24s", opacity: 0.55 }} />
        </div>
      )}
      {falling && (
        <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
          {look.rain > 0 && <Rain level={look.rain} variant={variant} windy={look.windy} />}
          {look.snow > 0 && <Snow level={look.snow} variant={variant} windy={look.windy} count={look.rain ? Math.round(SNOW_COUNT[variant][0] * 0.6) : undefined} />}
        </div>
      )}
      {look.thunder && (
        <div className="pointer-events-none absolute inset-0 z-[6]" aria-hidden>
          <div className="gd-flash" />
          <div className="gd-flash" style={{ animationDelay: "-6.2s", animationDuration: "11s" }} />
        </div>
      )}
    </div>
  );
}
