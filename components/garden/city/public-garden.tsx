"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { GARDEN_LEVELS, type CityGarden, type CityPlant } from "@/lib/habits-shared";
import { Avatar } from "../bits";
import { GardenScene } from "../scene";
import { VisitPlant } from "./visit";

const noop = () => () => {};

function subscribeWide(cb: () => void) {
  const mq = window.matchMedia("(min-width: 640px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * A garden shared from Kairo City, for anyone with the link: the garden at
 * full size, whose it is and how far it has come, and the two ways in, to
 * start one's own or to walk around the city first.
 */
export function PublicGarden({ garden }: { garden: CityGarden }) {
  // the sky follows the visitor's clock, so nothing is drawn until the browser has one
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 640px)").matches, () => true);
  const level = GARDEN_LEVELS[garden.level - 1];
  const perRow = wide ? 4 : 3;
  const rows: CityPlant[][] = [];
  for (let i = 0; i < garden.plants.length; i += perRow) rows.push(garden.plants.slice(i, i + perRow));
  const allDone = garden.dueToday > 0 && garden.doneToday === garden.dueToday;

  if (!mounted) return <div className="fixed inset-0 bg-[linear-gradient(180deg,#3fa6ec_0%,#d4f1fb_45%,#74bd66_45%,#56a452_100%)]" aria-hidden />;

  return (
    <main className="fixed inset-0 overflow-hidden" data-public-garden={garden.id}>
      <GardenScene variant="immersive" weather={allDone ? "clear" : "partly"} thriving={garden.plants.filter((p) => p.strength >= 60).length} allDone={allDone} decorLevel={garden.level}>
        <div className="pb-48 pt-28 sm:pb-40 sm:pt-16">
          {[...rows].reverse().map((row, ri, all) => {
            const depth = all.length === 1 ? 1 : ri / (all.length - 1);
            const size = Math.round((wide ? 118 : 84) + depth * (wide ? 42 : 20));
            return (
              <div key={ri} className={`relative flex items-end justify-center gap-x-1 sm:gap-x-8 ${ri > 0 ? "mt-2 sm:-mt-2" : ""}`} style={{ zIndex: ri + 1 }}>
                {row.map((p, i) => (
                  <VisitPlant key={i} plant={p} size={size} phase={ri * 3 + i} mine={false} />
                ))}
              </div>
            );
          })}
        </div>
      </GardenScene>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-44 bg-gradient-to-b from-[#07142a]/45 to-transparent" aria-hidden />
      <header className="absolute inset-x-0 top-0 z-40 flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
        <Avatar animal={garden.animal} size={52} className="shadow-lg ring-2 ring-white/80" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/85">Kairo City</p>
          <h1 className="font-display truncate text-3xl leading-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.35)] sm:text-4xl">{garden.name}&apos;s garden</h1>
          <p className="truncate text-sm font-medium text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]">
            Level {garden.level} · {level.name} · {garden.score} pts{garden.rank ? ` · #${garden.rank} in the city` : ""}
          </p>
        </div>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="gd-hud max-w-lg rounded-2xl px-4 py-2.5 text-center text-sm font-semibold text-white">
          Every plant here is a habit {garden.name} keeps, grown one kept day at a time. Can yours grow a better garden?
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <a href="/api/auth/google" data-track="share-signin" className="flex h-12 items-center rounded-full bg-[#ffd166] px-6 text-sm font-bold text-[#3b2a00] shadow-xl transition-transform hover:-translate-y-0.5">
            Start your own garden, free
          </a>
          <Link href="/?city=open" data-track="share-city" className="gd-hud flex h-12 items-center rounded-full px-6 text-sm font-bold text-white transition-transform hover:-translate-y-0.5">
            Walk around Kairo City
          </Link>
        </div>
      </div>
    </main>
  );
}
