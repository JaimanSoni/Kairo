"use client";

import { useState, useSyncExternalStore } from "react";
import type { SpeciesId } from "@/lib/habits-shared";
import { Burst, Moment, plink } from "../garden/fx";
import { IconFlame, IconTick } from "../garden/icons";
import { Plant } from "../garden/plants";
import { GardenHud } from "../garden/plot";
import { GardenScene } from "../garden/scene";

const noop = () => () => {};

const HABITS: { name: string; species: SpeciesId; stage: number; streak: number; done: boolean }[] = [
  { name: "Read", species: "apple", stage: 5, streak: 41, done: true },
  { name: "Walk", species: "sunflower", stage: 4, streak: 12, done: false },
  { name: "Breathe", species: "bonsai", stage: 5, streak: 66, done: true },
  { name: "Water", species: "lotus", stage: 3, streak: 5, done: false },
  { name: "Stretch", species: "lavender", stage: 4, streak: 19, done: false },
];

/**
 * The garden on the home page, to play with: tap the plants still waiting and
 * watch the day fill up, then the sky clear for a rainbow. Nothing is saved;
 * it's the feeling, before the sign-in.
 */
export function HeroGarden() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [done, setDone] = useState(() => HABITS.map((h) => h.done));
  const [pops, setPops] = useState<number[]>(() => HABITS.map(() => 0));
  const [celebrate, setCelebrate] = useState(0);
  const count = done.filter(Boolean).length;
  const all = count === HABITS.length;

  if (!mounted) return <div className="aspect-[16/10] w-full animate-pulse rounded-[1.75rem] bg-paper-deep sm:aspect-[16/8]" aria-hidden />;

  const toggle = (i: number) => {
    const next = done.map((d, j) => (j === i ? !d : d));
    setDone(next);
    if (next[i]) {
      plink(false);
      setPops((p) => p.map((n, j) => (j === i ? n + 1 : n)));
      if (next.every(Boolean)) {
        plink(true);
        setCelebrate((n) => n + 1);
      }
    }
  };

  return (
    <div className="relative" data-hero-garden>
      <GardenScene weather={all ? "clear" : count > 2 ? "partly" : "cloudy"} thriving={count + 1} allDone={all} celebrate={celebrate} decorLevel={all ? 5 : 3} hud={<GardenHud done={count} total={HABITS.length} />}>
        <div className="relative flex items-end justify-center gap-1 px-2 pb-7 pt-3 sm:gap-6">
          {HABITS.map((h, i) => (
            <button
              key={h.name}
              type="button"
              onClick={() => toggle(i)}
              aria-pressed={done[i]}
              aria-label={`${done[i] ? "Unmark" : "Mark"} ${h.name} done`}
              className="group relative flex w-[19%] max-w-[7.5rem] flex-col items-center outline-none"
            >
              {done[i] && <span className="gd-glow pointer-events-none absolute -inset-x-2 top-0 aspect-square rounded-full" aria-hidden />}
              <span className={`relative block w-full transition-transform duration-200 group-hover:-translate-y-1 group-active:scale-95 ${pops[i] ? "gd-perk" : ""}`} key={pops[i]}>
                <Plant species={h.species} stage={h.stage} size={120} phase={i * 0.8} fit="snug" className="h-auto w-full" />
              </span>
              <span
                className={`absolute right-0 top-1 grid size-6 place-items-center rounded-full shadow-md ring-2 ring-white/80 transition-colors sm:size-7 ${done[i] ? "bg-moss text-white" : "gd-thirst bg-white text-[#0c9384]"}`}
                aria-hidden
              >
                {done[i] ? <IconTick /> : <span className="size-3 rounded-full border-2 border-current" />}
              </span>
              <span className="-mt-2 max-w-full truncate rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold text-[#1c2624] shadow-sm sm:text-xs">{h.name}</span>
              <span className="mt-1 flex items-center gap-0.5 text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
                <IconFlame size={11} className="text-[#ffc59e]" />
                {h.streak + (done[i] && !h.done ? 1 : 0)}
              </span>
              <span className="pointer-events-none absolute inset-x-0 top-1/3">
                <Moment id={pops[i]} ms={1100}>
                  <Burst count={14} />
                </Moment>
              </span>
            </button>
          ))}
        </div>
      </GardenScene>
      <p className="mt-3 text-center text-sm text-ink-soft" aria-live="polite">
        {all ? "All five watered. That's a good day." : `Go on, tap the ${HABITS.length - count === 1 ? "last plant" : "plants"} still waiting.`}
      </p>
    </div>
  );
}
