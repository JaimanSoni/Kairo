"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { seedOf, type Seed } from "@/lib/habits-shared";
import { navigateApp } from "../app-views";
import { IconPlus } from "../ui";
import { PlantSheet } from "./plant-sheet";
import { useGarden } from "./use-garden";
import { BackLink } from "./bits";
import { SeedCategories, useSeedStats } from "./seed-card";

/** Ideas: habits worth starting, how many people keep each, and a way to start your own. */
export function SeedsPage() {
  const { habits } = useGarden();
  const params = useSearchParams();
  const asked = params.get("start") ?? params.get("plant");
  const stats = useSeedStats();
  const [open, setOpen] = useState<{ seed: Seed | null; name?: string } | null>(null);
  const growing = new Set(habits.filter((h) => h.seedId).map((h) => h.seedId as string));

  // a deep link (from the habits page or search) opens the sheet straight away
  const linked = asked === "custom" ? { seed: null, name: "" } : asked && seedOf(asked) && !growing.has(asked) ? { seed: seedOf(asked) } : null;
  const sheet = open ?? linked;
  const close = () => {
    setOpen(null);
    if (asked) window.history.replaceState(null, "", "/habits/ideas");
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <BackLink href="/habits" label="Habits" />
      <header className="anim-rise mb-7 mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Ideas</h1>
          <p className="mt-1 text-sm text-ink-soft">Habits to start from. Tap one to make it yours. People doing the same habit share a leaderboard.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen({ seed: null, name: "" })}
          className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-xs font-semibold text-paper transition-colors hover:bg-ink/90"
        >
          <IconPlus size={14} /> Your own habit
        </button>
      </header>

      <SeedCategories growing={growing} stats={stats} onSelect={(seed, isGrowing) => (isGrowing ? navigateApp("/habits") : setOpen({ seed }))} />

      {sheet && <PlantSheet seed={sheet.seed} name={sheet.name} onClose={close} />}
    </div>
  );
}
