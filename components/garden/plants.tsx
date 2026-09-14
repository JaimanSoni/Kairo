"use client";

import { useId } from "react";
import type { Health, SpeciesId } from "@/lib/habits-shared";

/**
 * Every plant in the garden, drawn in code.
 *
 * One SVG per plant, 120×150, rooted at (60, 128). A plant is a species, a
 * stage (0 seed … 6 bearing fruit) and a health, and nothing else: a thirsty
 * plant droops, a wilted one sags and fades, and watering it brings it back —
 * all from the same drawing with a different droop. Ripe fruit hangs where it
 * can be tapped; golden fruit glows.
 */

export type PlantProps = {
  species: SpeciesId;
  stage: number;
  health?: Health;
  /** Fruits ripe for picking (drawn big and glowing). */
  ripe?: number;
  golden?: number;
  size?: number;
  ground?: "mound" | "none";
  sway?: boolean;
  className?: string;
  /** Delay so a row of plants doesn't sway in lockstep. */
  phase?: number;
  /**
   * How closely the frame hugs a young plant. "full" keeps every stage at the
   * same scale; "snug" zooms in on seeds and sprouts a little, so they read on
   * the ground; "tight" fills a thumbnail with whatever is there.
   */
  fit?: "full" | "snug" | "tight";
};

/** The frame, 4:5 like the drawing, anchored just below the soil line. */
function frameFor(stage: number, fit: "full" | "snug" | "tight"): string {
  if (fit === "full" || stage >= 5) return "0 0 120 150";
  const widths = fit === "tight" ? [60, 60, 76, 96, 108] : [84, 84, 92, 104, 112];
  const w = widths[Math.min(stage, 4)];
  const h = w * 1.25;
  return `${60 - w / 2} ${146 - h} ${w} ${h}`;
}

const DROOP: Record<Health, number> = { thriving: 0, healthy: 0.06, thirsty: 0.5, wilted: 1 };

const C = {
  leaf: "#5bb36a",
  leafLight: "#7fcd84",
  leafDark: "#3f8f52",
  stem: "#4f9a5a",
  soil: "#8a5a3b",
  soilDark: "#6b4429",
  trunk: "#8b5a3c",
  trunkDark: "#6e4530",
};

type Draw = { d: number; s: number; bloom: boolean; fruit: boolean; ripe: number; golden: number; gid: string };

