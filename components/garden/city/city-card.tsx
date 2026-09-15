"use client";

import { gardenLevelOf, nextGardenLevel, type SpeciesId } from "@/lib/habits-shared";
import { useClock } from "../fx";
import { Plant } from "../plants";
import { phaseOf } from "../scene";
import { Balloon, hillsTile, skylineTile, type CityPhase } from "./decor";
import { IconSun } from "./lot";

const BANNER_SKY: Record<CityPhase, string> = {
  night: "linear-gradient(180deg, #081229 0%, #1d3358 100%)",
  dawn: "linear-gradient(180deg, #7489d8 0%, #f2b8a8 100%)",
  day: "linear-gradient(180deg, #45a9ec 0%, #b9e5f8 100%)",
  golden: "linear-gradient(180deg, #ea7d5c 0%, #ffd494 100%)",
  dusk: "linear-gradient(180deg, #2a2a6c 0%, #d68474 100%)",
};

/** Three little gardens under the skyline: the city, in a glance. */
function Skyline({ phase, plants }: { phase: CityPhase; plants: SpeciesId[] }) {
  const dark = phase === "night" || phase === "dusk";
  return (
    <div className="pointer-events-none absolute inset-0" style={{ background: BANNER_SKY[phase] }} aria-hidden>
      <div className="gd-balloon absolute left-[62%] top-[12%] h-10 w-7">
        <Balloon colors={["#ff6b6b", "#ffd166"]} />
      </div>
      <div className="gd-balloon absolute left-[80%] top-[26%] h-7 w-5" style={{ animationDelay: "-6s" }}>
        <Balloon colors={["#0c9384", "#8fe3d3"]} />
      </div>
      <div className="absolute inset-x-0 bottom-[30%] h-[46%]" style={{ backgroundImage: skylineTile(phase), backgroundRepeat: "repeat-x", backgroundSize: "auto 100%", backgroundPositionY: "bottom" }} />
      <div className="absolute inset-x-0 bottom-[16%] h-[30%]" style={{ backgroundImage: hillsTile(phase), backgroundRepeat: "repeat-x", backgroundSize: "600px 100%" }} />
      <div className="absolute inset-x-0 bottom-0 h-[18%]" style={{ background: dark ? "#2a4a3c" : "#6fb863" }} />
      <div className="absolute bottom-[8%] right-[4%] flex items-end gap-2 sm:gap-4">
        {plants.map((s, i) => (
          <span key={i} className="relative">
            <Plant species={s} stage={i === 1 ? 5 : 4} size={i === 1 ? 56 : 44} phase={i} fit="snug" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** On Habits: your garden's standing, and the way into the city. */
export function CityCard({ score, onOpen }: { score: number; onOpen: () => void }) {
  const phase = phaseOf(useClock()) as CityPhase;
  const level = gardenLevelOf(score);
  const next = nextGardenLevel(score);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block h-44 w-full overflow-hidden rounded-[1.5rem] border border-line/60 text-left shadow-lg shadow-ink/10 outline-none transition-transform duration-300 hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-sun/40 sm:h-40"
      data-city-card
    >
      <Skyline phase={phase} plants={["tulip", "cherry", "sunflower"]} />
      <span className="absolute inset-y-0 left-0 w-[70%] bg-gradient-to-r from-black/45 via-black/20 to-transparent" aria-hidden />
      <span className="relative flex h-full flex-col justify-between p-4 sm:p-5">
        <span>
          <span className="font-display block text-2xl leading-none text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.35)]">Kairo City</span>
          <span className="mt-1.5 block max-w-[16rem] text-sm font-medium text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]">
            Your garden is a Level {level.level} {level.name}
            {next ? `, ${next.min - score} points from ${next.name}` : ""}.
          </span>
        </span>
        <span className="gd-hud flex w-max items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition-transform group-hover:translate-x-0.5">
          Walk into the city <span aria-hidden>→</span>
        </span>
      </span>
    </button>
  );
}

/** On Today, for someone signed out: the city is open to walk around before any sign-in. */
export function GuestCityCard({ onOpen }: { onOpen: () => void }) {
  const phase = phaseOf(useClock()) as CityPhase;
  return (
    <section className="anim-rise mb-5" aria-label="Kairo City">
      <button
        type="button"
        onClick={onOpen}
        className="group relative block h-48 w-full overflow-hidden rounded-2xl border border-line/60 text-left shadow-lg shadow-ink/10 outline-none transition-transform duration-300 hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-sun/40"
        data-guest-city
      >
        <Skyline phase={phase} plants={["lavender", "apple", "tulip"]} />
        <span className="absolute inset-y-0 left-0 w-[78%] bg-gradient-to-r from-black/50 via-black/25 to-transparent" aria-hidden />
        <span className="relative flex h-full flex-col justify-between p-4">
          <span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/85">
              <IconSun size={13} /> New
            </span>
            <span className="font-display mt-1 block text-2xl leading-none text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.35)]">Kairo City</span>
            <span className="mt-1.5 block max-w-[17rem] text-sm font-medium text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]">
              A city of gardens, each one grown by someone&apos;s real habits. Take a walk.
            </span>
          </span>
          <span className="flex w-max items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-[#1c2624] shadow-lg transition-transform group-hover:translate-x-0.5">
            Explore the city <span aria-hidden>→</span>
          </span>
        </span>
      </button>
    </section>
  );
}

