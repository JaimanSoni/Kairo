"use client";

import { useEffect, useState } from "react";
import { scheduleLabel, SEED_CATEGORIES, SEEDS, type Seed, type SeedStat } from "@/lib/habits-shared";
import { JOURNAL_SHOWN } from "@/lib/types";
import { gardenApi } from "@/lib/habits-client";
import { Plant } from "./plants";
import { HABIT_TINT, SectionTitle } from "./bits";
import { IconUsers } from "./icons";

/**
 * The ideas: habits worth starting, drawn as the plant they grow into.
 *
 * One card, used in both places it appears — the Ideas page and the Ideas
 * section on Habits — so the two can't drift apart. An idea already on your
 * list still shows, marked, rather than vanishing: seeing the whole set is
 * the point, and a gap where something used to be reads as an error.
 */

/** How many people keep each habit. Loads once, quietly; the cards read fine without it. */
export function useSeedStats(): Map<string, SeedStat> {
  const [stats, setStats] = useState<Map<string, SeedStat>>(new Map());
  useEffect(() => {
    let alive = true;
    void gardenApi.seeds().then((r) => {
      if (alive && r.ok) setStats(new Map(r.data.stats.map((s) => [s.seedId, s])));
    });
    return () => {
      alive = false;
    };
  }, []);
  return stats;
}

/** Every idea, under its category heading. */
export function SeedCategories({
  growing,
  stats,
  onSelect,
}: {
  growing: Set<string>;
  stats: Map<string, SeedStat>;
  onSelect: (seed: Seed, growing: boolean) => void;
}) {
  return (
    <>
      {SEED_CATEGORIES.map((c) => {
        // the journal's own idea waits for the journal to be shown again
        const seeds = SEEDS.filter((s) => s.category === c.id && (s.id !== "journal" || JOURNAL_SHOWN));
        if (seeds.length === 0) return null;
        return (
          <section key={c.id} className="mb-8 last:mb-0">
            <SectionTitle>{c.label}</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {seeds.map((s) => (
                <SeedCard key={s.id} seed={s} stat={stats.get(s.id)} growing={growing.has(s.id)} onSelect={onSelect} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

export function SeedCard({
  seed,
  stat,
  growing,
  onSelect,
}: {
  seed: Seed;
  stat?: SeedStat;
  growing: boolean;
  onSelect: (seed: Seed, growing: boolean) => void;
}) {
  const tint = HABIT_TINT[seed.color];
  return (
    <button
      type="button"
      onClick={() => onSelect(seed, growing)}
      data-seed={seed.id}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card text-left transition-all hover:-translate-y-0.5 hover:border-ink-faint/40 hover:shadow-md"
    >
      <span
        className="relative flex h-28 items-end justify-center"
        style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${tint} 5%, transparent), color-mix(in srgb, ${tint} 16%, transparent))` }}
      >
        {growing && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-semibold text-moss shadow-sm">On your list</span>
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