export function Plant({ species, stage, health = "healthy", ripe = 0, golden = 0, size = 120, ground = "mound", sway = true, className = "", phase = 0, fit = "full" }: PlantProps) {
  const uid = useId().replace(/:/g, "");
  const d = DROOP[health];
  const s = stage <= 3 ? 0.62 : stage === 4 ? 0.85 : 1;
  const draw: Draw = { d, s, bloom: stage >= 5, fruit: stage >= 6, ripe: Math.min(ripe, 5), golden: Math.min(golden, 2), gid: uid };
  const Species = SPECIES_DRAW[species] ?? Sunflower;

  return (
    <svg viewBox={frameFor(stage, fit)} width={size} height={size * 1.25} className={`gd-plant gd-${health} ${className}`} aria-hidden>
      <defs>
        <radialGradient id={`gold-${uid}`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff6c2" />
          <stop offset="55%" stopColor="#ffcf3f" />
          <stop offset="100%" stopColor="#d99a0b" />
        </radialGradient>
        <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff3a0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff3a0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`soil-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.soil} />
          <stop offset="100%" stopColor={C.soilDark} />
        </linearGradient>
        <linearGradient id={`water-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fd8f0" />
          <stop offset="100%" stopColor="#4aa3c9" />
        </linearGradient>
      </defs>
      {ground === "mound" && species === "lotus" && stage < 3 && (
        <ellipse cx="60" cy="130" rx="30" ry="8" fill={`url(#water-${uid})`} />
      )}
      {ground === "mound" && species !== "lotus" && (
        <g>
          <ellipse cx="60" cy="131" rx="34" ry="9" fill={`url(#soil-${uid})`} />
          <ellipse cx="52" cy="128.5" rx="12" ry="2.2" fill="#a0704c" opacity="0.5" />
        </g>
      )}
      <g className={sway && stage > 0 ? "gd-sway" : ""} style={{ transformOrigin: "60px 128px", animationDelay: `${-phase}s` }}>
        {stage === 0 ? <Seed /> : stage <= 2 ? <Sprout stage={stage} d={d} species={species} /> : (
          <g transform={`translate(60 128) scale(${s}) translate(-60 -128)`}>
            <Species {...draw} />
          </g>
        )}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------ primitives */

function leafPath(len: number, width: number): string {
  return `M0 0 C ${width} ${-len * 0.25}, ${width} ${-len * 0.75}, 0 ${-len} C ${-width} ${-len * 0.75}, ${-width} ${-len * 0.25}, 0 0 Z`;
}

function Leaf({ x, y, angle, len, width, fill = C.leaf, vein = true }: { x: number; y: number; angle: number; len: number; width: number; fill?: string; vein?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={leafPath(len, width)} fill={fill} />
      {vein && <path d={`M0 0 L0 ${-len * 0.9}`} stroke={C.leafDark} strokeWidth={0.9} strokeLinecap="round" opacity={0.55} />}
    </g>
  );
}

/** A leaf that droops outward as the plant gets thirsty. */
const droopAngle = (angle: number, d: number) => angle + Math.sign(angle || 1) * d * 38;

function Fruit({ x, y, r, fill, gid, golden, ripe, shape = "round", i = 0 }: { x: number; y: number; r: number; fill: string; gid: string; golden?: boolean; ripe?: boolean; shape?: "round" | "oval" | "drop" | "berry"; i?: number }) {
  const paint = golden ? `url(#gold-${gid})` : fill;
  const body =
    shape === "oval" ? (
      <ellipse cx={0} cy={0} rx={r * 0.8} ry={r * 1.05} fill={paint} />
    ) : shape === "drop" ? (
      <path d={`M0 ${-r * 1.2} C ${r} ${-r * 0.2}, ${r} ${r}, 0 ${r} C ${-r} ${r}, ${-r} ${-r * 0.2}, 0 ${-r * 1.2} Z`} fill={paint} />
    ) : shape === "berry" ? (
      <g>
        <path d={`M0 ${r * 1.15} C ${-r * 1.1} ${r * 0.2}, ${-r} ${-r * 0.9}, 0 ${-r * 0.7} C ${r} ${-r * 0.9}, ${r * 1.1} ${r * 0.2}, 0 ${r * 1.15} Z`} fill={paint} />
        {[[-0.35, -0.1], [0.3, 0], [0, 0.45], [-0.2, 0.5], [0.35, 0.45]].map(([a, b], k) => (
          <circle key={k} cx={a * r} cy={b * r} r={0.12 * r} fill="#fff3b0" opacity={0.85} />
        ))}
        <path d={`M${-r * 0.6} ${-r * 0.75} L0 ${-r * 0.5} L${r * 0.6} ${-r * 0.75}`} stroke={C.leafDark} strokeWidth={r * 0.28} fill="none" strokeLinecap="round" />
      </g>
    ) : (
      <circle cx={0} cy={0} r={r} fill={paint} />
    );
  return (
    <g transform={`translate(${x} ${y})`} className={ripe || golden ? "gd-ripe" : ""} style={{ animationDelay: `${i * 0.35}s` }}>
      {(ripe || golden) && <circle r={r * 2.2} fill={`url(#glow-${gid})`} opacity={golden ? 1 : 0.6} />}
      {body}
      {shape !== "berry" && <ellipse cx={-r * 0.35} cy={-r * 0.35} rx={r * 0.28} ry={r * 0.18} fill="#fff" opacity={0.45} />}
      {golden && <path d={`M${r * 0.9} ${-r * 1.3} l1.2 -2.6 l1.2 2.6 l2.6 1.2 l-2.6 1.2 l-1.2 2.6 l-1.2 -2.6 l-2.6 -1.2 Z`} fill="#fffbe0" className="gd-twinkle" />}
    </g>
  );
}

/** Ripe fruit at chosen spots: ripe ones big, golden ones gold, the rest small and green while they grow. */
function FruitSet({ spots, dr, color, shape, unripe = "#9ccf6e", r = 5 }: { spots: [number, number][]; dr: Draw; color: string; shape?: "round" | "oval" | "drop" | "berry"; unripe?: string; r?: number }) {
  if (!dr.fruit) return null;
  const golden = dr.golden;
  const ripe = dr.ripe;
  return (
    <g>
      {spots.map(([x, y], i) => {
        if (i < golden) return <Fruit key={i} i={i} x={x} y={y + dr.d * 4} r={r * 1.1} fill={color} gid={dr.gid} golden shape={shape} />;
        if (i < golden + ripe) return <Fruit key={i} i={i} x={x} y={y + dr.d * 4} r={r} fill={color} gid={dr.gid} ripe shape={shape} />;
        if (i < 3) return <Fruit key={i} i={i} x={x} y={y + dr.d * 4} r={r * 0.55} fill={unripe} gid={dr.gid} shape={shape} />;
        return null;
      })}
    </g>
  );
}

function Petals({ n, r, rx, ry, fill, offset = 0 }: { n: number; r: number; rx: number; ry: number; fill: string; offset?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <ellipse key={i} cx={0} cy={-r} rx={rx} ry={ry} fill={fill} transform={`rotate(${(360 / n) * i + offset})`} />
      ))}
    </g>
  );
}

