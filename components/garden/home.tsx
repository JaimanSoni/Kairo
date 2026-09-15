"use client";

import { useState } from "react";
import { addDays, SEEDS } from "@/lib/habits-shared";
import { JOURNAL_SHOWN } from "@/lib/types";
import { gardenStore } from "@/lib/habits-client";
import { navigateApp } from "../app-views";
import { IconPlus } from "../ui";
import { HabitMark, PillLink, rescueText, SectionTitle, Switch } from "./bits";
import { useClock } from "./fx";
import { IconBell, IconFlame, IconSparkle, IconTrophy } from "./icons";
import { Plant } from "./plants";
import { PlantSheet } from "./plant-sheet";
import { Plot, PlantRow } from "./plot";
import { GardenScene, type Weather } from "./scene";
import { plotOf, useGarden, useGardenActions } from "./use-garden";

/**
 * Habits: what today asks for, one tap each, then the garden those habits
 * grow into. The list is the plain way in; the garden is the picture of it.
 */
export function GardenHome() {
  const { status, habits, archived, today } = useGarden();
  const { moments, water, compost } = useGardenActions();
  const minute = useClock();
  const [creating, setCreating] = useState(false);

  // not memoised on purpose: a plot reads the store's days, which change without `habits` changing
  const plots = habits.map((h) => plotOf(h, today));
  const due = plots.filter((p) => p.live.dueToday || p.live.todayDone);
  const doneToday = due.filter((p) => p.live.todayDone).length;
  const thriving = plots.filter((p) => p.live.health === "thriving").length;
  const weather: Weather = due.length === 0 || doneToday === due.length ? "clear" : doneToday > 0 || minute < 17 * 60 ? "partly" : "cloudy";
  const rescues = plots.filter((p) => p.live.rescue && !p.live.rescue.covered && p.live.rescue.keeps > 0);
  const covered = plots.filter((p) => p.live.rescue?.covered);
  const atRisk = minute >= 18 * 60 ? plots.filter((p) => p.due && p.streak >= 3).length : 0;
  const longest = plots.reduce((n, p) => Math.max(n, p.streak), 0);
  const taken = new Set(habits.map((h) => h.seedId).filter(Boolean));
  const ideas = SEEDS.filter((s) => !taken.has(s.id) && (s.id !== "journal" || JOURNAL_SHOWN)).slice(0, habits.length ? 3 : 6);

  if (status === "loading" || status === "idle") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-8 sm:px-6">
        <div className="h-10 w-40 animate-pulse rounded-xl bg-paper-deep" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-paper-deep" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-md px-6 pb-32 pt-24 text-center">
        <h1 className="font-display text-2xl">Your habits didn&apos;t load</h1>
        <p className="mt-2 text-sm text-ink-soft">Check your connection, then try again.</p>
        <button onClick={() => void gardenStore.reload()} className="mt-5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
          Try again
        </button>
      </div>
    );
  }

  const summary =
    habits.length === 0
      ? "Small things, done most days, until they happen on their own."
      : [due.length ? (doneToday === due.length ? `All ${due.length} done today` : `${doneToday} of ${due.length} done today`) : "Nothing due today", longest > 1 ? `longest streak ${longest}` : null]
          .filter(Boolean)
          .join(" · ");

  const order = (p: (typeof plots)[number]) => (p.due ? 0 : p.live.todayDone ? 2 : 1);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-8 sm:px-6">
      <header className="anim-rise mb-6 flex flex-wrap items-start justify-between gap-x-3 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl">Habits</h1>
          <p className="mt-1 text-sm text-ink-soft" data-habits-summary>
            {summary}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Habits">
          <PillLink href="/habits/ideas" icon={<IconSparkle size={14} />}>
            Ideas
          </PillLink>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-xs font-semibold text-paper transition-colors hover:bg-ink/90"
          >
            <IconPlus size={14} /> New habit
          </button>
        </nav>
      </header>

      {habits.length === 0 ? (
        <FirstHabit onCreate={() => setCreating(true)} />
      ) : (
        <>
          {rescues.length > 0 && (
            <section className="anim-rise mb-4 overflow-hidden rounded-2xl border border-line bg-card" aria-label="Yesterday">
              <div className="border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Did you do these yesterday?</div>
              <ul className="divide-y divide-line">
                {rescues.map((p) => (
                  <li key={p.habit.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-rescue={p.habit.id}>
                    <HabitMark habit={p.habit} stage={p.stage} size={36} />
                    <span className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-0">
                      <span className="block truncate text-sm font-medium">{p.habit.name}</span>
                      <span className="block text-xs text-ink-soft">{rescueText(p.habit, p.live.rescue!.keeps)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void water(p.habit, { date: addDays(today, -1), fill: true })}
                      className="ml-12 h-8 shrink-0 rounded-full bg-ink px-3.5 text-xs font-semibold text-paper transition-colors hover:bg-ink/90 sm:ml-0"
                    >
                      Mark yesterday done
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Today">
            <SectionTitle>Today</SectionTitle>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {[...plots]
                .sort((a, b) => order(a) - order(b))
                .map((p) => (
                  <PlantRow key={p.habit.id} info={p} onWater={(h, o) => void water(h, o)} />
                ))}
            </ul>
            {(covered.length > 0 || atRisk > 0) && (
              <p className="mt-2.5 flex flex-col gap-1 px-1 text-xs text-ink-faint">
                {covered.length > 0 && (
                  <span>
                    A streak saver kept {covered.map((p) => p.habit.name).join(", ")} going after yesterday.
                  </span>
                )}
                {atRisk > 0 && <span>{atRisk === 1 ? "One streak is" : `${atRisk} streaks are`} still waiting for today.</span>}
              </p>
            )}
          </section>

          <section className="mt-8" aria-label="Your garden">
            <SectionTitle>Your garden</SectionTitle>
            <GardenScene weather={weather} thriving={thriving}>
              <div className="relative flex flex-wrap items-end justify-center gap-x-2 gap-y-4 px-2 pb-6 pt-1 sm:gap-x-3 [&>*]:w-[46%] sm:[&>*]:w-[7.75rem]">
                {plots.map((p, i) => (
                  <Plot key={p.habit.id} info={p} index={i} moments={moments} onWater={(h) => void water(h)} />
                ))}
              </div>
            </GardenScene>
            <p className="mt-2 px-1 text-xs text-ink-faint">Each plant grows as its habit gets stronger. Tap one to mark it done.</p>
          </section>

          <HowItWorks />
        </>
      )}

      {ideas.length > 0 && (
        <section className="mt-8">
          <SectionTitle
            action={
              <button type="button" onClick={() => navigateApp("/habits/ideas")} className="text-xs font-semibold text-sun-deep hover:underline">
                All ideas
              </button>
            }
          >
            {habits.length ? "Ideas to try" : "Popular habits"}
          </SectionTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ideas.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigateApp(`/habits/ideas?start=${s.id}`)}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-ink-faint/40 hover:shadow-sm"
              >
                <HabitMark habit={s} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-ink-faint">{s.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <details className="group mt-8" data-archived>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-1 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint hover:text-ink-soft [&::-webkit-details-marker]:hidden">
            <span>Archived · {archived.length}</span>
            <span className="text-xs normal-case tracking-normal group-open:hidden">Show</span>
            <span className="hidden text-xs normal-case tracking-normal group-open:inline">Hide</span>
          </summary>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {archived.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-3 py-2.5">
                <a
                  href={`/habits/${h.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateApp(`/habits/${h.id}`);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <HabitMark habit={h} stage={3} size={32} className="opacity-70" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink-soft">{h.name}</span>
                    <span className="block text-xs text-ink-faint">Done {h.growth} {h.growth === 1 ? "time" : "times"} in all</span>
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => void compost(h, false)}
                  className="h-8 shrink-0 rounded-full border border-line px-3 text-xs font-semibold text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {habits.length > 0 && (
        <div className="mt-8 grid gap-2">
          <ReminderSetting />
          <button
            type="button"
            onClick={() => navigateApp("/habits/community")}
            className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left transition-colors hover:border-ink-faint/40"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-paper-deep text-ink-soft">
              <IconTrophy size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Leaderboards</span>
              <span className="block text-xs text-ink-faint">See how your streaks compare with others doing the same habit.</span>
            </span>
          </button>
        </div>
      )}

      {creating && <PlantSheet onClose={() => setCreating(false)} />}
    </div>
  );
}

/** Before the first habit: what this is, in three lines, and a way to start. */
function FirstHabit({ onCreate }: { onCreate: () => void }) {
  const steps = [
    { title: "Pick something small", body: "Small enough to do on a bad day. Two minutes counts." },
    { title: "Mark it done", body: "One tap on the days you do it. Missed marking? You can still mark yesterday." },
    { title: "Watch it get stronger", body: "Each day you keep it, the habit gets stronger and its plant grows." },
  ];
  return (
    <section className="anim-rise overflow-hidden rounded-2xl border border-line bg-card" data-first-habit>
      <div className="flex items-end justify-center gap-1 bg-moss-soft/60 pt-5">
        {(["tulip", "sunflower", "lavender"] as const).map((s, i) => (
          <Plant key={s} species={s} stage={[3, 5, 4][i]} size={i === 1 ? 104 : 80} phase={i} ground="none" fit="snug" />
        ))}
      </div>
      <div className="p-5">
        <h2 className="font-display text-2xl">Build a habit, one day at a time</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3 sm:flex-col sm:gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-paper">{i + 1}</span>
              <span>
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="mt-0.5 block text-xs text-ink-soft">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={onCreate} className="flex h-9 items-center gap-1.5 rounded-full bg-sun px-4 text-sm font-semibold text-on-accent hover:bg-sun-deep">
            <IconPlus size={14} /> New habit
          </button>
          <button
            type="button"
            onClick={() => navigateApp("/habits/ideas")}
            className="h-9 rounded-full border border-line px-4 text-sm font-semibold text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
          >
            Browse ideas
          </button>
        </div>
      </div>
    </section>
  );
}

/** Every word the page uses, explained once. */
function HowItWorks() {
  const rows: { term: React.ReactNode; body: string }[] = [
    { term: "Done", body: "Tap the circle on the days you do it. Tap again to take it back." },
    {
      term: (
        <span className="inline-flex items-center gap-1">
          <IconFlame size={12} className="text-clay" /> Streak
        </span>
      ),
      body: "How many scheduled days (or weeks) in a row you've kept it. Forgot to mark yesterday? You have until the end of today.",
    },
    { term: "Strength", body: "How rooted the habit is. Every day you keep it adds a little, every miss takes a little away. Most habits take about two months to feel automatic." },
    { term: "Plant", body: "Grows with strength: a sprout while it's new, in bloom once it's rooted." },
    { term: "Streak saver", body: "Every 7 in a row earns one, up to 3. A missed day uses one, and your streak carries on." },
  ];
  return (
    <details className="group mt-4 rounded-2xl border border-line bg-card" data-how-it-works>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        How habits work
        <span className="text-xs text-ink-faint group-open:hidden">Show</span>
        <span className="hidden text-xs text-ink-faint group-open:inline">Hide</span>
      </summary>
      <dl className="grid gap-3 border-t border-line px-4 py-3">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-0.5 sm:grid-cols-[7.5rem_1fr] sm:gap-3">
            <dt className="text-xs font-semibold text-ink">{r.term}</dt>
            <dd className="text-xs text-ink-soft">{r.body}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** The evening reminder, and a way to switch it off. */
function ReminderSetting() {
  useGarden();
  const on = gardenStore.nudges();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-paper-deep text-ink-soft">
        <IconBell size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Evening reminder</span>
        <span className="block text-xs text-ink-faint">At 8:30pm, if a streak of 3 or more isn&apos;t marked done yet.</span>
      </span>
      <Switch checked={on} onChange={(v) => void gardenStore.setNudges(v)} label="Evening reminder" />
    </div>
  );
}
