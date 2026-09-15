"use client";

import { addDays, SEEDS } from "@/lib/habits-shared";
import { JOURNAL_SHOWN } from "@/lib/types";
import { gardenStore } from "@/lib/habits-client";
import { navigateApp } from "../app-views";
import { HabitMark, PillLink, rescueText, SectionTitle, Switch } from "./bits";
import { useClock } from "./fx";
import { IconBasket, IconBell, IconDrop, IconTrophy } from "./icons";
import { IconSprout } from "../ui";
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
  const atRisk = minute >= 18 * 60 ? plots.filter((p) => p.thirsty && p.live.streak >= 3).length : 0;
  const ripe = plots.reduce((n, p) => n + p.ripe + p.golden, 0);
  const longest = plots.reduce((n, p) => Math.max(n, p.live.streak), 0);
  const planted = new Set(habits.map((h) => h.seedId).filter(Boolean));
  const suggestions = SEEDS.filter((s) => !planted.has(s.id) && (s.id !== "journal" || JOURNAL_SHOWN)).slice(0, 6);
  const growing = plots.filter((p) => p.stage.next).sort((a, b) => a.stage.next!.left - b.stage.next!.left).slice(0, 4);

  if (status === "loading" || status === "idle") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-8 sm:px-6">
        <div className="h-10 w-40 animate-pulse rounded-xl bg-paper-deep" />
        <div className="mt-6 h-96 animate-pulse rounded-[1.75rem] bg-paper-deep" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-md px-6 pb-32 pt-24 text-center">
        <h1 className="font-display text-2xl">The garden didn&apos;t load</h1>
        <p className="mt-2 text-sm text-ink-soft">Check your connection, then try again.</p>
        <button onClick={() => void gardenStore.reload()} className="mt-5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
          Try again
        </button>
      </div>
    );
  }

  const summary = habits.length === 0
    ? "Every habit is a seed. Keep it, and it grows."
    : [
        due.length ? `${watered} of ${due.length} watered today` : "Nothing to water today",
        longest > 1 ? `longest streak ${longest} days` : null,
        ripe > 0 ? `${ripe} ripe to pick` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-8 sm:px-6">
      <header className="anim-rise mb-6 flex flex-wrap items-start justify-between gap-x-3 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl">Garden</h1>
          <p className="mt-1 text-sm text-ink-soft">{summary}</p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Garden">
          <PillLink href="/garden/seeds" icon={<IconSprout size={14} />} primary={habits.length === 0}>
            Seeds
          </PillLink>
          <PillLink href="/garden/community" icon={<IconTrophy size={14} />}>
            Community
          </PillLink>
          <PillLink href="/garden/basket" icon={<IconBasket size={14} />}>
            Basket
          </PillLink>
        </nav>
      </header>

      {rescues.length > 0 && (
        <section className="anim-rise mb-4 overflow-hidden rounded-2xl border border-line bg-card" aria-label="Yesterday">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            <IconDrop size={13} className="text-sky" /> Still time for yesterday
          </div>
          <ul className="divide-y divide-line">
            {rescues.map((p) => (
              <li key={p.habit.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <HabitMark habit={p.habit} size={36} />
                <span className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-0">
                  <span className="block truncate text-sm font-medium">{p.habit.name}</span>
                  <span className="block text-xs text-ink-soft">{rescueText(p.habit, p.live.rescue!.keeps)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void water(p.habit, { date: addDays(today, -1), fill: true })}
                  className="ml-12 h-8 shrink-0 rounded-full bg-ink px-3.5 text-xs font-semibold text-paper transition-colors hover:bg-ink/90 sm:ml-0"
                >
                  Water yesterday
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <GardenScene weather={weather} thriving={thriving}>
        {habits.length === 0 ? (
          <div className="relative flex flex-col items-center px-6 pb-10 pt-4 text-center">
            <div className="flex items-end gap-1">
              {(["sunflower", "tulip", "apple"] as const).map((s, i) => (
                <Plant key={s} species={s} stage={i === 1 ? 0 : 1} size={70} phase={i} />
              ))}
            </div>
            <h2 className="font-display mt-2 text-2xl text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.25)]">Plant your first seed</h2>
            <p className="mt-1 max-w-sm text-sm text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.3)]">
              Pick a habit. Water it on the days you keep it, and watch it sprout, bloom and bear fruit.
            </p>
            <button
              type="button"
              onClick={() => navigateApp("/garden/seeds")}
              className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#1c2624] shadow-lg transition-transform hover:-translate-y-0.5"
            >
              Choose a seed
            </button>
          </div>
        ) : (
          <div className="relative flex flex-wrap items-end justify-center gap-x-2 gap-y-4 px-2 pb-6 pt-1 sm:gap-x-3 [&>*]:w-[46%] sm:[&>*]:w-[7.75rem]">
            {plots.map((p, i) => (
              <Plot key={p.habit.id} info={p} index={i} moments={moments} onWater={(h) => void water(h)} onPick={(h, k) => void pick(h, k)} />
            ))}
          </div>
        )}
      </GardenScene>

      {(covered.length > 0 || atRisk > 0) && (
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-ink-faint">
          {covered.length > 0 && (
            <span className="flex items-center gap-1.5">
              <IconDrop size={12} className="text-sky" />A dew drop covered yesterday for {covered.map((p) => p.habit.name).join(", ")}.
            </span>
          )}
          {atRisk > 0 && (
            <span>
              {atRisk === 1 ? "One streak still needs" : `${atRisk} streaks still need`} watering tonight.
            </span>
          )}
        </p>
      )}

      {plots.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Today</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {[...plots]
              .sort((a, b) => Number(b.thirsty) - Number(a.thirsty) || Number(a.live.todayDone) - Number(b.live.todayDone))
              .map((p) => (
                <PlantRow key={p.habit.id} info={p} onWater={(h, o) => void water(h, o)} />
              ))}
          </ul>
        </section>
      )}

      {growing.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Growing next</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {growing.map((p) => (
              <div key={p.habit.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5">
                <HabitMark habit={p.habit} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{p.habit.name}</span>
                    <span className="shrink-0 text-[11px] text-ink-faint">
                      {p.stage.next!.left} to {p.stage.next!.label.toLowerCase()}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-paper-deep">
                    <div className="h-full rounded-full bg-sun transition-all" style={{ width: `${Math.round(p.stage.progress * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {suggestions.length > 0 && (
        <section className="mt-8">
          <SectionTitle
            action={
              <button type="button" onClick={() => navigateApp("/garden/seeds")} className="text-xs font-semibold text-sun-deep hover:underline">
                All seeds
              </button>
            }
          >
            {habits.length ? "More to grow" : "Popular seeds"}
          </SectionTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigateApp(`/garden/seeds?plant=${s.id}`)}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-ink-faint/40 hover:shadow-sm"
              >
                <HabitMark habit={{ species: s.species, growth: 30, color: s.color }} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-ink-faint">{s.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {habits.length > 0 && <NudgeSetting />}
    </div>
  );
}

/** The evening nudge, and a way to switch it off: a garden that pesters stops being a garden. */
function NudgeSetting() {
  useGarden();
  const on = gardenStore.nudges();
  return (
    <div className="mt-10 flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-paper-deep text-ink-soft">
        <IconBell size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Evening nudge</span>
        <span className="block text-xs text-ink-faint">One gentle reminder at 8:30pm when a streak of three or more is still unwatered.</span>
      </span>
      <Switch checked={on} onChange={(v) => void gardenStore.setNudges(v)} label="Evening nudge" />
    </div>
  );
}
