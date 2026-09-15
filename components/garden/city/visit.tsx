"use client";

import { useState, useSyncExternalStore } from "react";
import { gardenApi } from "@/lib/habits-client";
import { GARDEN_LEVELS, nextGardenLevel, type CityGarden, type CityPlant } from "@/lib/habits-shared";
import { track } from "@/lib/analytics-client";
import { useApp } from "../../store";
import { Avatar } from "../bits";
import { Burst, buzz, Moment, plink } from "../fx";
import { IconArrowLeft, IconFlame, IconTick } from "../icons";
import { Plant } from "../plants";
import { GardenScene } from "../scene";
import { IconSun } from "./lot";

function subscribeWide(cb: () => void) {
  const mq = window.matchMedia("(min-width: 640px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Inside someone's garden: their plants at full size, what their level has
 * built, and a cheer to leave. Your own garden shows what the next level
 * adds, and a way to share it.
 */
export function GardenVisit({
  garden,
  guest,
  canCheer,
  onBack,
  onJoin,
  onShare,
  onCheered,
}: {
  garden: CityGarden;
  guest: boolean;
  canCheer: boolean;
  onBack: () => void;
  onJoin: () => void;
  onShare: () => void;
  onCheered: (cheers: CityGarden["cheers"]) => void;
}) {
  const { showToast } = useApp();
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 640px)").matches, () => true);
  const [busy, setBusy] = useState(false);
  const [sunshine, setSunshine] = useState(0);
  const level = GARDEN_LEVELS[garden.level - 1];
  const next = nextGardenLevel(garden.score);
  const allDone = garden.dueToday > 0 && garden.doneToday === garden.dueToday;
  const thriving = garden.plants.filter((p) => p.strength >= 60).length;
  const perRow = wide ? 4 : 3;
  const rows: CityPlant[][] = [];
  for (let i = 0; i < garden.plants.length; i += perRow) rows.push(garden.plants.slice(i, i + perRow));

  const cheer = async () => {
    if (guest) {
      window.location.assign("/api/auth/google");
      return;
    }
    if (!canCheer) {
      onJoin();
      return;
    }
    if (garden.cheers.mine || busy) return;
    setBusy(true);
    const r = await gardenApi.cheer(garden.id);
    setBusy(false);
    if (!r.ok) {
      showToast({ message: r.kind === "invalid" ? r.message : "That cheer didn't reach them. Try again." });
      return;
    }
    setSunshine((n) => n + 1);
    plink(true);
    buzz([12, 40, 18]);
    track("city-cheer");
    onCheered(r.data.cheers);
  };

  return (
    <div className="gd-immersive fixed inset-0 z-[62]" role="dialog" aria-modal aria-label={`${garden.name}'s garden`} data-visit={garden.id}>
      <GardenScene variant="immersive" weather={allDone || garden.showcase ? "clear" : "partly"} thriving={thriving} allDone={allDone} decorLevel={garden.level}>
        <div className="pb-40 pt-24 sm:pb-36 sm:pt-16">
          {garden.plants.length === 0 ? (
            <p className="mx-auto w-max rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[#1c2624]">Freshly dug: nothing growing yet</p>
          ) : (
            [...rows].reverse().map((row, ri, all) => {
              const depth = all.length === 1 ? 1 : ri / (all.length - 1);
              const size = Math.round((wide ? 118 : 84) + depth * (wide ? 42 : 20));
              return (
                <div key={ri} className={`relative flex items-end justify-center gap-x-1 sm:gap-x-8 ${ri > 0 ? "mt-2 sm:-mt-2" : ""}`} style={{ zIndex: ri + 1 }}>
                  {row.map((p, i) => (
                    <VisitPlant key={i} plant={p} size={size} phase={ri * 3 + i} mine={garden.me} />
                  ))}
                </div>
              );
            })
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-30" aria-hidden>
          <Moment id={sunshine} ms={1800}>
            <Burst golden count={48} />
          </Moment>
        </div>
      </GardenScene>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-44 bg-gradient-to-b from-[#07142a]/45 to-transparent" aria-hidden />
      <header className="absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Back to the street" className="gd-hud grid size-10 shrink-0 place-items-center rounded-full text-white" data-back-street>
            <IconArrowLeft size={18} />
          </button>
          {garden.showcase ? (
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/90 shadow-lg">
              <IconSun size={26} />
            </span>
          ) : (
            <Avatar animal={garden.animal} size={48} className="shadow-lg ring-2 ring-white/80" />
          )}
          <div className="min-w-0">
            <h2 className="font-display truncate text-2xl leading-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.35)] sm:text-3xl">{garden.me ? "Your garden" : garden.showcase ? garden.name : `${garden.name}'s garden`}</h2>
            <p className="truncate text-sm font-medium text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]" data-visit-level>
              Level {garden.level} · {level.name} · {garden.score} pts{garden.rank ? ` · #${garden.rank} in the city` : ""}
            </p>
          </div>
        </div>
      </header>

      {/* the bottom: what this garden is up to, and the cheer */}
      <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {garden.showcase ? (
          <p className="gd-hud max-w-md rounded-2xl px-4 py-2.5 text-center text-sm font-semibold text-white">This is what a Legendary garden looks like. Five habits kept for months will build yours.</p>
        ) : garden.me ? (
          <>
            <p className="gd-hud max-w-md rounded-2xl px-4 py-2.5 text-center text-sm font-semibold text-white" data-next-level>
              {next ? `${next.min - garden.score} points to ${next.name}: ${next.adds.toLowerCase()}.` : "Legendary. There's no higher level."}
              {garden.cheers.today > 0 && ` ${garden.cheers.today} ${garden.cheers.today === 1 ? "cheer" : "cheers"} today${garden.cheers.from.length ? ` from ${garden.cheers.from.slice(0, 3).join(", ")}` : ""}.`}
            </p>
            <button type="button" onClick={onShare} className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-[#1c2624] shadow-xl transition-transform hover:-translate-y-0.5">
              Share your garden
            </button>
          </>
        ) : (
          <>
            <p className="gd-hud rounded-full px-4 py-2 text-center text-xs font-semibold text-white">
              {garden.dueToday > 0 ? `${garden.doneToday} of ${garden.dueToday} habits done today` : `${garden.habits} ${garden.habits === 1 ? "habit" : "habits"} growing`} · {garden.cheers.today} {garden.cheers.today === 1 ? "cheer" : "cheers"} today
            </p>
            <button
              type="button"
              onClick={() => void cheer()}
              disabled={busy || garden.cheers.mine}
              className={`city-cheer flex h-14 items-center gap-2.5 rounded-full px-7 text-base font-bold shadow-xl transition-all hover:-translate-y-0.5 disabled:hover:translate-y-0 ${
                garden.cheers.mine ? "bg-white/90 text-[#5c4300]" : "bg-[#ffd166] text-[#3b2a00]"
              }`}
              data-cheer
            >
              <IconSun size={24} className={garden.cheers.mine ? "" : "gd-spin"} />
              {garden.cheers.mine ? "You cheered today" : guest ? "Sign in to cheer" : canCheer ? `Cheer ${garden.name}` : "Join the city to cheer"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function VisitPlant({ plant, size, phase, mine }: { plant: CityPlant; size: number; phase: number; mine: boolean }) {
  return (
    <div className="relative flex shrink-0 flex-col items-center" style={{ width: Math.round(size * 1.08) }} data-visit-plant>
      {plant.doneToday && <span className="gd-glow pointer-events-none absolute -inset-x-3 top-0 aspect-square rounded-full" aria-hidden />}
      <span className="relative">
        <Plant species={plant.species} stage={plant.stage} size={size} phase={phase * 0.7} fit="snug" />
      </span>
      {plant.doneToday && (
        <span className="absolute right-0 top-2 grid size-7 place-items-center rounded-full bg-moss text-white shadow-md ring-2 ring-white/80" aria-hidden>
          <IconTick />
        </span>
      )}
      <span className="-mt-2.5 max-w-full truncate rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#1c2624] shadow-sm">{plant.name ?? (mine ? "Your own habit" : "A habit of their own")}</span>
      <span className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
        <span className="tabular-nums">{plant.strength}%</span>
        {plant.streak > 0 && (
          <span className="flex items-center gap-0.5">
            <IconFlame size={12} className="text-[#ffc59e]" />
            <span className="tabular-nums">{plant.streak}</span>
          </span>
        )}
      </span>
    </div>
  );
}
