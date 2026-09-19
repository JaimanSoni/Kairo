"use client";

import { useId } from "react";
import type { Phase } from "./scene";

/**
 * The land behind the garden: a far range fading into the haze, a waterfall
 * off a cliff with the river it feeds winding down the hills, a little
 * village of cottages with smoke from the chimney and windows that light up
 * as the evening comes, pines, and a windmill turning in the breeze.
 *
 * The hills stretch to any width; everything built (the cliff, the houses,
 * the windmill) keeps its shape and stands where the hills put it, so the
 * view holds together from the small card on Today to the full screen.
 * Layers go back to front, each object between the hills that frame it.
 */

type Land = { far: string; farSnow: string; trees: string; hills: [string, string, string] };

const HILLS = [
  "M0 64 C 60 40, 120 44, 180 60 C 240 76, 300 40, 400 54 L400 110 L0 110 Z",
  "M0 80 C 80 60, 150 66, 220 78 C 290 90, 340 64, 400 72 L400 110 L0 110 Z",
  "M0 96 C 100 84, 200 90, 280 94 C 340 97, 370 88, 400 92 L400 110 L0 110 Z",
];
const RANGE_BACK = "M0 50 L30 26 L58 38 L84 8 L112 34 L150 18 L178 40 L214 12 L250 36 L286 20 L318 42 L352 14 L384 32 L400 26 L400 110 L0 110 Z";
const RANGE_BACK_SNOW = "M78 14 L84 8 L90 15 L86 13 L84 17 Z M208 18 L214 12 L220 19 L216 17 L213 20 Z M346 20 L352 14 L358 21 L354 19 L351 22 Z";
const RANGE = "M0 58 L38 30 L62 44 L96 16 L130 46 L160 34 L196 54 L232 22 L270 50 L300 36 L338 56 L372 28 L400 44 L400 110 L0 110 Z";
const RANGE_SNOW = "M88 22 L96 16 L104 23 L99 22 L96 25 Z M226 28 L232 22 L239 29 L233 27 L230 30 Z M366 33 L372 28 L378 34 L373 32 Z";
/** From the foot of the falls, down the hill and behind the nearest one. */
const RIVER = "M50 72 C 64 74, 58 78, 84 80 C 110 82, 120 86, 150 87 C 172 88, 182 90, 204 93";

/** Each hour's light on things that were painted in daylight. */
const TINT: Record<Phase, [string, number]> = {
  day: ["#ffffff", 0],
  dawn: ["#b48fc8", 0.24],
  golden: ["#ff9a5a", 0.2],
  dusk: ["#3a2f66", 0.46],
  night: ["#0b1a33", 0.64],
};
/** The colour of the air at the horizon: distant things fade into it. */
const HAZE: Record<Phase, string> = { night: "#2a4570", dawn: "#ffd6a0", day: "#d4f1fb", golden: "#ffe19e", dusk: "#ee8f70" };

function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** Daylight colours of everything built or growing. */
const BASE = {
  rock: "#9c9aa0",
  rockDark: "#76747e",
  moss: "#6bab5a",
  water: "#d8f2ff",
  waterDeep: "#7cc2ea",
  wall: "#f6ecd9",
  wallShade: "#ddcfb4",
  roof: "#c95b43",
  roofShade: "#a5452f",
  roof2: "#4f7f8f",
  roof2Shade: "#3d6573",
  wood: "#8a5a3b",
  glass: "#bfe3f5",
  pine: "#3f8150",
  pineDark: "#2c6a3e",
  trunk: "#6b4a33",
  sail: "#f4efe4",
  stone: "#cfc6b8",
};
type Palette = typeof BASE;

function paletteFor(phase: Phase): Palette {
  const [to, t] = TINT[phase];
  const out = {} as Palette;
  for (const k of Object.keys(BASE) as (keyof Palette)[]) out[k] = mix(BASE[k], to, t);
  // moonlight keeps water a little brighter than the land around it
  if (phase === "night") {
    out.water = "#9fbde0";
    out.waterDeep = "#4d6f9c";
  }
  return out;
}

function Pine({ x, y, h, c }: { x: number; y: number; h: number; c: Palette }) {
  const w = h * 0.5;
  return (
    <g>
      <rect x={x - h * 0.04} y={y - h * 0.2} width={h * 0.08} height={h * 0.2} fill={c.trunk} />
      <path d={`M${x} ${y - h} L${x + w / 2} ${y - h * 0.18} L${x - w / 2} ${y - h * 0.18} Z`} fill={c.pine} />
      <path d={`M${x} ${y - h} L${x + w / 2} ${y - h * 0.18} L${x} ${y - h * 0.18} Z`} fill={c.pineDark} />
    </g>
  );
}

