"use client";

import { GARDEN_LEVELS, type CityGarden } from "@/lib/habits-shared";
import { Avatar } from "../bits";
import { IconTick } from "../icons";
import { Plant } from "../plants";
import { Fence, FriendBench, Lawn, LevelDecor, type CityPhase } from "./decor";

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

/**
 * A plot on the street: a garden, or a free plot. A free plot asks for what
 * the viewer can do with it: sign in, join, save it for a friend, or (once
 * saved) share it again. On an invite's own page it's the plot saved for you.
 */
export type StreetItem =
  | { kind: "garden"; garden: CityGarden; ahead?: number }
  | { kind: "free"; claim: "signin" | "join" | "invite" | null }
  | { kind: "free"; claim: "reserved"; code: string; forYou?: boolean };

/**
 * One plot on the street. A garden: its lawn, fence and gate sign, whatever
 * its level has added, and its plants. A free plot: a lawn waiting, with a
 * sign saying whose it could be.
 */
export function CityLot({ item, phase, onOpen, interactive = true }: { item: StreetItem; phase: CityPhase; onOpen?: () => void; interactive?: boolean }) {
  const garden = item.kind === "garden" ? item.garden : null;
  const level = garden ? garden.level : 1;
  const levelInfo = GARDEN_LEVELS[level - 1];
  const gold = level >= 7;
  const free = item.kind === "free" ? item : null;
  const reserved = free?.claim === "reserved" ? (free as Extract<StreetItem, { claim: "reserved" }>) : null;
  const label = garden
    ? `${garden.me ? "Your garden" : `${garden.name}'s garden`}, ${levelInfo.name}, ${garden.score} points${garden.rank ? `, number ${garden.rank}` : ""}`
    : reserved
      ? reserved.forYou
        ? "A plot saved for you"
        : "A plot saved for a friend. Share the invite again"
      : free?.claim === "invite"
        ? "A free plot. Invite a friend to claim it"
        : free?.claim
          ? "A free plot. Claim it"
          : "A free plot";
  const signTitle = garden ? garden.name : reserved ? (reserved.forYou ? "Reserved for you" : "Saved for a friend") : "Free plot";
  const signLine = garden
    ? garden.showcase
      ? "Showcase"
      : `Level ${level} · ${garden.score} pts`
    : reserved
      ? reserved.forYou
        ? "Claim it"
        : "Waiting for them"
      : free?.claim === "signin"
        ? "Sign in to claim"
        : free?.claim === "join"
          ? "Claim it"
          : free?.claim === "invite"
            ? "Invite a friend"
            : "Waiting";

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={label}
      onClick={interactive ? onOpen : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen?.();
              }
            }
          : undefined
      }
      className={`city-lot group relative shrink-0 outline-none transition-transform duration-300 ${interactive ? "cursor-pointer hover:-translate-y-1.5 focus-visible:-translate-y-1.5" : ""} ${garden?.me || reserved?.forYou ? "city-lot-me" : ""}`}
      data-lot={garden ? garden.id : reserved ? `reserved-${reserved.code}` : free?.claim === "invite" ? "invite" : "free"}
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

        {garden && (garden.friends ?? 0) > 0 && (
          <span className="absolute -bottom-[3%] right-[5%] z-10 w-[22%]" title={`${garden.friends} ${garden.friends === 1 ? "friend" : "friends"} in the city`} data-bench>
            <FriendBench className="h-auto w-full" />
          </span>
        )}

        {/* a free plot's invitation: save it for a friend, or share the one saved */}
        {free?.claim === "invite" && (
          <span className="city-invite absolute left-1/2 top-[52%] z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-bold text-[#1c2624] shadow-xl transition-transform group-hover:scale-105">
            <span className="grid size-6 place-items-center rounded-full bg-sun text-base leading-none text-on-accent">+</span>
            Invite a friend
          </span>
        )}
        {reserved && (
          <>
            {/* a rope round the plot, tied with a bow */}
            <svg className="pointer-events-none absolute inset-x-[6%] bottom-[8%] top-[34%] z-10 h-[58%] w-[88%]" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden>
              <path d="M2 4 Q50 -2 98 4 L98 56 Q50 62 2 56 Z" fill="none" stroke="#f4c95d" strokeWidth="1.6" strokeDasharray="4 3" />
            </svg>
            <span className="city-invite absolute left-1/2 top-[54%] z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-2xl bg-white/95 px-4 py-2.5 text-center shadow-xl">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#b8862b]">{reserved.forYou ? "Yours to claim" : "Reserved"}</span>
              <span className="text-sm font-bold text-[#1c2624]">{reserved.forYou ? "Right next to their garden" : "Share the invite"}</span>
            </span>
          </>
        )}

        {garden && garden.plants.length === 0 && (
          <span className="absolute bottom-[26%] left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-[#1c2624]">Freshly dug</span>
        )}

        {/* the gate sign */}
        <div className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 flex-col items-center">
          <div className={`city-sign flex max-w-[15rem] items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-3 shadow-lg ${gold || reserved ? "city-sign-gold" : ""}`}>
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
              <span className="block truncate text-[13px] font-bold leading-tight text-[#3b2716]">{signTitle}</span>
              <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-[#6b4a2c]">{signLine}</span>
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
