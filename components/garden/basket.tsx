"use client";

import { useEffect, useState } from "react";
import { speciesOf, type Harvest } from "@/lib/habits-shared";
import { gardenApi } from "@/lib/habits-client";
import { BackLink, SectionTitle } from "./bits";
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
  const tally = new Map<string, { emoji: string; label: string; n: number }>();
  for (const h of fruit) {
    const s = speciesOf(h.species);
    const t = tally.get(s.id) ?? { emoji: s.fruitEmoji, label: s.fruit, n: 0 };
    t.n++;
    tally.set(s.id, t);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <BackLink href="/garden" label="Garden" />
      <header className="anim-rise mb-5 mt-2">
        <h1 className="font-display text-4xl">Basket</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {harvests === null ? "Counting…" : harvests.length === 0 ? "Nothing picked yet." : `${harvests.length} picked, ${golden.length} golden.`}
        </p>
      </header>

      {harvests !== null && harvests.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line px-6 py-14 text-center">
          <div className="text-5xl">🧺</div>
          <p className="mx-auto mt-3 max-w-xs text-sm text-ink-soft">
            A plant bears its first fruit after seven waterings. Pick it from the garden and it lands here.
          </p>
          <button type="button" onClick={() => navigateApp("/garden")} className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
            To the garden
          </button>
        </div>
      )}

      {golden.length > 0 && (
        <section className="mb-6">
          <SectionTitle>Golden fruit</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {golden.map((h) => (
              <div key={h.id} className="gd-shine relative overflow-hidden rounded-2xl border border-[#f1d57a] bg-gradient-to-br from-[#fff3b0] to-[#ffd23f] p-3 text-[#6b4a00]">
                <div className="text-3xl">✨{speciesOf(h.species).fruitEmoji}</div>
                <div className="mt-1 truncate text-sm font-bold">{h.habitName}</div>
                <div className="text-[11px] opacity-80">{new Date(h.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tally.size > 0 && (
        <section className="mb-6">
          <SectionTitle>Fruit</SectionTitle>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {[...tally.values()]
              .sort((a, b) => b.n - a.n)
              .map((t) => (
                <div key={t.label} className="rounded-2xl border border-line bg-card p-3 text-center">
                  <div className="text-3xl">{t.emoji}</div>
                  <div className="font-display mt-1 text-2xl leading-none">{t.n}</div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-faint">{t.label}</div>
                </div>
              ))}
          </div>
        </section>
      )}

      {fruit.length > 0 && (
        <section>
          <SectionTitle>Picked lately</SectionTitle>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {fruit.slice(0, 30).map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="text-xl">{speciesOf(h.species).fruitEmoji}</span>
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