function SmallBloom({ x, y, r = 3.2, petal = "#ffffff", center = "#ffd54f" }: { x: number; y: number; r?: number; petal?: string; center?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <Petals n={5} r={r * 0.75} rx={r * 0.62} ry={r * 0.75} fill={petal} />
      <circle r={r * 0.45} fill={center} />
    </g>
  );
}

/* ---------------------------------------------------------- early stages */

function Seed() {
  return (
    <g>
      <ellipse cx="60" cy="125" rx="7" ry="5" fill="#b07a4f" transform="rotate(-18 60 125)" />
      <path d="M56 123 Q60 121 64 124" stroke="#e7c49a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M60 119 q1 -3 3 -4" stroke={C.leafLight} strokeWidth="1.6" fill="none" strokeLinecap="round" className="gd-peek" />
    </g>
  );
}

function Sprout({ stage, d, species }: { stage: number; d: number; species: SpeciesId }) {
  const top = stage === 1 ? 108 : 94;
  const lean = d * 7;
  const tint = species === "cactus" ? "#68b86a" : species === "lavender" ? "#8fb39a" : C.leaf;
  return (
    <g>
      <path d={`M60 128 Q${60 + lean * 0.3} ${(128 + top) / 2} ${60 + lean} ${top + d * 4}`} stroke={C.stem} strokeWidth={stage === 1 ? 2.4 : 3} fill="none" strokeLinecap="round" />
      <Leaf x={60 + lean} y={top + d * 4} angle={droopAngle(-55, d)} len={stage === 1 ? 13 : 16} width={stage === 1 ? 6 : 7} fill={tint} vein={false} />
      <Leaf x={60 + lean} y={top + d * 4} angle={droopAngle(55, d)} len={stage === 1 ? 13 : 16} width={stage === 1 ? 6 : 7} fill={tint} vein={false} />
      {stage === 2 && (
        <>
          <Leaf x={60 + lean * 0.5} y={112} angle={droopAngle(-70, d)} len={18} width={7} fill={C.leafDark} />
          <Leaf x={60 + lean * 0.5} y={108} angle={droopAngle(68, d)} len={17} width={7} fill={C.leafDark} />
        </>
      )}
    </g>
  );
}

/* --------------------------------------------------------------- species */

function Sunflower(dr: Draw) {
  const { d, bloom } = dr;
  const hx = 60 + d * 14;
  const hy = 38 + d * 16;
  return (
    <g>
      <path d={`M60 128 C 58 100, ${62 + d * 4} 70, ${hx} ${hy}`} stroke={C.stem} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <Leaf x={59} y={110} angle={droopAngle(-62, d)} len={30} width={13} />
      <Leaf x={60} y={98} angle={droopAngle(58, d)} len={32} width={14} fill={C.leafLight} />
      <Leaf x={61} y={80} angle={droopAngle(-55, d)} len={26} width={11} />
      <Leaf x={61} y={66} angle={droopAngle(50, d)} len={22} width={10} fill={C.leafLight} />
      <g transform={`translate(${hx} ${hy}) rotate(${d * 40})`}>
        {bloom ? (
          <>
            <Petals n={16} r={15} rx={4.2} ry={10} fill="#f5b800" offset={11} />
            <Petals n={16} r={13} rx={4} ry={9.5} fill="#ffd23f" />
            <circle r={11} fill="#6b4423" />
            <circle r={8} fill="#7d5230" />
            {Array.from({ length: 12 }, (_, i) => (
              <circle key={i} cx={Math.cos(i * 2.4) * (2 + i * 0.55)} cy={Math.sin(i * 2.4) * (2 + i * 0.55)} r={0.9} fill="#3d2615" />
            ))}
          </>
        ) : (
          <>
            <Petals n={6} r={4} rx={3} ry={5} fill={C.leafDark} />
            <circle r={5} fill="#86c46f" />
          </>
        )}
      </g>
      <FruitSet dr={dr} color="#5a3a22" shape="drop" r={3.6} unripe="#b88a5a" spots={[[40, 60], [80, 58], [36, 76], [84, 76], [60, 12]]} />
    </g>
  );
}

