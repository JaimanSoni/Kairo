"use client";

import { GARDEN_LEVELS, type CityGarden } from "@/lib/habits-shared";
import { Avatar } from "../bits";
import { IconTick } from "../icons";
import { Plant } from "../plants";
import { Fence, Lawn, LevelDecor, type CityPhase } from "./decor";

/** Where a garden's plants stand on its plot, strongest first: the front row, then the back. */
const SPOTS: { x: number; bottom: number; size: number; z: number }[] = [
  { x: 27, bottom: 9, size: 30, z: 6 },
  { x: 73, bottom: 9, size: 30, z: 6 },
  { x: 50, bottom: 22, size: 26, z: 5 },
  { x: 11, bottom: 24, size: 22, z: 4 },
  { x: 89, bottom: 24, size: 22, z: 4 },
  { x: 32, bottom: 40, size: 20, z: 3 },
  { x: 68, bottom: 40, size: 20, z: 3 },
  { x: 50, bottom: 46, size: 17, z: 2 },
];

/** A sunshine: the cheer. */
export function IconSun({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="4.2" fill="#ffc83d" />
      <g stroke="#ffb020" strokeWidth="1.8" strokeLinecap="round">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <path key={i} d={`M${10 + Math.cos(a) * 6.6} ${10 + Math.sin(a) * 6.6} L${10 + Math.cos(a) * 8.8} ${10 + Math.sin(a) * 8.8}`} />;
        })}
      </g>
    </svg>
  );
}

export type StreetItem = { kind: "garden"; garden: CityGarden; ahead?: number } | { kind: "free"; claim: "signin" | "join" | null };

/**
 * One plot on the street. A garden: its lawn, fence and gate sign, whatever
 * its level has added, and its plants. A free plot: a lawn waiting, with a
 * sign saying whose it could be.
 */
