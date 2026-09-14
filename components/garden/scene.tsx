"use client";

import { useClock } from "./fx";

/**
 * The garden's world: a sky that follows the clock, a sun or moon on its arc,
 * weather that follows the day, hills, and the ground everything grows in.
 * The plots are passed in as children and laid out on the ground.
 */

export type Weather = "clear" | "partly" | "cloudy";

type Phase = "night" | "dawn" | "day" | "golden" | "dusk";

function phaseOf(min: number): Phase {
  const h = min / 60;
  if (h < 5 || h >= 21) return "night";
  if (h < 7) return "dawn";
  if (h < 17) return "day";
  if (h < 19) return "golden";
  return "dusk";
}

const SKY: Record<Phase, string> = {
  night: "linear-gradient(180deg, #0a1631 0%, #1c3157 60%, #2c4a72 100%)",
  dawn: "linear-gradient(180deg, #7f93dc 0%, #f4b6a3 62%, #ffd9a8 100%)",
  day: "linear-gradient(180deg, #5eb8f0 0%, #9fd9f6 60%, #d6f1fb 100%)",
  golden: "linear-gradient(180deg, #f08a5d 0%, #f7b267 55%, #ffe0a3 100%)",
  dusk: "linear-gradient(180deg, #2e2f73 0%, #7a5a9e 55%, #f09372 100%)",
};

const HILLS: Record<Phase, [string, string, string]> = {
  night: ["#1d3a3c", "#244a45", "#2d5a4c"],
  dawn: ["#8cbf8a", "#74b073", "#5e9f63"],
  day: ["#9fd48c", "#7fc475", "#62b163"],
  golden: ["#b8c77a", "#94b765", "#74a557"],
  dusk: ["#4f6e6a", "#46655a", "#3d5c4f"],
};

const GROUND: Record<Phase, string> = {
  night: "linear-gradient(180deg, #2f5a48 0%, #274b3c 100%)",
  dawn: "linear-gradient(180deg, #6fae67 0%, #5b9a57 100%)",
  day: "linear-gradient(180deg, #74bd66 0%, #5da955 100%)",
  golden: "linear-gradient(180deg, #86b25e 0%, #6c9c4f 100%)",
  dusk: "linear-gradient(180deg, #46705a 0%, #3b604c 100%)",
};

const STARS = Array.from({ length: 34 }, (_, i) => ({ x: (i * 53) % 100, y: (i * 29) % 62, r: i % 5 === 0 ? 1.6 : 1, d: (i % 7) * 0.4 }));