function Tulip(dr: Draw) {
  const { d, bloom, fruit } = dr;
  const cup = (x: number, y: number, color: string, dark: string, tilt: number) => (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      {bloom ? (
        <>
          <path d="M-9 0 C -11 -12, -6 -20, 0 -19 C 6 -20, 11 -12, 9 0 C 5 5, -5 5, -9 0 Z" fill={color} />
          <path d="M-3 2 C -8 -8, -4 -18, 0 -21 C 4 -18, 8 -8, 3 2 Z" fill={dark} opacity="0.55" />
          <path d="M-9 0 C -9 -6, -8 -13, -5 -17" stroke="#fff" strokeWidth="1" opacity="0.35" fill="none" />
        </>
      ) : (
        <path d="M-5 0 C -6 -8, -3 -13, 0 -14 C 3 -13, 6 -8, 5 0 C 3 3, -3 3, -5 0 Z" fill="#9fd08b" />
      )}
    </g>
  );
  return (
    <g>
      <path d={`M60 128 C 60 100, ${60 + d * 6} 80, ${60 + d * 12} ${56 + d * 14}`} stroke={C.stem} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      {fruit && (
        <>
          <path d={`M60 126 C 52 104, ${44 + d * 4} 96, ${40 + d * 8} ${78 + d * 10}`} stroke={C.stem} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d={`M60 126 C 70 104, ${76 + d * 4} 98, ${82 + d * 8} ${82 + d * 10}`} stroke={C.stem} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </>
      )}
      <g transform={`translate(58 126) rotate(${droopAngle(-14, d)})`}>
        <path d="M0 0 C -14 -18, -12 -44, -2 -58 C -3 -38, -1 -18, 4 0 Z" fill={C.leaf} />
      </g>
      <g transform={`translate(62 126) rotate(${droopAngle(16, d)})`}>
        <path d="M0 0 C 14 -16, 13 -40, 3 -52 C 3 -34, 1 -16, -4 0 Z" fill={C.leafLight} />
      </g>
      {fruit && cup(40 + d * 8, 78 + d * 10, "#ffb347", "#e8891c", -12 + d * 30)}
      {fruit && cup(82 + d * 8, 82 + d * 10, "#c77dff", "#9d4edd", 12 + d * 30)}
      {cup(60 + d * 12, 56 + d * 14, "#ff5c8a", "#d6336c", d * 35)}
      <FruitSet dr={dr} color="#d9a066" shape="drop" r={4} unripe="#e7c9a0" spots={[[34, 118], [86, 118], [46, 122], [74, 122], [60, 20]]} />
    </g>
  );
}

function Lavender(dr: Draw) {
  const { d, bloom } = dr;
  const stems: [number, number, number][] = [
    [-24, 58, -22],
    [-13, 46, -12],
    [0, 40, 0],
    [12, 46, 11],
    [24, 58, 21],
    [-6, 52, -5],
    [6, 54, 6],
  ];
  return (
    <g>
      {stems.map(([dx, top, lean], i) => {
        const tx = 60 + dx + d * (lean * 0.8);
        const ty = top + d * 18;
        return (
          <g key={i}>
            <path d={`M60 128 Q ${60 + dx * 0.3} ${(128 + ty) / 2 + 10} ${tx} ${ty}`} stroke="#7aa586" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            {Array.from({ length: 6 }, (_, k) => (
              <ellipse
                key={k}
                cx={tx + (k % 2 ? 1.6 : -1.6)}
                cy={ty + k * 3.6}
                rx={2.2}
                ry={2.9}
                fill={bloom ? (k < 2 ? "#b39ddb" : "#8e6fd6") : "#9fbfa4"}
              />
            ))}
          </g>
        );
      })}
      {[-28, -14, 14, 28].map((dx, i) => (
        <Leaf key={i} x={60} y={126} angle={droopAngle(dx * 1.6, d)} len={20} width={3} fill="#8fb39a" vein={false} />
      ))}
      <FruitSet dr={dr} color="#7e57c2" shape="oval" r={3.4} unripe="#c5b3e6" spots={[[36, 72], [84, 72], [30, 92], [90, 92], [60, 26]]} />
    </g>
  );
}

function Rose(dr: Draw) {
  const { d, bloom, fruit } = dr;
  const bloomAt = (x: number, y: number, r: number, i: number) => (
    <g key={i} transform={`translate(${x} ${y + d * 10}) rotate(${d * 30})`}>
      {bloom ? (
        <>
          <circle r={r} fill="#e63950" />
          <path d={`M${-r * 0.7} 0 A ${r * 0.7} ${r * 0.7} 0 1 1 ${r * 0.5} ${r * 0.5}`} stroke="#b71c3a" strokeWidth={1.4} fill="none" />
          <path d={`M${-r * 0.35} 0 A ${r * 0.35} ${r * 0.35} 0 1 1 ${r * 0.25} ${r * 0.25}`} stroke="#b71c3a" strokeWidth={1.2} fill="none" />
          <path d={`M${-r} ${r * 0.2} Q 0 ${r * 1.4} ${r} ${r * 0.2}`} fill="#c62a45" />
        </>
      ) : (
        <path d={`M0 ${r * 0.8} C ${-r * 0.7} 0, ${-r * 0.3} ${-r}, 0 ${-r * 1.1} C ${r * 0.3} ${-r}, ${r * 0.7} 0, 0 ${r * 0.8} Z`} fill="#e57383" />
      )}
    </g>
  );
  return (
    <g>
      <path d={`M60 128 C 58 104, ${60 + d * 6} 80, ${60 + d * 10} ${50 + d * 12}`} stroke="#4c8a56" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M60 104 C 50 96, 44 86, 40 74" stroke="#4c8a56" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M60 96 C 70 88, 76 80, 80 70" stroke="#4c8a56" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {[[58, 112], [61, 90], [50, 94], [72, 84]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} l3 -2 l-1 3 Z`} fill="#3f6f47" />
      ))}
      {[[60, 116, -58], [60, 108, 60], [48, 92, -64], [72, 84, 62], [58, 76, -50], [62, 68, 48]].map(([x, y, a], i) => (
        <g key={i}>
          <Leaf x={x} y={y} angle={droopAngle(a, d)} len={14} width={6.5} fill={i % 2 ? C.leafDark : C.leaf} />
        </g>
      ))}
      {bloomAt(60 + d * 10, 46, 11, 0)}
      {fruit && bloomAt(40, 70, 8, 1)}
      {fruit && bloomAt(80, 66, 8, 2)}
      <FruitSet dr={dr} color="#e8743b" shape="oval" r={4.2} unripe="#f3b18a" spots={[[32, 88], [88, 84], [46, 60], [74, 56], [60, 28]]} />
    </g>
  );
}

