"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { scheduleLabel, SEED_CATEGORIES, seedOf, SEEDS, type Seed, type SeedStat } from "@/lib/habits-shared";
import { gardenApi } from "@/lib/habits-client";
import { navigateApp } from "../app-views";
import { Plant } from "./plants";
import { PlantSheet } from "./plant-sheet";
import { useGarden } from "./use-garden";
import { BackLink } from "./bits";

/** The seed shop: popular habits, how many gardeners grow each, and your own custom seed. */
export function SeedsPage() {
  const { habits } = useGarden();
  const params = useSearchParams();
  const asked = params.get("plant");
  const [stats, setStats] = useState<Map<string, SeedStat>>(new Map());
  const [open, setOpen] = useState<{ seed: Seed | null } | null>(null);
  const growing = new Map(habits.filter((h) => h.seedId).map((h) => [h.seedId as string, h]));

  useEffect(() => {
    let alive = true;
    void gardenApi.seeds().then((r) => {
      if (alive && r.ok) setStats(new Map(r.data.stats.map((s) => [s.seedId, s])));
    });
    return () => {
      alive = false;
    };
  }, []);

  // a deep link (from the garden's suggestions) opens the sheet straight away
  const linked = asked === "custom" ? { seed: null } : asked && seedOf(asked) && !growing.has(asked) ? { seed: seedOf(asked) } : null;
  const sheet = open ?? linked;
  const close = () => {
    setOpen(null);
    if (asked) window.history.replaceState(null, "", "/garden/seeds");
  };

  const popular = [...SEEDS].sort((a, b) => (stats.get(b.id)?.gardeners ?? 0) - (stats.get(a.id)?.gardeners ?? 0)).slice(0, 4);
  const anyStats = [...stats.values()].some((s) => s.gardeners > 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-32 pt-6 sm:px-6">
      <BackLink href="/garden" label="Garden" />
      <header className="anim-rise mb-5 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Seeds</h1>
          <p className="mt-1 text-sm text-ink-soft">Pick a habit to grow. Seeds everyone plants share a leaderboard.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen({ seed: null })}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper shadow-sm transition-transform hover:-translate-y-0.5"
        >
          ✨ Your own seed
        </button>
      </header>

      {anyStats && (
        <section className="mb-7">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">Most planted</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {popular.map((s, i) => (
              <SeedCard key={s.id} seed={s} stat={stats.get(s.id)} growing={growing.has(s.id)} onPlant={() => setOpen({ seed: s })} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {SEED_CATEGORIES.map((c) => {
        const seeds = SEEDS.filter((s) => s.category === c.id);
        if (seeds.length === 0) return null;
        return (
          <section key={c.id} className="mb-7">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">{c.label}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {seeds.map((s) => (
                <SeedCard key={s.id} seed={s} stat={stats.get(s.id)} growing={growing.has(s.id)} onPlant={() => setOpen({ seed: s })} />
              ))}
            </div>
          </section>
        );
      })}

      {sheet && <PlantSheet seed={sheet.seed} onClose={close} />}
    </div>
  );
}

function SeedCard({ seed, stat, growing, onPlant, rank }: { seed: Seed; stat?: SeedStat; growing: boolean; onPlant: () => void; rank?: number }) {
  return (
    <button
      type="button"
      onClick={() => (growing ? navigateApp("/garden") : onPlant())}
      data-seed={seed.id}
      className="group relative flex flex-col items-center rounded-2xl border border-line bg-card px-2 pb-3 pt-1 text-center transition-all hover:-translate-y-0.5 hover:border-sun/50 hover:shadow-md"
    >
      {rank && <span className="absolute left-2 top-2 text-[10px] font-bold text-ink-faint">#{rank}</span>}
      {growing && <span className="absolute right-2 top-2 rounded-full bg-moss-soft px-1.5 py-0.5 text-[10px] font-bold text-moss">Growing</span>}
      <span className="transition-transform group-hover:scale-105">
        <Plant species={seed.species} stage={5} size={78} sway={false} />
      </span>
      <span className="-mt-1 text-sm font-semibold leading-tight">
        {seed.emoji} {seed.name}
      </span>
      <span className="mt-0.5 text-[11px] text-ink-faint">{seed.target > 1 ? `${seed.target} ${seed.unit} a day` : scheduleLabel(seed.schedule)}</span>
      <span className="mt-1 text-[11px] text-ink-soft">
        {stat && stat.gardeners > 0 ? `${stat.gardeners.toLocaleString()} ${stat.gardeners === 1 ? "gardener" : "gardeners"}` : seed.hint}
      </span>
    </button>
  );
}
