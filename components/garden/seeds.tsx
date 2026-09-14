"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { scheduleLabel, SEED_CATEGORIES, seedOf, SEEDS, type Seed, type SeedStat } from "@/lib/habits-shared";
import { gardenApi } from "@/lib/habits-client";
import { navigateApp } from "../app-views";
import { IconPlus } from "../ui";
import { Plant } from "./plants";
import { PlantSheet } from "./plant-sheet";
import { useGarden } from "./use-garden";
import { BackLink, HABIT_TINT, SectionTitle } from "./bits";
import { IconUsers } from "./icons";

/** The seed shop: popular habits, how many gardeners grow each, and your own custom seed. */
export function SeedsPage() {
  const { habits } = useGarden();
  const params = useSearchParams();
  const asked = params.get("plant");
  const [stats, setStats] = useState<Map<string, SeedStat>>(new Map());
  const [open, setOpen] = useState<{ seed: Seed | null } | null>(null);
  const growing = new Set(habits.filter((h) => h.seedId).map((h) => h.seedId as string));

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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <BackLink href="/garden" label="Garden" />
      <header className="anim-rise mb-7 mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Seeds</h1>
          <p className="mt-1 text-sm text-ink-soft">Pick a habit to grow. Everyone growing the same seed shares a leaderboard.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen({ seed: null })}
          className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-xs font-semibold text-paper transition-colors hover:bg-ink/90"
        >
          <IconPlus size={14} /> Your own seed
        </button>
      </header>

      {SEED_CATEGORIES.map((c) => {
        const seeds = SEEDS.filter((s) => s.category === c.id);
        if (seeds.length === 0) return null;
        return (
          <section key={c.id} className="mb-8">
            <SectionTitle>{c.label}</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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

function SeedCard({ seed, stat, growing, onPlant }: { seed: Seed; stat?: SeedStat; growing: boolean; onPlant: () => void }) {
  const tint = HABIT_TINT[seed.color];
  return (
    <button
      type="button"
      onClick={() => (growing ? navigateApp("/garden") : onPlant())}
      data-seed={seed.id}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card text-left transition-all hover:-translate-y-0.5 hover:border-ink-faint/40 hover:shadow-md"
    >
      <span className="relative flex h-28 items-end justify-center" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${tint} 5%, transparent), color-mix(in srgb, ${tint} 16%, transparent))` }}>
        {growing && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-semibold text-moss shadow-sm">Growing</span>
        )}
        <span className="transition-transform duration-300 group-hover:scale-105">
          <Plant species={seed.species} stage={5} size={76} sway={false} ground="none" />
        </span>
      </span>
      <span className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        <span className="text-sm font-medium leading-snug text-ink">{seed.name}</span>
        <span className="mt-0.5 text-xs leading-snug text-ink-soft">{seed.hint}</span>
        <span className="mt-auto flex items-center gap-1.5 pt-2.5 text-[11px] text-ink-faint">
          <span className="truncate">{seed.target > 1 ? `${seed.target} ${seed.unit} a day` : scheduleLabel(seed.schedule)}</span>
          {stat && stat.gardeners > 0 && (
            <>
              <span aria-hidden>·</span>
              <IconUsers size={11} className="shrink-0" />
              <span className="shrink-0">{stat.gardeners.toLocaleString()}</span>
            </>
          )}
        </span>
      </span>
    </button>
  );
}