function Cactus(dr: Draw) {
  const { d, bloom, s } = dr;
  const lean = d * 9;
  return (
    <g transform={`rotate(${lean} 60 128)`}>
      <path d="M48 128 L48 58 C 48 40, 72 40, 72 58 L72 128 Z" fill="#5aa95a" />
      <path d="M54 126 L54 52 M60 126 L60 46 M66 126 L66 52" stroke="#478f47" strokeWidth="1.4" />
      {s >= 0.85 && (
        <>
          <path d="M48 96 L38 96 C 30 96, 30 88, 30 80 L30 66 C 30 58, 40 58, 40 66 L40 86 L48 86 Z" fill="#62b262" />
          <path d="M72 88 L82 88 C 90 88, 90 80, 90 72 L90 60 C 90 52, 80 52, 80 60 L80 78 L72 78 Z" fill="#62b262" />
        </>
      )}
      {Array.from({ length: 14 }, (_, i) => {
        const x = 49 + ((i * 7) % 23);
        const y = 56 + ((i * 11) % 66);
        return <path key={i} d={`M${x} ${y} l-2 -1.5 M${x} ${y} l2 -1.5`} stroke="#f4f1d0" strokeWidth="0.8" opacity="0.8" />;
      })}
      {bloom && (
        <g transform="translate(60 44)">
          <Petals n={8} r={5} rx={3} ry={5} fill="#ff7eb6" />
          <circle r={3} fill="#ffd54f" />
        </g>
      )}
      <FruitSet dr={dr} color="#d6336c" shape="oval" r={4.6} unripe="#e9a3bd" spots={[[46, 50], [74, 50], [30, 58], [90, 52], [60, 34]]} />
    </g>
  );
}

function Bonsai(dr: Draw) {
  const { d, bloom } = dr;
  const sag = d * 8;
  const cloud = (x: number, y: number, w: number, i: number) => (
    <g key={i} transform={`translate(${x} ${y + sag})`}>
      <ellipse cx={0} cy={2} rx={w} ry={w * 0.42} fill="#4f8f4d" />
      <ellipse cx={-w * 0.3} cy={-1} rx={w * 0.6} ry={w * 0.36} fill="#5fa35c" />
      <ellipse cx={w * 0.35} cy={-2} rx={w * 0.55} ry={w * 0.33} fill="#72b86a" />
      {bloom && [[-0.5, -0.1], [0.1, -0.35], [0.55, 0.05], [-0.1, 0.25]].map(([a, b], k) => <SmallBloom key={k} x={a * w} y={b * w} r={2.4} petal="#ffd6e0" center="#ff8fab" />)}
    </g>
  );
  return (
    <g>
      <path d="M40 128 L80 128 L76 120 L44 120 Z" fill="#3e6f8e" />
      <rect x="42" y="117" width="36" height="4" rx="1.5" fill="#4d86a8" />
      <path d={`M60 118 C 52 104, 70 96, 58 84 C 50 76, 62 66, 66 ${58 + sag}`} stroke={C.trunk} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d={`M58 90 C 48 86, 42 ${82 + sag}, 36 ${80 + sag}`} stroke={C.trunkDark} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d={`M62 72 C 72 70, 80 ${66 + sag}, 86 ${62 + sag}`} stroke={C.trunkDark} strokeWidth="3" fill="none" strokeLinecap="round" />
      {cloud(34, 78, 16, 0)}
      {cloud(86, 60, 15, 1)}
      {cloud(64, 50, 20, 2)}
      <FruitSet dr={dr} color="#8a5a3b" shape="oval" r={4} unripe="#b99b78" spots={[[28, 88], [92, 70], [56, 62], [72, 58], [64, 38]]} />
    </g>
  );
}

