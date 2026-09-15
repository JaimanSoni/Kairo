"use client";

import { useSyncExternalStore } from "react";
import type { CityGarden, CityPlant, HabitColor, SpeciesId } from "@/lib/habits-shared";
import { Balloon, hillsTile, LampPost, skylineTile } from "../garden/city/decor";
import { CityLot } from "../garden/city/lot";

const noop = () => () => {};

const plant = (species: SpeciesId, color: HabitColor, stage: number, doneToday: boolean): CityPlant => ({ species, color, stage, strength: 70, streak: 20, doneToday, name: null });

/** Two illustrated gardens for the home page's street. Drawn to show the idea, and labelled as such. */
const GARDENS: CityGarden[] = [
  {
    id: "home-a",
    name: "Maya",
    animal: "5",
    me: false,
    joined: true,
    score: 312,
    level: 5,
    rank: 12,
    plants: [plant("cherry", "rose", 5, true), plant("apple", "moss", 5, true), plant("lavender", "lilac", 4, true), plant("sunflower", "amber", 4, false), plant("tulip", "rose", 3, true)],
    habits: 5,
    doneToday: 4,
    dueToday: 5,
    cheers: { today: 3, total: 41, mine: false, from: [] },
    friends: 1,
  },
  {
    id: "home-b",
    name: "You",
    animal: "2",
    me: true,
    joined: true,
    score: 206,
    level: 4,
    rank: 18,
    plants: [plant("bonsai", "sun", 5, true), plant("sunflower", "amber", 4, true), plant("lotus", "sky", 3, false), plant("monstera", "moss", 3, true)],
    habits: 4,
    doneToday: 3,
    dueToday: 4,
    cheers: { today: 1, total: 9, mine: false, from: [] },
    friends: 1,
  },
];

/**
 * Kairo City in a band across the home page, at night: a friend's garden,
 * yours, and the plot beside it waiting for someone you'll invite.
 */
export function CityBand() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return (
    <div className="city-root relative h-[min(78vh,640px)] min-h-[520px] overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,#060e22_0%,#122445_50%,#25406a_100%)] shadow-2xl shadow-ink/20" data-city-band>
      {Array.from({ length: 50 }, (_, i) => (
        <span key={i} className="gd-star absolute rounded-full bg-white" style={{ left: `${(i * 53) % 100}%`, top: `${(i * 29) % 40}%`, width: i % 7 ? 2 : 3, height: i % 7 ? 2 : 3, animationDelay: `${(i % 9) * 0.35}s` }} aria-hidden />
      ))}
      <div className="absolute right-[10%] top-[9%] size-14 rounded-full bg-[#f4f1de] shadow-[0_0_60px_18px_rgba(244,241,222,0.3)]" aria-hidden />
      <div className="gd-balloon absolute left-[16%] top-[18%] h-12 w-8" aria-hidden>
        <Balloon colors={["#ff6b6b", "#ffd166"]} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--road)+var(--lot-h)*0.42)] h-[min(34vh,280px)]" style={{ backgroundImage: skylineTile("night"), backgroundRepeat: "repeat-x", backgroundSize: "auto 100%", backgroundPositionY: "bottom" }} aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--road)+var(--lot-h)*0.2)] h-[min(18vh,140px)]" style={{ backgroundImage: hillsTile("night"), backgroundRepeat: "repeat-x", backgroundSize: "900px 100%" }} aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(var(--road)+var(--lot-h)*0.3)] bg-[#2a4a3c]" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[var(--road)]" aria-hidden>
        <div className="absolute inset-x-0 top-0 h-[34%] bg-[#d9d4c7]" />
        <div className="absolute inset-x-0 bottom-0 top-[34%] bg-[#2b2f36]">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2" style={{ backgroundImage: "repeating-linear-gradient(90deg, #f4d35e 0 36px, transparent 36px 72px)" }} />
        </div>
      </div>
      {mounted && (
        <div className="absolute inset-x-0 bottom-[calc(var(--road)*0.62)] flex items-end justify-center gap-2 overflow-hidden px-4 sm:gap-4">
          <div className="hidden lg:block">
            <CityLot item={{ kind: "garden", garden: GARDENS[0] }} phase="night" interactive={false} />
          </div>
          <div className="hidden h-[calc(var(--lot-h)*0.62)] w-10 items-end lg:flex" aria-hidden>
            <LampPost lit />
          </div>
          <CityLot item={{ kind: "garden", garden: GARDENS[1] }} phase="night" interactive={false} />
          <div className="hidden h-[calc(var(--lot-h)*0.62)] w-10 items-end sm:flex" aria-hidden>
            <LampPost lit />
          </div>
          <div className="hidden sm:block">
            <CityLot item={{ kind: "free", claim: "invite" }} phase="night" interactive={false} />
          </div>
        </div>
      )}
      <p className="absolute bottom-2 right-4 text-[10px] font-medium text-white/40">Illustration</p>
    </div>
  );
}
