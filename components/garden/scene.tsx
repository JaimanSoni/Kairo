"use client";

import { Burst, Moment, useClock } from "./fx";

/**
 * The garden's world: a sky that follows the clock, a sun or moon on its arc,
 * weather that clears as the day's habits get done, mountains and hills, and
 * the ground everything grows in. The plots are passed in as children.
 *
 * When every habit due today is done, the garden says so without words: the
 * clouds go, a rainbow comes out and petals drift down.
 *
 * It comes in four sizes: a small card on Today ("mini"), the strip over one
 * habit ("compact"), the head of the Habits page ("hero") and the whole screen
 * ("immersive"), where the sky and hills also shift with the pointer, for depth.
 */

export type Weather = "clear" | "partly" | "cloudy";
export type SceneVariant = "mini" | "compact" | "hero" | "immersive";

type Phase = "night" | "dawn" | "day" | "golden" | "dusk";

export function phaseOf(min: number): Phase {
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

const STARS = Array.from({ length: 40 }, (_, i) => ({ x: (i * 53) % 100, y: (i * 29) % 70, r: i % 6 === 0 ? 1.7 : 1, d: (i % 7) * 0.4 }));
/** Grass tufts and wildflowers, placed once, the same on every visit. */
const TUFTS = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37 + 11) % 97, y: 8 + ((i * 53) % 86), s: 0.7 + ((i * 7) % 5) / 10, d: (i % 5) * 0.6 }));
const FLOWERS = Array.from({ length: 18 }, (_, i) => ({ x: (i * 61 + 5) % 96, y: 12 + ((i * 41) % 80), c: ["#ffffff", "#ffd54f", "#f48fb1", "#b39ddb", "#ffab91"][i % 5] }));

/** A layer that drifts with the pointer by up to dx, dy pixels; nothing moves outside the immersive garden. */
const drift = (dx: number, dy: number) => ({ "--dx": `${dx}px`, "--dy": `${dy}px` }) as React.CSSProperties;

