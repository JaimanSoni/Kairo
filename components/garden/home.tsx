"use client";

import { addDays, SEEDS } from "@/lib/habits-shared";
import { gardenStore } from "@/lib/habits-client";
import { navigateApp } from "../app-views";
import { rescueText } from "./bits";
import { useClock } from "./fx";
import { Plant } from "./plants";
import { Plot, PlantRow } from "./plot";
import { GardenScene, type Weather } from "./scene";
import { plotOf, useGarden, useGardenActions } from "./use-garden";

/**
 * The garden: every plant on the ground, today's watering, and whatever is
 * about to be lost. The scene is the reward; the list below it is the plain
 * way to do the same thing.
 */
export function GardenHome() {
  const { status, habits, today } = useGarden();
  const { moments, water, pick } = useGardenActions();
  const minute = useClock();

  // not memoised on purpose: a plot reads the store's days, which change without `habits` changing
  const plots = habits.map((h) => plotOf(h, today));
  const due = plots.filter((p) => p.live.dueToday || p.live.todayDone);
  const watered = due.filter((p) => p.live.todayDone).length;
  const thriving = plots.filter((p) => p.live.health === "thriving").length;
  const weather: Weather = due.length === 0 || watered === due.length ? "clear" : watered > 0 || minute < 17 * 60 ? "partly" : "cloudy";
  const rescues = plots.filter((p) => p.live.rescue && !p.live.rescue.covered && p.live.rescue.keeps > 0);
  const covered = plots.filter((p) => p.live.rescue?.covered);
  const atRisk = minute >= 18 * 60 ? plots.filter((p) => p.thirsty && p.live.streak >= 3) : [];
  const ripe = plots.reduce((n, p) => n + p.ripe + p.golden, 0);
  const longest = plots.reduce((n, p) => Math.max(n, p.live.streak), 0);
  const planted = new Set(habits.map((h) => h.seedId).filter(Boolean));
  const suggestions = SEEDS.filter((s) => !planted.has(s.id)).slice(0, 6);

  if (status === "loading" || status === "idle") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:px-6">
        <div className="h-10 w-40 animate-pulse rounded-xl bg-paper-deep" />
        <div className="mt-5 h-96 animate-pulse rounded-[1.75rem] bg-paper-deep" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-md px-6 pb-32 pt-24 text-center">
        <div className="text-4xl">🌧️</div>
        <h1 className="font-display mt-3 text-2xl">The garden didn&apos;t load</h1>
        <p className="mt-2 text-sm text-ink-soft">Check your connection, then try again.</p>
        <button onClick={() => void gardenStore.reload()} className="mt-5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <header className="anim-rise mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Garden</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {habits.length === 0
              ? "Every habit is a seed. Keep it up and it grows."
              : [
                  due.length ? `${watered} of ${due.length} watered today` : "Nothing to water today",
                  longest > 1 ? `longest streak ${longest} days` : null,
                  ripe > 0 ? `${ripe} ripe to pick` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Garden">
          <GardenLink href="/garden/seeds" label="🌱 Seeds" primary={habits.length === 0} />
          <GardenLink href="/garden/community" label="🏆 Community" />
          <GardenLink href="/garden/basket" label="🧺 Basket" />
        </nav>
      </header>

      {rescues.map((p) => (
        <div key={p.habit.id} className="anim-pop mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sun/40 bg-sun-soft/60 px-4 py-2.5">
          <p className="text-sm">
            <span aria-hidden>{p.habit.emoji} </span>
            {p.habit.schedule.kind === "weekly" ? <b>{p.habit.name}: </b> : null}
            {rescueText(p.habit, p.live.rescue!.keeps)}
          </p>
          <button
            type="button"
            onClick={() => void water(p.habit, { date: addDays(today, -1), fill: true })}
            className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper"
          >
            Water yesterday
          </button>
        </div>
      ))}
      {covered.length > 0 && (
        <p className="mb-3 rounded-2xl border border-sky/30 bg-sky-soft/50 px-4 py-2 text-sm text-ink-soft">
          💧 A dew drop is covering yesterday for {covered.map((p) => p.habit.name).join(", ")}. Your streak is safe.
        </p>
      )}
      {atRisk.length > 0 && (
        <p className="anim-pop mb-3 rounded-2xl border border-lilac/40 bg-lilac-soft/60 px-4 py-2 text-sm">
          🌙 {atRisk.length === 1 ? `${atRisk[0].habit.name} is` : `${atRisk.length} plants are`} still thirsty tonight — {atRisk.length === 1 ? `a ${atRisk[0].live.streak}-day streak` : "streaks"} on the line.
        </p>
      )}

      <GardenScene weather={weather} thriving={thriving}>
        {habits.length === 0 ? (
          <div className="relative flex flex-col items-center px-6 pb-10 pt-4 text-center">
            <div className="flex items-end gap-1">
              {["sunflower", "tulip", "apple"].map((s, i) => (
                <Plant key={s} species={s as "sunflower"} stage={i === 1 ? 0 : 1} size={70} phase={i} />
              ))}
            </div>
            <h2 className="font-display mt-2 text-2xl text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.25)]">Plant your first seed</h2>
            <p className="mt-1 max-w-sm text-sm text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.3)]">
              Pick a habit. Water it on the days you keep it, and watch it sprout, bloom and bear fruit.
            </p>
            <button
              type="button"
              onClick={() => navigateApp("/garden/seeds")}
              className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-bold text-[#3f6d3a] shadow-lg transition-transform hover:-translate-y-0.5"
            >
              Choose a seed
            </button>
          </div>
        ) : (
          <div className="relative flex flex-wrap items-end justify-center gap-x-2 gap-y-4 px-2 pb-6 pt-1 sm:gap-x-8 [&>*]:w-[46%] sm:[&>*]:w-[9.5rem]">
            {plots.map((p, i) => (
              <Plot key={p.habit.id} info={p} index={i} moments={moments} onWater={(h) => void water(h)} onPick={(h, k) => void pick(h, k)} />
            ))}
          </div>
        )}
      </GardenScene>

      {plots.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">Today</h2>
          <ul className="space-y-2">
            {[...plots]
              .sort((a, b) => Number(b.thirsty) - Number(a.thirsty) || Number(a.live.todayDone) - Number(b.live.todayDone))
              .map((p) => (
                <PlantRow key={p.habit.id} info={p} onWater={(h, o) => void water(h, o)} />
              ))}
          </ul>
        </section>
      )}

      {suggestions.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">{habits.length ? "More to grow" : "Popular seeds"}</h2>
            <button type="button" onClick={() => navigateApp("/garden/seeds")} className="text-xs font-semibold text-sun-deep">
              All seeds →
            </button>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigateApp(`/garden/seeds?plant=${s.id}`)}
                className="flex w-56 shrink-0 items-center gap-2 rounded-2xl border border-line bg-card p-2 text-left transition-all hover:-translate-y-0.5 hover:border-sun/50 sm:w-auto"
              >
                <Plant species={s.species} stage={5} size={44} sway={false} ground="none" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {s.emoji} {s.name}
                  </span>
                  <span className="block truncate text-xs text-ink-faint">{s.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {plots.some((p) => p.stage.next) && (
        <section className="mt-8">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">Growing next</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {plots
              .filter((p) => p.stage.next)
              .sort((a, b) => (a.stage.next!.left ?? 0) - (b.stage.next!.left ?? 0))
              .slice(0, 4)
              .map((p) => (
                <div key={p.habit.id} className="rounded-2xl border border-line bg-card px-3 py-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium">
                      {p.habit.emoji} {p.habit.name}
                    </span>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {p.stage.next!.left} to {p.stage.next!.label.toLowerCase()}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-deep">
                    <div className="h-full rounded-full bg-moss transition-all" style={{ width: `${Math.round(p.stage.progress * 100)}%` }} />
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GardenLink({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        navigateApp(href);
      }}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        primary ? "bg-ink text-paper" : "border border-line bg-card text-ink-soft hover:border-sun hover:text-sun-deep"
      }`}
    >
      {label}
    </a>
  );
}