function Tree(dr: Draw & { kind: "apple" | "lemon" | "cherry" }) {
  const { d, bloom, kind } = dr;
  const sag = d * 10;
  const canopy =
    kind === "cherry" && bloom
      ? ["#ffc1d3", "#ffadc6", "#ff9fbd"]
      : kind === "lemon"
        ? ["#4e9a52", "#5fae5f", "#78c272"]
        : ["#4a9550", "#5aaa5c", "#73bf6c"];
  const blobs: [number, number, number][] = [
    [60, 52, 26],
    [38, 64, 18],
    [82, 62, 19],
    [48, 40, 17],
    [74, 38, 18],
    [60, 30, 15],
  ];
  const fruit = kind === "apple" ? { color: "#e53935", shape: "round" as const } : kind === "lemon" ? { color: "#ffd23f", shape: "oval" as const } : { color: "#c2185b", shape: "round" as const };
  return (
    <g>
      <path d="M56 128 C 57 110, 55 92, 58 72 L62 72 C 65 92, 63 110, 64 128 Z" fill={C.trunk} />
      <path d="M59 92 C 50 84, 44 78, 40 68" stroke={C.trunk} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M61 84 C 70 78, 76 72, 80 64" stroke={C.trunk} strokeWidth="3" fill="none" strokeLinecap="round" />
      <g transform={`translate(0 ${sag}) scale(1 ${1 - d * 0.08})`} style={{ transformOrigin: "60px 90px" }}>
        {blobs.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={canopy[i % 3]} />
        ))}
        {blobs.slice(0, 4).map(([x, y, r], i) => (
          <ellipse key={`h${i}`} cx={x - r * 0.35} cy={y - r * 0.4} rx={r * 0.45} ry={r * 0.25} fill="#fff" opacity={0.12} />
        ))}
        {bloom && kind !== "cherry" &&
          [[44, 50], [70, 46], [58, 34], [84, 64], [36, 68], [62, 62]].map(([x, y], i) => <SmallBloom key={i} x={x} y={y} r={3} />)}
        {bloom && kind === "cherry" &&
          [[44, 50], [70, 46], [58, 34], [84, 64], [36, 68], [62, 62], [50, 60], [76, 54]].map(([x, y], i) => (
            <SmallBloom key={i} x={x} y={y} r={2.6} petal="#fff0f5" center="#ff6f91" />
          ))}
        <FruitSet dr={dr} color={fruit.color} shape={fruit.shape} r={5.2} spots={[[46, 60], [74, 58], [60, 44], [38, 72], [84, 70]]} />
      </g>
      {kind === "cherry" && bloom && d < 0.3 && (
        <g className="gd-petal-fall">
          <ellipse cx="30" cy="96" rx="2" ry="1.2" fill="#ffc1d3" />
          <ellipse cx="92" cy="104" rx="2" ry="1.2" fill="#ffadc6" />
        </g>
      )}
    </g>
  );
}

function Strawberry(dr: Draw) {
  const { d, bloom } = dr;
  const trefoil = (x: number, y: number, a: number, i: number) => (
    <g key={i}>
      <path d={`M60 126 Q ${(60 + x) / 2} ${(126 + y) / 2 - 6} ${x} ${y + d * 8}`} stroke={C.stem} strokeWidth="2" fill="none" strokeLinecap="round" />
      <g transform={`translate(${x} ${y + d * 8}) rotate(${droopAngle(a, d)})`}>
        {[-38, 0, 38].map((r, k) => (
          <g key={k} transform={`rotate(${r})`}>
            <path d={leafPath(13, 6.5)} fill={k === 1 ? C.leafLight : C.leaf} />
            <path d="M0 0 L0 -11" stroke={C.leafDark} strokeWidth="0.7" opacity="0.5" />
          </g>
        ))}
      </g>
    </g>
  );
  return (
    <g>
      {trefoil(34, 104, -40, 0)}
      {trefoil(86, 102, 40, 1)}
      {trefoil(48, 88, -15, 2)}
      {trefoil(74, 86, 15, 3)}
      {trefoil(60, 80, 0, 4)}
      {bloom && [[40, 116], [80, 114], [60, 102]].map(([x, y], i) => <SmallBloom key={i} x={x} y={y + d * 6} r={3.6} />)}
      <FruitSet dr={dr} color="#e53950" shape="berry" r={5.4} unripe="#cfe8b0" spots={[[42, 120], [78, 120], [60, 116], [30, 118], [90, 118]]} />
    </g>
  );
}