export function GardenScene({
  weather,
  thriving = 0,
  children,
  compact = false,
  variant: asked,
  allDone = false,
  celebrate = 0,
  hud,
}: {
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
  /** A small overlay on the sky: today's progress. */
  hud?: React.ReactNode;
}) {
  const variant: SceneVariant = asked ?? (compact ? "compact" : "hero");
  const mini = variant === "mini";
  const immersive = variant === "immersive";
  const small = mini || variant === "compact";
  const min = useClock();
  const phase = phaseOf(min);
  const night = phase === "night";
  const dark = night || phase === "dusk";
  // the sun rises at 6 and sets at 19; the moon crosses the rest of the night
  const dayT = Math.min(1, Math.max(0, (min / 60 - 6) / 13));
  const nightT = ((min / 60 + 24 - 19) % 24) / 11;
  const t = dark ? Math.min(1, nightT) : dayT;
  const orbX = 10 + t * 80;
  const orbY = 58 - Math.sin(t * Math.PI) * 40;
  const shown = allDone ? "clear" : weather;
  const clouds = mini ? (shown === "clear" ? 1 : 3) : shown === "clear" ? 2 : shown === "partly" ? 4 : immersive ? 7 : 6;
  const grey = shown === "cloudy";
  const land = LAND[phase];
  const birds = !dark && !grey && !small;
  const bugs = mini ? Math.min(2, thriving) : Math.min(immersive ? 8 : 5, Math.floor(thriving / 1.2) + (allDone ? 2 : 0) + (immersive ? 2 : 0));

  const skyHeight = { mini: "h-[4.5rem]", compact: "h-32", hero: "h-48 sm:h-60", immersive: "h-[36%] min-h-44 shrink-0" }[variant];
  const landHeight = { mini: "h-10", compact: "h-28 sm:h-32", hero: "h-28 sm:h-32", immersive: "h-36 sm:h-52" }[variant];

  return (
    <div
      className={`gd-scene relative isolate overflow-hidden ${
        immersive ? "flex h-full flex-col" : `${mini ? "rounded-2xl" : "rounded-[1.75rem]"} border border-line/60 shadow-xl shadow-ink/10`
      }`}
      data-phase={phase}
      data-weather={shown}
      data-variant={variant}
      data-all-done={allDone || undefined}
    >
      {/* sky */}
      <div className={`relative ${skyHeight}`} style={{ background: SKY[phase] }}>
        <div className="gd-par pointer-events-none absolute inset-0" style={drift(-16, -8)} aria-hidden>
          {dark &&
            STARS.map((s, i) => (
              <span
                key={i}
                className="gd-star absolute rounded-full bg-white"
                style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.r * 2, height: s.r * 2, animationDelay: `${s.d}s`, opacity: phase === "dusk" ? 0.5 : 0.9 }}
              />
            ))}
          {night && !small && <span className="gd-shooting absolute left-[62%] top-[14%] block h-px w-24 rounded-full bg-gradient-to-l from-white to-transparent" />}

          {/* the sun, or the moon */}
          <div className="absolute transition-[left,top] duration-1000" style={{ left: `${orbX}%`, top: `${orbY}%`, transform: "translate(-50%, -50%)" }}>
            <div className={mini ? "scale-50" : immersive ? "sm:scale-125" : ""}>
              {dark ? (
                <div className="relative size-11 rounded-full bg-[#f4f1de] shadow-[0_0_40px_12px_rgba(244,241,222,0.3)]">
                  <span className="absolute left-2 top-3 size-2 rounded-full bg-[#dcd7bf]" />
                  <span className="absolute bottom-2.5 right-3 size-1.5 rounded-full bg-[#dcd7bf]" />
                  <span className="absolute right-2 top-2 size-1 rounded-full bg-[#dcd7bf]" />
                </div>
              ) : (
                <div className={`relative grid place-items-center transition-opacity duration-700 ${grey ? "opacity-50" : ""}`}>
                  <span className="gd-rays absolute size-40 rounded-full" />
                  <span className="relative size-14 rounded-full bg-[radial-gradient(circle_at_40%_38%,#fff6c4,#ffd35c_55%,#ffb938)] shadow-[0_0_50px_18px_rgba(255,211,92,0.55)]" />
                </div>
              )}
            </div>
          </div>
        </div>

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

        <div className="gd-par pointer-events-none absolute inset-0" style={drift(-26, -6)} aria-hidden>
          {Array.from({ length: clouds }, (_, i) => (
            <div key={i} className="gd-cloud absolute" style={{ top: `${6 + ((i * 23) % 44)}%`, animationDuration: `${80 + i * 22}s`, animationDelay: `${-i * 19}s` }}>
              <svg width={(mini ? 56 : immersive ? 130 : 100) + (i % 3) * (mini ? 16 : 36)} viewBox="0 0 120 44">
                <path
                  d="M20 40 C 4 40, 2 22, 18 20 C 18 6, 40 2, 48 14 C 56 2, 82 4, 84 20 C 102 16, 118 30, 104 40 Z"
                  fill={night ? "#3b4f73" : grey ? "#c9d3da" : "#ffffff"}
                  opacity={night ? 0.5 : grey ? 0.95 : 0.92}
                />
              </svg>
            </div>
          ))}
        </div>
        {grey && <div className="pointer-events-none absolute inset-0 bg-[#8aa0b0]/25 transition-opacity duration-700" aria-hidden />}

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
        <svg className={`gd-par absolute -left-[3%] bottom-0 w-[106%] ${landHeight}`} style={drift(-10, -3)} viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden>
          <path d="M0 58 L38 30 L62 44 L96 16 L130 46 L160 34 L196 54 L232 22 L270 50 L300 36 L338 56 L372 28 L400 44 L400 110 L0 110 Z" fill={land.far} opacity="0.75" />
          <path d="M88 22 L96 16 L104 23 L99 22 L96 25 Z M226 28 L232 22 L239 29 L233 27 L230 30 Z M366 33 L372 28 L378 34 L373 32 Z" fill={land.farSnow} opacity="0.9" />
          {Array.from({ length: 34 }, (_, i) => (
            <ellipse key={i} cx={i * 12 + 4} cy={62 + ((i * 7) % 5)} rx={6 + (i % 3)} ry={8 + (i % 4)} fill={land.trees} opacity="0.85" />
          ))}
          <path d="M0 64 C 60 40, 120 44, 180 60 C 240 76, 300 40, 400 54 L400 110 L0 110 Z" fill={land.hills[0]} />
          <path d="M0 80 C 80 60, 150 66, 220 78 C 290 90, 340 64, 400 72 L400 110 L0 110 Z" fill={land.hills[1]} />
          <path d="M0 96 C 100 84, 200 90, 280 94 C 340 97, 370 88, 400 92 L400 110 L0 110 Z" fill={land.hills[2]} />
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
          FLOWERS.map((f, i) => (
            <span
              key={i}
              className={`pointer-events-none absolute block rounded-full ${immersive ? "size-2" : "size-1.5"}`}
              style={{ left: `${f.x}%`, top: `${f.y}%`, background: f.c, boxShadow: "0 0 0 1.5px rgba(255,255,255,0.25)" }}
              aria-hidden
            />
          ))}

        {immersive ? <div className="no-scrollbar relative flex min-h-0 flex-1 flex-col justify-center overflow-y-auto">{children}</div> : children}

        {night &&
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
        {allDone && !small && (
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
    </div>
  );
}