export function GardenScene({
  weather,
  thriving = 0,
  children,
  compact = false,
}: {
  weather: Weather;
  /** How many plants are thriving: the more, the more life flies about. */
  thriving?: number;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const min = useClock();
  const phase = phaseOf(min);
  const night = phase === "night";
  // the sun rises at 6 and sets at 19; the moon crosses the rest of the night
  const dayT = Math.min(1, Math.max(0, (min / 60 - 6) / 13));
  const nightT = ((min / 60 + 24 - 19) % 24) / 11;
  const t = night || phase === "dusk" ? Math.min(1, nightT) : dayT;
  const orbX = 8 + t * 84;
  const orbY = 62 - Math.sin(t * Math.PI) * 48;
  const clouds = weather === "clear" ? 1 : weather === "partly" ? 3 : 5;
  const grey = weather === "cloudy";
  const hills = HILLS[phase];

  return (
    <div
      className={`gd-scene relative isolate overflow-hidden rounded-[1.75rem] border border-line/60 shadow-xl shadow-ink/5 ${compact ? "" : ""}`}
      data-phase={phase}
      data-weather={weather}
    >
      {/* sky */}
      <div className={`relative ${compact ? "h-28" : "h-40 sm:h-52"}`} style={{ background: SKY[phase] }}>
        {(night || phase === "dusk") &&
          STARS.map((s, i) => (
            <span
              key={i}
              className="gd-star absolute rounded-full bg-white"
              style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.r * 2, height: s.r * 2, animationDelay: `${s.d}s`, opacity: phase === "dusk" ? 0.5 : 0.9 }}
            />
          ))}
        <div
          className="absolute transition-[left,top] duration-1000"
          style={{ left: `${orbX}%`, top: `${orbY}%`, transform: "translate(-50%, -50%)" }}
          aria-hidden
        >
          {night || phase === "dusk" ? (
            <div className="relative size-10 rounded-full bg-[#f4f1de] shadow-[0_0_30px_8px_rgba(244,241,222,0.35)]">
              <span className="absolute left-2 top-3 size-2 rounded-full bg-[#dcd7bf]" />
              <span className="absolute bottom-2 right-3 size-1.5 rounded-full bg-[#dcd7bf]" />
            </div>
          ) : (
            <div className={`size-12 rounded-full bg-[#ffd35c] shadow-[0_0_40px_14px_rgba(255,211,92,0.55)] ${grey ? "opacity-60" : ""}`} />
          )}
        </div>
        {Array.from({ length: clouds }, (_, i) => (
          <div
            key={i}
            className="gd-cloud absolute"
            style={{ top: `${10 + ((i * 23) % 46)}%`, animationDuration: `${70 + i * 18}s`, animationDelay: `${-i * 21}s` }}
            aria-hidden
          >
            <svg width={90 + (i % 2) * 40} viewBox="0 0 120 44">
              <path
                d="M20 40 C 4 40, 2 22, 18 20 C 18 6, 40 2, 48 14 C 56 2, 82 4, 84 20 C 102 16, 118 30, 104 40 Z"
                fill={night ? "#3b4f73" : grey ? "#d5dde3" : "#ffffff"}
                opacity={night ? 0.55 : grey ? 0.95 : 0.9}
              />
            </svg>
          </div>
        ))}
        {/* hills, where the sky meets the ground */}
        <svg className="absolute inset-x-0 bottom-0 h-20 w-full" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden>
          <path d="M0 50 C 60 18, 120 22, 180 44 C 240 64, 300 20, 400 36 L400 80 L0 80 Z" fill={hills[0]} />
          <path d="M0 62 C 80 40, 150 48, 220 60 C 290 72, 340 46, 400 54 L400 80 L0 80 Z" fill={hills[1]} />
          <path d="M0 74 C 100 62, 200 68, 280 72 C 340 75, 370 66, 400 70 L400 80 L0 80 Z" fill={hills[2]} />
          {/* a fence along the far edge */}
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={i} x={i * 19 + 4} y={62} width={2.2} height={12} fill={night ? "#50473b" : "#b98d5e"} opacity={0.75} />
          ))}
          <rect x={0} y={65} width={400} height={1.6} fill={night ? "#50473b" : "#b98d5e"} opacity={0.7} />
        </svg>
      </div>

      {/* ground */}
      <div className="relative" style={{ background: GROUND[phase] }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 70% 60%, #fff 0 1px, transparent 1.5px)", backgroundSize: "34px 30px, 46px 38px" }}
          aria-hidden
        />
        {children}
        {night &&
          Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className="gd-firefly pointer-events-none absolute size-1.5 rounded-full bg-[#fff59d]"
              style={{ left: `${(i * 37) % 95}%`, top: `${10 + ((i * 17) % 75)}%`, animationDelay: `${-i * 1.3}s` }}
              aria-hidden
            />
          ))}
        {!night &&
          Array.from({ length: Math.min(4, Math.floor(thriving / 1.5) + (weather === "clear" && thriving > 0 ? 1 : 0)) }, (_, i) => (
            <div
              key={i}
              className="gd-butterfly pointer-events-none absolute"
              style={{ left: `${12 + ((i * 31) % 70)}%`, top: `${8 + ((i * 19) % 40)}%`, animationDelay: `${-i * 2.7}s` }}
              aria-hidden
            >
              <svg width="16" height="14" viewBox="0 0 16 14">
                <g className="gd-wings">
                  <ellipse cx="4.5" cy="5" rx="4" ry="4.5" fill={["#ffb74d", "#f06292", "#9575cd", "#4fc3f7"][i % 4]} />
                  <ellipse cx="11.5" cy="5" rx="4" ry="4.5" fill={["#ffcc80", "#f48fb1", "#b39ddb", "#81d4fa"][i % 4]} />
                </g>
                <rect x="7.3" y="3" width="1.4" height="9" rx="0.7" fill="#4e342e" />
              </svg>
            </div>
          ))}
      </div>
    </div>
  );
}