function Monstera(dr: Draw) {
  const { d, bloom } = dr;
  const leaf = (angle: number, len: number, i: number) => (
    <g key={i} transform={`translate(60 126) rotate(${droopAngle(angle, d * 0.8)})`}>
      <path d={`M0 0 L0 ${-len * 0.55}`} stroke={C.stem} strokeWidth="2.4" strokeLinecap="round" />
      <g transform={`translate(0 ${-len * 0.55})`}>
        <path d={`M0 6 C ${-len * 0.42} 0, ${-len * 0.45} ${-len * 0.42}, 0 ${-len * 0.5} C ${len * 0.45} ${-len * 0.42}, ${len * 0.42} 0, 0 6 Z`} fill={i % 2 ? "#3f8f52" : "#4ea45d"} />
        {[-0.34, -0.2, -0.06].map((t, k) => (
          <g key={k}>
            <path d={`M0 ${t * len} L${-len * 0.38} ${t * len - len * 0.08}`} stroke="#2f6f3e" strokeWidth="1.8" opacity="0.55" />
            <path d={`M0 ${t * len} L${len * 0.38} ${t * len - len * 0.08}`} stroke="#2f6f3e" strokeWidth="1.8" opacity="0.55" />
          </g>
        ))}
        <path d={`M0 4 L0 ${-len * 0.48}`} stroke="#7fcd84" strokeWidth="1.1" opacity="0.7" />
      </g>
    </g>
  );
  return (
    <g>
      {leaf(-44, 60, 0)}
      {leaf(42, 58, 1)}
      {leaf(-15, 74, 2)}
      {leaf(17, 70, 3)}
      {bloom && (
        <g transform={`translate(${60 + d * 6} ${64 + d * 10})`}>
          <path d="M0 18 C -12 6, -10 -14, 0 -22 C 10 -14, 12 6, 0 18 Z" fill="#f4ecd0" />
          <rect x="-2.6" y="-14" width="5.2" height="20" rx="2.6" fill="#e9d48a" />
        </g>
      )}
      <FruitSet dr={dr} color="#e3c565" shape="oval" r={4.4} unripe="#e8e2c0" spots={[[36, 92], [84, 92], [46, 70], [74, 70], [60, 50]]} />
    </g>
  );
}

function Lotus(dr: Draw) {
  const { d, bloom, gid } = dr;
  const petal = (angle: number, len: number, fill: string, i: number) => (
    <path key={i} d={`M0 0 C ${len * 0.35} ${-len * 0.4}, ${len * 0.22} ${-len * 0.9}, 0 ${-len} C ${-len * 0.22} ${-len * 0.9}, ${-len * 0.35} ${-len * 0.4}, 0 0 Z`} fill={fill} transform={`rotate(${angle})`} />
  );
  return (
    <g>
      <ellipse cx="60" cy="130" rx="46" ry="11" fill={`url(#water-${gid})`} />
      <ellipse cx="60" cy="130" rx="30" ry="6" fill="none" stroke="#bfeaf7" strokeWidth="1" opacity="0.7" className="gd-ripple" />
      <g transform="translate(34 128)">
        <ellipse rx="15" ry="5" fill="#5cae62" />
        <path d="M0 0 L12 -3" stroke="#3f8f52" strokeWidth="1.2" />
      </g>
      <g transform="translate(86 130)">
        <ellipse rx="13" ry="4.5" fill="#6cbf6a" />
        <path d="M0 0 L-10 -3" stroke="#3f8f52" strokeWidth="1.2" />
      </g>
      <path d={`M60 130 C 58 112, ${60 + d * 6} 98, ${60 + d * 10} ${80 + d * 18}`} stroke="#5a9e62" strokeWidth="3" fill="none" strokeLinecap="round" />
      <g transform={`translate(${60 + d * 10} ${80 + d * 18}) rotate(${d * 30})`}>
        {bloom ? (
          <>
            {petal(-62, 20, "#f8bbd0", 0)}
            {petal(62, 20, "#f8bbd0", 1)}
            {petal(-32, 24, "#f48fb1", 2)}
            {petal(32, 24, "#f48fb1", 3)}
            {petal(0, 27, "#f06292", 4)}
            {petal(-14, 22, "#f8a5c2", 5)}
            {petal(14, 22, "#f8a5c2", 6)}
            <circle cy={-6} r={5} fill="#ffd54f" />
          </>
        ) : (
          <path d="M0 0 C 7 -6, 6 -16, 0 -22 C -6 -16, -7 -6, 0 0 Z" fill="#f7a8c4" />
        )}
      </g>
      <FruitSet dr={dr} color="#8bbf6a" shape="round" r={4.6} unripe="#d7e9c2" spots={[[26, 118], [94, 120], [42, 112], [80, 112], [60, 44]]} />
    </g>
  );
}

const SPECIES_DRAW: Record<SpeciesId, (dr: Draw) => React.ReactNode> = {
  sunflower: Sunflower,
  tulip: Tulip,
  lavender: Lavender,
  rose: Rose,
  cactus: Cactus,
  bonsai: Bonsai,
  apple: (dr) => <Tree {...dr} kind="apple" />,
  lemon: (dr) => <Tree {...dr} kind="lemon" />,
  cherry: (dr) => <Tree {...dr} kind="cherry" />,
  strawberry: Strawberry,
  monstera: Monstera,
  lotus: Lotus,
};

