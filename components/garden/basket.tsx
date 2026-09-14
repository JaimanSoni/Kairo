"use client";

import { useEffect, useState } from "react";
import { speciesOf, type Harvest, type SpeciesId } from "@/lib/habits-shared";
import { gardenApi } from "@/lib/habits-client";
import { BackLink, SectionTitle } from "./bits";
import { IconSparkle } from "./icons";
import { FruitGlyph } from "./plants";
import { navigateApp } from "../app-views";

/** Everything ever picked. Fruit is the souvenir of days kept. */
export function BasketPage() {
  const [harvests, setHarvests] = useState<Harvest[] | null>(null);

  useEffect(() => {
    let alive = true;
    void gardenApi.basket().then((r) => {
      if (alive) setHarvests(r.ok ? r.data.harvests : []);
    });
    return () => {
      alive = false;
    };
  }, []);

  const golden = harvests?.filter((h) => h.kind === "golden") ?? [];
  const fruit = harvests?.filter((h) => h.kind === "fruit") ?? [];
  const tally = new Map<SpeciesId, { label: string; n: number }>();
  for (const h of fruit) {
    const s = speciesOf(h.species);
    const t = tally.get(s.id) ?? { label: s.fruit, n: 0 };
    t.n++;
    tally.set(s.id, t);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <BackLink href="/garden" label="Garden" />
      <header className="anim-rise mb-7 mt-3">
        <h1 className="font-display text-4xl">Basket</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {harvests === null ? "Counting…" : harvests.length === 0 ? "Nothing picked yet." : `${harvests.length} picked, ${golden.length} golden.`}
        </p>
      </header>

      {harvests !== null && harvests.length === 0 && (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-14 text-center">
          <div className="flex -space-x-2">
            <FruitGlyph species="apple" size={40} />
            <FruitGlyph species="lemon" size={40} />
            <FruitGlyph species="strawberry" size={40} />
          </div>
          <div className="font-display mt-3 text-2xl">An empty basket</div>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">A plant bears its first fruit after seven waterings. Pick it in the garden and it lands here.</p>
          <button type="button" onClick={() => navigateApp("/garden")} className="mt-4 h-9 rounded-full bg-ink px-4 text-sm font-semibold text-paper">
            To the garden
          </button>
        </div>
      )}

      {golden.length > 0 && (
        <section className="mb-8">
          <SectionTitle>Golden fruit</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {golden.map((h) => (
              <div key={h.id} className="gd-shine gd-golden-card relative overflow-hidden rounded-2xl border p-4">
                <div className="flex items-center gap-1.5">
                  <FruitGlyph species={h.species} size={28} golden />
                  <IconSparkle size={14} className="text-[#b58a00]" />
                </div>
                <div className="mt-2 truncate text-sm font-medium">{h.habitName}</div>
                <div className="text-[11px] text-ink-faint">{new Date(h.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tally.size > 0 && (
        <section className="mb-8">
          <SectionTitle>Fruit</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[...tally.entries()]
              .sort((a, b) => b[1].n - a[1].n)
              .map(([species, t]) => (
                <div key={species} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper-deep">
                    <FruitGlyph species={species} size={26} />
                  </span>
                  <span className="min-w-0">
                    <span className="font-display block text-2xl leading-none">{t.n}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-faint">{t.label}</span>
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {fruit.length > 0 && (
        <section>
          <SectionTitle>Picked lately</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {fruit.slice(0, 30).map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <FruitGlyph species={h.species} size={20} />
                <span className="min-w-0 flex-1 truncate">{h.habitName}</span>
                <span className="text-xs text-ink-faint">{new Date(h.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