export function CityLot({ item, phase, onOpen }: { item: StreetItem; phase: CityPhase; onOpen: () => void }) {
  const garden = item.kind === "garden" ? item.garden : null;
  const level = garden ? garden.level : 1;
  const levelInfo = GARDEN_LEVELS[level - 1];
  const gold = level >= 7;
  const label = garden
    ? `${garden.me ? "Your garden" : `${garden.name}'s garden`}, ${levelInfo.name}, ${garden.score} points${garden.rank ? `, number ${garden.rank}` : ""}`
    : item.kind === "free" && item.claim
      ? "A free plot. Claim it"
      : "A free plot";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`city-lot group relative shrink-0 cursor-pointer outline-none transition-transform duration-300 hover:-translate-y-1.5 focus-visible:-translate-y-1.5 ${garden?.me ? "city-lot-me" : ""}`}
      data-lot={garden ? garden.id : "free"}
      data-me={garden?.me || undefined}
      data-level={garden ? level : undefined}
    >
      {garden?.me && (
        <span className="city-you absolute -top-9 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-sun px-3 py-1 text-xs font-bold text-on-accent shadow-lg">
          {garden.joined ? "Your garden" : "Your plot · private"}
        </span>
      )}
      {item.kind === "garden" && item.ahead ? (
        <span className="absolute -top-8 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          {item.ahead} points ahead of you
        </span>
      ) : null}

      <div className={`relative h-full w-full ${garden ? "" : "opacity-90"}`}>
        {/* the plot's own shadow on the pavement */}
        <span className="absolute inset-x-[4%] -bottom-2 h-5 rounded-[50%] bg-black/20 blur-md" aria-hidden />
        <Lawn phase={phase} gold={gold} />
        <Fence phase={phase} gold={gold} />
        {garden && <LevelDecor level={level} phase={phase} />}

        {garden?.plants.map((p, i) => {
          const spot = SPOTS[i];
          if (!spot) return null;
          return (
            <span
              key={i}
              className="absolute -translate-x-1/2"
              style={{ left: `${spot.x}%`, bottom: `${spot.bottom}%`, width: `${spot.size}%`, zIndex: spot.z }}
              data-city-plant
            >
              {p.doneToday && <span className="gd-glow absolute -inset-x-2 bottom-0 aspect-square rounded-full" aria-hidden />}
              <span className="relative block">
                <Plant species={p.species} stage={p.stage} size={120} phase={i * 0.6} fit="snug" className="h-auto w-full" />
              </span>
              {p.doneToday && (
                <span className="absolute right-0 top-[8%] grid size-4 place-items-center rounded-full bg-moss text-white ring-2 ring-white/80">
                  <IconTick size={8} />
                </span>
              )}
            </span>
          );
        })}

        {garden && garden.plants.length === 0 && (
          <span className="absolute bottom-[26%] left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-[#1c2624]">Freshly dug</span>
        )}

        {/* the gate sign */}
        <div className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 flex-col items-center">
          <div className={`city-sign flex max-w-[15rem] items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-3 shadow-lg ${gold ? "city-sign-gold" : ""}`}>
            {garden ? (
              garden.showcase ? (
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/90">
                  <IconSun size={16} />
                </span>
              ) : (
                <Avatar animal={garden.animal} size={28} className="ring-2 ring-white/70" />
              )
            ) : (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/70 text-sm font-bold text-[#5a3d22]">+</span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold leading-tight text-[#3b2716]">{garden ? garden.name : "Free plot"}</span>
              <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-[#6b4a2c]">
                {garden ? (garden.showcase ? "Showcase" : `Level ${level} · ${garden.score} pts`) : item.kind === "free" && item.claim === "signin" ? "Sign in to claim" : item.kind === "free" && item.claim === "join" ? "Claim it" : "Waiting"}
              </span>
            </span>
          </div>
          <span className="h-3 w-1 bg-[#6b4a2c]" aria-hidden />
        </div>

        {garden?.rank ? (
          <span className={`absolute left-[3%] top-[21%] z-20 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums shadow ${garden.rank <= 3 ? "bg-[#ffd166] text-[#5c4300]" : "bg-white/90 text-[#1c2624]"}`}>#{garden.rank}</span>
        ) : null}
        {garden && garden.cheers.total > 0 ? (
          <span className="absolute right-[3%] top-[21%] z-20 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#1c2624] shadow" title="Cheers">
            <IconSun size={12} /> {garden.cheers.total}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The showcase at the city gate: what a legendary garden looks like. Clearly labelled, and nobody's. */
export const SHOWCASE: CityGarden = {
  id: "showcase",
  name: "Kairo Showcase",
  animal: "3",
  me: false,
  joined: true,
  showcase: true,
  score: 470,
  level: 7,
  rank: null,
  plants: [
    { species: "cherry", color: "rose", stage: 5, strength: 96, streak: 0, doneToday: true, name: "Read" },
    { species: "apple", color: "moss", stage: 5, strength: 95, streak: 0, doneToday: true, name: "Go for a walk" },
    { species: "sunflower", color: "amber", stage: 5, strength: 94, streak: 0, doneToday: true, name: "Meditate" },
    { species: "lavender", color: "lilac", stage: 5, strength: 93, streak: 0, doneToday: true, name: "Stretch" },
    { species: "lotus", color: "sky", stage: 5, strength: 92, streak: 0, doneToday: true, name: "Drink water" },
    { species: "rose", color: "rose", stage: 5, strength: 90, streak: 0, doneToday: false, name: "Three good things" },
    { species: "bonsai", color: "sun", stage: 5, strength: 88, streak: 0, doneToday: false, name: "Practise a language" },
    { species: "lemon", color: "amber", stage: 5, strength: 86, streak: 0, doneToday: false, name: "Plan tomorrow" },
  ],
  habits: 8,
  doneToday: 5,
  dueToday: 8,
  cheers: { today: 0, total: 0, mine: false, from: [] },
};