const FRUIT_LOOK: Record<SpeciesId, { color: string; shape: "round" | "oval" | "drop" | "berry"; pair?: boolean }> = {
  sunflower: { color: "#6b4a2e", shape: "drop" },
  tulip: { color: "#d9a066", shape: "drop" },
  lavender: { color: "#7e57c2", shape: "oval" },
  rose: { color: "#e8743b", shape: "oval" },
  cactus: { color: "#d6336c", shape: "oval" },
  bonsai: { color: "#8a5a3b", shape: "oval" },
  apple: { color: "#e53935", shape: "round" },
  lemon: { color: "#f2c230", shape: "oval" },
  cherry: { color: "#c2185b", shape: "round", pair: true },
  strawberry: { color: "#e53950", shape: "berry" },
  monstera: { color: "#d9b84f", shape: "oval" },
  lotus: { color: "#7fb45f", shape: "round" },
};

/**
 * A species' fruit on its own, drawn like the fruit on the plant: for the
 * basket, the pick buttons and anywhere fruit is counted.
 */
export function FruitGlyph({ species, size = 20, golden = false, className = "" }: { species: SpeciesId; size?: number; golden?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const look = FRUIT_LOOK[species] ?? FRUIT_LOOK.apple;
  const paint = golden ? `url(#fg-${uid})` : look.color;
  const one = (cx: number, cy: number, r: number) =>
    look.shape === "oval" ? (
      <ellipse cx={cx} cy={cy} rx={r * 0.8} ry={r * 1.05} fill={paint} />
    ) : look.shape === "drop" ? (
      <path d={`M${cx} ${cy - r * 1.2} C ${cx + r} ${cy - r * 0.2}, ${cx + r} ${cy + r}, ${cx} ${cy + r} C ${cx - r} ${cy + r}, ${cx - r} ${cy - r * 0.2}, ${cx} ${cy - r * 1.2} Z`} fill={paint} />
    ) : look.shape === "berry" ? (
      <path d={`M${cx} ${cy + r * 1.15} C ${cx - r * 1.1} ${cy + r * 0.2}, ${cx - r} ${cy - r * 0.9}, ${cx} ${cy - r * 0.7} C ${cx + r} ${cy - r * 0.9}, ${cx + r * 1.1} ${cy + r * 0.2}, ${cx} ${cy + r * 1.15} Z`} fill={paint} />
    ) : (
      <circle cx={cx} cy={cy} r={r} fill={paint} />
    );
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <defs>
        <radialGradient id={`fg-${uid}`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff6c2" />
          <stop offset="55%" stopColor="#ffcf3f" />
          <stop offset="100%" stopColor="#d99a0b" />
        </radialGradient>
      </defs>
      {look.pair ? (
        <>
          <path d="M8 13 C 9 8, 12 5, 15 3.5 M16 14 C 15.5 9, 15 6, 15 3.5" stroke="#5d8a4a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          {one(8, 15.5, 4.2)}
          {one(16, 16.5, 4.2)}
          <ellipse cx={6.6} cy={14} rx={1.1} ry={0.7} fill="#fff" opacity={0.45} />
          <ellipse cx={14.6} cy={15} rx={1.1} ry={0.7} fill="#fff" opacity={0.45} />
        </>
      ) : (
        <>
          <path d="M12 7.5 C 12 5.6, 12.6 4.2, 13.6 3.2" stroke="#6b4a2e" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M13.2 5.2 C 15.2 3.4, 17.8 3.4, 19 4.4 C 17.6 6.2, 15.2 6.6, 13.2 5.2 Z" fill="#5fae5f" />
          {one(12, 14.5, 6)}
          {look.shape === "berry" &&
            [[-2, -0.5], [1.8, 0.5], [0, 3], [-1.6, 3.4], [2.2, 3.2]].map(([a, b], k) => <circle key={k} cx={12 + a} cy={14.5 + b} r={0.55} fill="#fff3b0" opacity={0.9} />)}
          {look.shape !== "berry" && <ellipse cx={9.8} cy={11.8} rx={1.7} ry={1.1} fill="#fff" opacity={0.42} />}
        </>
      )}
    </svg>
  );
}

/** A watering can, for the moment a plant is watered. */
export function WateringCan({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 48" width={size} height={size * 0.75} aria-hidden>
      <path d="M14 18 h26 a4 4 0 0 1 4 4 v16 a6 6 0 0 1 -6 6 h-18 a6 6 0 0 1 -6 -6 z" fill="#4e93c9" />
      <path d="M44 24 L60 12 L62 15 L46 30 Z" fill="#3b7fb5" />
      <circle cx="61" cy="13" r="3" fill="#6fb2e0" />
      <path d="M18 18 C 18 6, 36 6, 36 18" stroke="#3b7fb5" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <rect x="16" y="24" width="26" height="4" rx="2" fill="#6fb2e0" opacity="0.6" />
    </svg>
  );
}
