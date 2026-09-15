"use client";

/**
 * Kairo City's scenery, drawn in code: the lawn a garden sits on, its fence,
 * what each garden level adds to it, and the street around it (lamp posts,
 * trees, balloons, the skyline).
 */

export type CityPhase = "night" | "dawn" | "day" | "golden" | "dusk";

/** The lawn a garden stands on, with the soil edge that makes it a plot. */
export function Lawn({ phase, gold = false }: { phase: CityPhase; gold?: boolean }) {
  const night = phase === "night" || phase === "dusk";
  const top = night ? "#3d6f55" : phase === "golden" ? "#8fbf63" : "#7cc46c";
  const bottom = night ? "#2c5443" : phase === "golden" ? "#6fa04c" : "#5aa651";
  return (
    <svg className="absolute inset-x-0 bottom-0 h-[78%] w-full" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`lawn-${phase}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
      </defs>
      {/* the soil edge, then the lawn over it */}
      <path d="M8 40 Q150 18 292 40 L300 190 Q150 204 0 190 Z" fill={night ? "#3a2a1e" : "#8a5a3b"} />
      <path d="M8 34 Q150 12 292 34 L298 180 Q150 194 2 180 Z" fill={`url(#lawn-${phase})`} />
      <path d="M8 34 Q150 12 292 34" fill="none" stroke={gold ? "#f4c95d" : night ? "#5e8f74" : "#a6dc8c"} strokeWidth={gold ? 3 : 2} opacity="0.8" />
      {Array.from({ length: 18 }, (_, i) => (
        <path key={i} d={`M${14 + ((i * 53) % 270)} ${60 + ((i * 37) % 110)} l-2 -6 M${16 + ((i * 53) % 270)} ${60 + ((i * 37) % 110)} l1 -7 M${18 + ((i * 53) % 270)} ${60 + ((i * 37) % 110)} l3 -5`} stroke={night ? "#4f8a6a" : "#3f8f4a"} strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
      ))}
    </svg>
  );
}

/** A picket fence along the back of a plot. Gold, for a legendary garden. */
export function Fence({ phase, gold = false }: { phase: CityPhase; gold?: boolean }) {
  const night = phase === "night" || phase === "dusk";
  const wood = gold ? "#f1c35a" : night ? "#9b8f7e" : "#fbf6ea";
  const shade = gold ? "#c8952c" : night ? "#6d6457" : "#d9cfbb";
  return (
    <svg className="absolute inset-x-[4%] top-[18%] h-[16%] w-[92%]" viewBox="0 0 280 40" preserveAspectRatio="none" aria-hidden>
      <rect x="0" y="12" width="280" height="4" rx="1" fill={shade} />
      <rect x="0" y="26" width="280" height="4" rx="1" fill={shade} />
      {Array.from({ length: 21 }, (_, i) => (
        <path key={i} d={`M${2 + i * 13.3} 40 L${2 + i * 13.3} 6 L${6.5 + i * 13.3} 0 L${11 + i * 13.3} 6 L${11 + i * 13.3} 40 Z`} fill={wood} stroke={shade} strokeWidth="0.8" />
      ))}
    </svg>
  );
}

/** Level 2: flowers along the fence. */
export function FlowerBeds() {
  const colors = ["#ff8fab", "#ffd166", "#b28dff", "#ff6b6b", "#ffffff", "#ffa94d"];
  return (
    <>
      {[4, 71].map((left) => (
        <svg key={left} className="absolute top-[30%] h-[14%] w-[25%]" style={{ left: `${left}%` }} viewBox="0 0 80 30" aria-hidden>
          <ellipse cx="40" cy="24" rx="40" ry="6" fill="#6b4429" opacity="0.55" />
          {Array.from({ length: 9 }, (_, i) => (
            <g key={i} transform={`translate(${6 + i * 8.5} ${14 - (i % 2) * 4})`}>
              <path d="M0 10 L0 0" stroke="#3f8f4a" strokeWidth="1.2" />
              <circle cx="0" cy="0" r="3.4" fill={colors[i % colors.length]} />
              <circle cx="0" cy="0" r="1.2" fill="#ffe08a" />
            </g>
          ))}
        </svg>
      ))}
    </>
  );
}

/** Level 3: a stone path from the front of the plot to the back. */
export function StonePath({ phase }: { phase: CityPhase }) {
  const stone = phase === "night" || phase === "dusk" ? "#8c8f94" : "#d8d2c4";
  return (
    <svg className="absolute bottom-[4%] left-[40%] h-[62%] w-[20%]" viewBox="0 0 60 140" aria-hidden>
      {[
        [30, 130, 13, 6],
        [24, 108, 11, 5.5],
        [34, 88, 10, 5],
        [26, 69, 9, 4.5],
        [33, 52, 8, 4],
        [28, 37, 7, 3.5],
      ].map(([cx, cy, rx, ry], i) => (
        <g key={i}>
          <ellipse cx={cx} cy={cy + 1.5} rx={rx} ry={ry} fill="#000" opacity="0.12" />
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={stone} />
        </g>
      ))}
    </svg>
  );
}

/** Level 4: a pond with lily pads, and light on the water. */
export function Pond() {
  return (
    <svg className="absolute bottom-[8%] left-[3%] h-[20%] w-[30%]" viewBox="0 0 100 40" aria-hidden>
      <defs>
        <radialGradient id="pond" cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#bfe9ff" />
          <stop offset="60%" stopColor="#5fb2e0" />
          <stop offset="100%" stopColor="#3a86b7" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="22" rx="48" ry="16" fill="#8a6a4a" opacity="0.5" />
      <ellipse cx="50" cy="21" rx="45" ry="14" fill="url(#pond)" />
      <ellipse className="gd-shimmer" cx="38" cy="16" rx="12" ry="2" fill="#fff" opacity="0.6" />
      <g fill="#4caf50">
        <path d="M68 24 a7 4 0 1 0 0.1 0 Z M68 24 l6 -2" />
        <path d="M30 27 a6 3.5 0 1 0 0.1 0 Z" />
      </g>
      <circle cx="70" cy="22" r="2.2" fill="#ff9ec4" />
    </svg>
  );
}

/** Level 5: a rose arch over the back of the path. */
export function RoseArch() {
  return (
    <svg className="absolute left-[36%] top-[8%] h-[34%] w-[28%]" viewBox="0 0 80 90" aria-hidden>
      <path d="M12 90 L12 40 Q40 -4 68 40 L68 90" fill="none" stroke="#7a5230" strokeWidth="6" strokeLinecap="round" />
      <path d="M12 90 L12 40 Q40 -4 68 40 L68 90" fill="none" stroke="#4f9a5a" strokeWidth="3" strokeDasharray="6 5" />
      {[
        [14, 50],
        [18, 30],
        [30, 16],
        [40, 13],
        [52, 17],
        [63, 30],
        [67, 52],
        [12, 70],
        [68, 72],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4.2" fill={i % 2 ? "#ff5d8f" : "#ff8fab"} />
          <circle cx={x} cy={y} r="1.6" fill="#c9184a" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}

/** Level 6: a fountain, running. */
export function Fountain() {
  return (
    <svg className="absolute bottom-[8%] right-[4%] h-[34%] w-[24%]" viewBox="0 0 70 80" aria-hidden>
      <ellipse cx="35" cy="72" rx="32" ry="7" fill="#9aa3ab" />
      <ellipse cx="35" cy="69" rx="28" ry="5.5" fill="#6fc3ec" />
      <rect x="31" y="38" width="8" height="30" rx="2" fill="#b9c1c8" />
      <ellipse cx="35" cy="40" rx="15" ry="4" fill="#9aa3ab" />
      <ellipse cx="35" cy="38.5" rx="12" ry="2.8" fill="#8fd4f3" />
      <g className="gd-spray" fill="none" stroke="#bfe9ff" strokeWidth="1.8" strokeLinecap="round">
        <path d="M35 36 Q28 14 20 38" />
        <path d="M35 36 Q42 14 50 38" />
        <path d="M35 36 L35 12" />
        <path d="M33 66 Q24 56 16 68" />
        <path d="M37 66 Q46 56 54 68" />
      </g>
      <circle className="gd-drip" cx="35" cy="12" r="2" fill="#dff4ff" />
    </svg>
  );
}

/** Level 7: golden lanterns at the front corners, lit. */
export function Lanterns() {
  return (
    <>
      {["left-[1%]", "right-[1%]"].map((side) => (
        <svg key={side} className={`absolute bottom-[10%] h-[42%] w-[10%] ${side}`} viewBox="0 0 24 90" aria-hidden>
          <circle className="gd-lantern" cx="12" cy="14" r="14" fill="#ffd56b" opacity="0.35" />
          <rect x="10.5" y="20" width="3" height="70" fill="#8a6a2a" />
          <path d="M5 8 L19 8 L17 22 L7 22 Z" fill="#f4c95d" stroke="#b8862b" strokeWidth="1" />
          <rect x="8" y="11" width="8" height="8" fill="#fff3b0" />
          <path d="M4 8 L12 2 L20 8 Z" fill="#b8862b" />
        </svg>
      ))}
    </>
  );
}

/**
 * Everything a level has added to a plot, up to and including that level.
 * Where plants stand close together (the head of the Habits page), only what
 * keeps to the edges: the flower beds and the lanterns.
 */
export function LevelDecor({ level, phase, edges = false }: { level: number; phase: CityPhase; edges?: boolean }) {
  return (
    <>
      {level >= 3 && !edges && <StonePath phase={phase} />}
      {level >= 2 && <FlowerBeds />}
      {level >= 4 && !edges && <Pond />}
      {level >= 5 && !edges && <RoseArch />}
      {level >= 6 && !edges && <Fountain />}
      {level >= 7 && <Lanterns />}
    </>
  );
}

/** A street lamp, lit after dark. */
export function LampPost({ lit }: { lit: boolean }) {
  return (
    <svg className="h-full w-full" viewBox="0 0 40 160" aria-hidden>
      {lit && <circle className="gd-lantern" cx="20" cy="22" r="26" fill="#ffe7a0" opacity="0.35" />}
      <rect x="18" y="26" width="4" height="130" rx="1.5" fill="#2f3a44" />
      <rect x="12" y="150" width="16" height="10" rx="2" fill="#2f3a44" />
      <path d="M8 22 L32 22 L28 34 L12 34 Z" fill={lit ? "#fff1bf" : "#cfd8dc"} stroke="#2f3a44" strokeWidth="2" />
      <path d="M10 22 Q20 8 30 22 Z" fill="#2f3a44" />
    </svg>
  );
}

/** A tree on the pavement between plots. */
export function StreetTree({ phase, variant = 0 }: { phase: CityPhase; variant?: number }) {
  const night = phase === "night" || phase === "dusk";
  const leaf = night ? ["#2f5c48", "#3b6d55"] : phase === "golden" ? ["#7fa850", "#96bb5e"] : ["#4f9a5e", "#68b36f"];
  return (
    <svg className="h-full w-full" viewBox="0 0 60 120" aria-hidden>
      <rect x="27" y="62" width="6" height="56" rx="2" fill={night ? "#4a3a2c" : "#7a5230"} />
      <circle cx="30" cy={variant ? 44 : 40} r="24" fill={leaf[0]} />
      <circle cx={variant ? 18 : 20} cy="50" r="15" fill={leaf[1]} />
      <circle cx={variant ? 42 : 41} cy="52" r="14" fill={leaf[1]} />
      <ellipse cx="30" cy="118" rx="14" ry="3" fill="#000" opacity="0.15" />
    </svg>
  );
}

/** A hot-air balloon, drifting over the city. */
export function Balloon({ colors }: { colors: [string, string] }) {
  return (
    <svg className="h-full w-full" viewBox="0 0 60 84" aria-hidden>
      <path d="M30 2 C 8 2, 2 22, 8 36 C 14 48, 24 54, 26 60 L34 60 C 36 54, 46 48, 52 36 C 58 22, 52 2, 30 2 Z" fill={colors[0]} />
      <path d="M30 2 C 22 6, 18 24, 22 40 C 24 50, 26 56, 27 60 L33 60 C 34 56, 36 50, 38 40 C 42 24, 38 6, 30 2 Z" fill={colors[1]} />
      <path d="M26 60 L24 70 M34 60 L36 70" stroke="#6b4429" strokeWidth="1.2" />
      <rect x="23" y="70" width="14" height="10" rx="2" fill="#8a5a3b" />
    </svg>
  );
}

/** The skyline behind the gardens, as a repeating tile: lit windows after dark. */
export function skylineTile(phase: CityPhase): string {
  const night = phase === "night" || phase === "dusk";
  const far = { night: "#1b2a45", dusk: "#3d3b6b", dawn: "#a197c9", day: "#9ec3dd", golden: "#d49a85" }[phase];
  const near = { night: "#223556", dusk: "#4a4679", dawn: "#8a82b8", day: "#86b1cf", golden: "#c4866f" }[phase];
  const win = night ? "#ffd97a" : "rgba(255,255,255,0.55)";
  const buildings = [
    [0, 70, 38, far],
    [34, 40, 30, near],
    [62, 86, 26, far],
    [86, 56, 40, near],
    [124, 30, 22, far],
    [144, 64, 34, near],
    [176, 96, 28, far],
    [202, 48, 36, near],
    [236, 74, 30, far],
    [264, 36, 36, near],
  ] as const;
  let svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='140' viewBox='0 0 300 140'>`;
  for (const [x, h, w, c] of buildings) {
    svg += `<rect x='${x}' y='${140 - h - 10}' width='${w}' height='${h + 10}' fill='${c}'/>`;
    for (let row = 0; row < Math.floor(h / 14); row++) {
      for (let col = 0; col < Math.floor(w / 10); col++) {
        // not every window: a lit city is a scatter, not a grid
        if ((x + row * 7 + col * 3) % (night ? 3 : 4) === 0) svg += `<rect x='${x + 4 + col * 10}' y='${140 - h + 4 + row * 14}' width='4' height='6' fill='${win}' opacity='${night ? 0.9 : 0.5}'/>`;
      }
    }
  }
  // a tower with a light on top, for a landmark
  svg += `<rect x='112' y='14' width='8' height='126' fill='${near}'/><circle cx='116' cy='12' r='3' fill='${night ? "#ff6b6b" : "#ffffff"}'/>`;
  svg += `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Rolling hills as a repeating tile, in front of the skyline. */
export function hillsTile(phase: CityPhase): string {
  const c = { night: ["#1d3a3c", "#244a45"], dusk: ["#4f6e6a", "#46655a"], dawn: ["#8cbf8a", "#74b073"], day: ["#9fd48c", "#7fc475"], golden: ["#b8c77a", "#94b765"] }[phase];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='80' viewBox='0 0 600 80' preserveAspectRatio='none'><path d='M0 40 C 80 10, 160 14, 240 34 C 320 54, 420 12, 520 28 C 560 34, 580 36, 600 40 L600 80 L0 80 Z' fill='${c[0]}'/><path d='M0 60 C 100 44, 200 50, 300 58 C 400 66, 500 46, 600 60 L600 80 L0 80 Z' fill='${c[1]}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** A bench for two, on a plot whose gardener brought a friend into the city (or was brought). */
export function FriendBench({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 44" aria-hidden>
      <ellipse cx="40" cy="42" rx="34" ry="3" fill="#000" opacity="0.15" />
      <rect x="10" y="10" width="60" height="6" rx="2" fill="#b5793f" />
      <rect x="10" y="18" width="60" height="5" rx="2" fill="#c98a4b" />
      <rect x="6" y="25" width="68" height="6" rx="2" fill="#a86b35" />
      <rect x="12" y="31" width="4" height="11" rx="1" fill="#3b3f45" />
      <rect x="64" y="31" width="4" height="11" rx="1" fill="#3b3f45" />
      <rect x="12" y="8" width="4" height="18" rx="1" fill="#3b3f45" />
      <rect x="64" y="8" width="4" height="18" rx="1" fill="#3b3f45" />
      <path d="M36 2 C 36 -1, 40 -1, 40 2 C 40 -1, 44 -1, 44 2 C 44 5, 40 7, 40 8 C 40 7, 36 5, 36 2 Z" fill="#ff6b8b" />
    </svg>
  );
}