/** A window: glass by day, lamplight once the light goes. */
function Window({ x, y, s, lit, c, glow }: { x: number; y: number; s: number; lit: boolean; c: Palette; glow: string }) {
  return (
    <g>
      {lit && <circle cx={x + s / 2} cy={y + s / 2} r={s * 1.6} fill={`url(#${glow})`} />}
      <rect x={x} y={y} width={s} height={s} rx={0.6} fill={lit ? "#ffd27a" : c.glass} stroke={c.wood} strokeWidth={0.8} />
      <path d={`M${x + s / 2} ${y} V${y + s} M${x} ${y + s / 2} H${x + s}`} stroke={c.wood} strokeWidth={0.5} />
    </g>
  );
}

function Falls({ c, id, snowy, snow, detail, lit }: { c: Palette; id: string; snowy: number; snow: string; detail: boolean; lit: boolean }) {
  // white water by day; by lamplight it catches only a little of the moon
  const spray = lit ? mix(c.water, "#ffffff", 0.35) : "#ffffff";
  return (
    <svg className="absolute" style={{ left: "4%", bottom: "34%", height: "66%", aspectRatio: "100 / 120" }} viewBox="0 0 100 120" data-falls>
      <defs>
        <linearGradient id={`${id}-fall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.water} />
          <stop offset="0.7" stopColor={c.water} />
          <stop offset="1" stopColor={spray} />
        </linearGradient>
      </defs>
      {/* the cliff, lit from the left */}
      <path d="M2 120 L9 72 L5 54 L15 32 L28 22 L40 18 L47 20 L58 19 L70 15 L83 23 L91 40 L88 60 L96 86 L99 120 Z" fill={c.rock} />
      <path d="M58 19 L70 15 L83 23 L91 40 L88 60 L96 86 L99 120 L63 120 L61 60 Z" fill={c.rockDark} />
      <path d="M11 62 L30 59 M13 84 L34 81 M71 48 L87 51 M69 76 L92 79 M20 102 L38 100" stroke={c.rockDark} strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
      {/* green on top, and snow when there's snow */}
      <path d="M13 34 C 20 23, 34 17, 47 20 L47 24 C 34 22, 24 27, 16 37 Z" fill={c.moss} />
      <path d="M58 21 C 66 13, 80 15, 87 29 L83 31 C 77 22, 67 20, 58 25 Z" fill={c.moss} />
      {snowy > 0 && (
        <g fill={snow} opacity={snowy}>
          <path d="M13 34 C 20 23, 34 17, 47 20 L47 23 C 34 21, 24 26, 15 36 Z" />
          <path d="M58 21 C 66 13, 80 15, 87 29 L84 30 C 77 21, 67 19, 58 24 Z" />
        </g>
      )}
      {detail && (
        <>
          <Pine x={24} y={25} h={14} c={c} />
          <Pine x={31} y={22} h={11} c={c} />
          <Pine x={76} y={20} h={13} c={c} />
        </>
      )}
      {/* the water, falling */}
      <path d="M47 20 L58 19 L62 106 L43 106 Z" fill={`url(#${id}-fall)`} />
      {[48.5, 51.5, 54.5, 57].map((x, i) => (
        <path key={i} className="gd-flow" d={`M${x} 21 L${x + (x - 52.5) * 0.3} 105`} stroke={spray} strokeWidth="1.3" strokeLinecap="round" opacity={lit ? 0.55 : 0.8} style={{ animationDelay: `${-i * 0.23}s` }} />
      ))}
      {/* the pool it lands in, foaming, and the spray over it */}
      <ellipse cx="52" cy="111" rx="31" ry="7" fill={c.waterDeep} />
      <ellipse cx="52" cy="110" rx="23" ry="4.5" fill={c.water} opacity="0.85" />
      {[43, 48, 53, 58, 62].map((x, i) => (
        <circle key={i} className="gd-foam" cx={x} cy={106 + (i % 2)} r={3 + (i % 3)} fill={spray} style={{ animationDelay: `${-i * 0.3}s` }} />
      ))}
      <ellipse className="gd-mist" cx="52" cy="100" rx="24" ry="9" fill={spray} opacity={lit ? 0.2 : 0.4} />
    </svg>
  );
}

function Cottages({ c, id, lit, snowy, snow, hill }: { c: Palette; id: string; lit: boolean; snowy: number; snow: string; hill: string }) {
  const glow = `${id}-glow`;
  return (
    <svg className="absolute" style={{ left: "64%", bottom: "22%", height: "56%", aspectRatio: "120 / 70" }} viewBox="0 0 120 70" data-cottages>
      <defs>
        <radialGradient id={glow}>
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Pine x={8} y={60} h={30} c={c} />
      <Pine x={110} y={58} h={34} c={c} />
      <Pine x={101} y={60} h={24} c={c} />
      {/* smoke from the chimney */}
      {[0, 1, 2].map((i) => (
        <circle key={i} className="gd-smoke" cx="48" cy="13" r="3" fill={lit ? "#c9cbd6" : "#eef0f2"} opacity="0" style={{ animationDelay: `${-i * 1.4}s` }} />
      ))}
      {/* the cottage */}
      <rect x="45" y="14" width="6" height="14" fill={c.stone} />
      <rect x="16" y="34" width="40" height="28" fill={c.wall} />
      <rect x="44" y="34" width="12" height="28" fill={c.wallShade} />
      <path d="M10 37 L36 14 L62 37 Z" fill={c.roof} />
      <path d="M36 14 L62 37 L48 37 Z" fill={c.roofShade} />
      {snowy > 0 && <path d="M19 29 L36 14 L53 29 Q48.8 31.2 44.5 29 Q40.3 31.2 36.0 29 Q31.8 31.2 27.5 29 Q23.3 31.2 19.0 29 Z" fill={snow} opacity={snowy} />}
      <rect x="31" y="46" width="9" height="16" rx="4" fill={c.wood} />
      <Window x={20} y={42} s={7} lit={lit} c={c} glow={glow} />
      <Window x={45} y={42} s={7} lit={lit} c={c} glow={glow} />
      {/* its neighbour */}
      <rect x="70" y="42" width="28" height="21" fill={c.wall} />
      <rect x="88" y="42" width="10" height="21" fill={c.wallShade} />
      <path d="M65 44 L84 29 L103 44 Z" fill={c.roof2} />
      <path d="M84 29 L103 44 L92 44 Z" fill={c.roof2Shade} />
      {snowy > 0 && <path d="M72.5 38 L84 29 L95.5 38 Q92.6 40.2 89.8 38 Q86.9 40.2 84.0 38 Q81.1 40.2 78.3 38 Q75.4 40.2 72.5 38 Z" fill={snow} opacity={snowy} />}
      <Window x={75} y={49} s={6} lit={lit} c={c} glow={glow} />
      <Window x={88} y={49} s={6} lit={lit} c={c} glow={glow} />
      {/* the ground they stand on, and a path to the door */}
      <path d="M0 70 C 18 60, 100 58, 120 70 Z" fill={hill} />
      <path d="M33 62 C 34 66, 30 68, 26 70 L40 70 C 40 67, 40 64, 38 62 Z" fill={c.stone} opacity="0.7" />
    </svg>
  );
}

function Windmill({ c, windy, snowy, snow, hill }: { c: Palette; windy: boolean; snowy: number; snow: string; hill: string }) {
  return (
    <svg className="absolute" style={{ left: "84%", bottom: "33%", height: "66%", aspectRatio: "44 / 70" }} viewBox="0 0 44 70" data-windmill>
      <path d="M15 66 L18 26 L26 26 L29 66 Z" fill={c.wall} />
      <path d="M22 26 L26 26 L29 66 L22 66 Z" fill={c.wallShade} />
      <path d="M15.5 27 L22 17 L28.5 27 Z" fill={c.roof} />
      {snowy > 0 && <path d="M17 24.5 L22 17 L27 24.5 Q25.8 26.7 24.5 24.5 Q23.3 26.7 22.0 24.5 Q20.8 26.7 19.5 24.5 Q18.3 26.7 17.0 24.5 Z" fill={snow} opacity={snowy} />}
      <rect x="19.5" y="54" width="5" height="12" rx="2.5" fill={c.wood} />
      <g className="gd-mill" style={{ transformOrigin: "22px 25px", animationDuration: windy ? "2.6s" : "9s" }}>
        {[0, 90, 180, 270].map((a) => (
          <g key={a} transform={`rotate(${a} 22 25)`}>
            <rect x="21.2" y="6" width="1.6" height="19" fill={c.wood} />
            <rect x="22.8" y="7" width="4.4" height="15" fill={c.sail} stroke={c.wood} strokeWidth="0.5" />
          </g>
        ))}
        <circle cx="22" cy="25" r="1.8" fill={c.wood} />
      </g>
      <path d="M0 70 C 10 63, 34 63, 44 70 Z" fill={hill} />
    </svg>
  );
}

export function Landscape({
  phase,
  land,
  className,
  style,
  frost,
  windy,
  detail,
}: {
  phase: Phase;
  land: Land;
  /** Where the land sits and how tall it is. */
  className: string;
  style?: React.CSSProperties;
  /** Snow lying on everything, 0 to 1. */
  frost: number;
  windy: boolean;
  /** Everything, or only the big shapes (the small card on Today). */
  detail: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const c = paletteFor(phase);
  const night = phase === "night";
  const lit = night || phase === "dusk";
  const snow = night ? "#b9c6d6" : "#f4f8fb";
  const fence = night ? "#50473b" : "#b98d5e";
  const layer = "absolute inset-0 h-full w-full";
  return (
    <div className={`gd-par pointer-events-none absolute -left-[3%] bottom-0 w-[106%] ${className}`} style={style} aria-hidden data-landscape>
      {/* the far ranges, the treeline and the first hill */}
      <svg className={layer} viewBox="0 0 400 110" preserveAspectRatio="none">
        <path d={RANGE_BACK} fill={mix(land.far, HAZE[phase], 0.45)} opacity="0.75" />
        <path d={RANGE_BACK_SNOW} fill={land.farSnow} opacity="0.55" />
        <path d={RANGE} fill={land.far} opacity="0.8" />
        <path d={RANGE_SNOW} fill={land.farSnow} opacity="0.9" />
        {Array.from({ length: 34 }, (_, i) => (
          <ellipse key={i} cx={i * 12 + 4} cy={62 + ((i * 7) % 5)} rx={6 + (i % 3)} ry={8 + (i % 4)} fill={land.trees} opacity="0.85" />
        ))}
        <path d={HILLS[0]} fill={land.hills[0]} />
        {frost > 0 && <path d={HILLS[0]} fill={snow} opacity={frost} />}
      </svg>

      {/* the small card on Today keeps to the hills and the village: the falls would sit under its words */}
      {detail && <Falls c={c} id={id} snowy={frost} snow={snow} detail={detail} lit={lit} />}

      {/* the middle hill, and the river the falls feed */}
      <svg className={layer} viewBox="0 0 400 110" preserveAspectRatio="none">
        <path d={HILLS[1]} fill={land.hills[1]} />
        {frost > 0 && <path d={HILLS[1]} fill={snow} opacity={frost} />}
        {detail && (
          <>
            <path d={RIVER} fill="none" stroke={c.waterDeep} strokeWidth="9" strokeLinecap="round" />
            <path d={RIVER} fill="none" stroke={c.water} strokeWidth="5.5" strokeLinecap="round" />
            <path className="gd-glint" d={RIVER} fill="none" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity={lit ? 0.45 : 0.85} />
          </>
        )}
        {/* a footbridge over it */}
        {detail && (
          <g>
            <path d="M136 90 Q 147 80, 158 89 L158 91.5 Q 147 83, 136 92.5 Z" fill={c.wood} />
            <path d="M137 86 Q 147 76.5, 157 85.5" fill="none" stroke={c.wood} strokeWidth="0.9" />
            {[139, 143, 147, 151, 155].map((x) => (
              <path key={x} d={`M${x} ${x < 147 ? 90 - (x - 136) * 0.75 : 82 + (x - 147) * 0.7} v-3.4`} stroke={c.wood} strokeWidth="0.8" />
            ))}
          </g>
        )}
      </svg>

      {detail && (
        <svg className="absolute" style={{ left: "27%", bottom: "40%", height: "34%", aspectRatio: "60 / 40" }} viewBox="0 0 60 40">
          <Pine x={12} y={40} h={30} c={c} />
          <Pine x={24} y={40} h={38} c={c} />
          <Pine x={36} y={40} h={26} c={c} />
          <Pine x={47} y={40} h={32} c={c} />
        </svg>
      )}
      <Cottages c={c} id={id} lit={lit} snowy={frost} snow={snow} hill={frost > 0 ? mix(land.hills[1], snow, frost) : land.hills[1]} />
      {detail && <Windmill c={c} windy={windy} snowy={frost} snow={snow} hill={frost > 0 ? mix(land.hills[1], snow, frost) : land.hills[1]} />}

      {/* the nearest hill and the garden's fence */}
      <svg className={layer} viewBox="0 0 400 110" preserveAspectRatio="none">
        <path d={HILLS[2]} fill={land.hills[2]} />
        {frost > 0 && <path d={HILLS[2]} fill={snow} opacity={frost} />}
        {Array.from({ length: 22 }, (_, i) => (
          <rect key={i} x={i * 19 + 4} y={84} width={2.2} height={12} fill={fence} opacity={0.75} />
        ))}
        <rect x={0} y={87} width={400} height={1.6} fill={fence} opacity={0.7} />
      </svg>
    </div>
  );
}
