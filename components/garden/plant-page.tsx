"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDays,
  MAX_DROPS,
  mondayOf,
  nextLevel,
  scheduleLabel,
  seedOf,
  STRENGTH_LEVELS,
  weekdayOf,
  type Board,
  type HabitLogView,
  type HabitView,
} from "@/lib/habits-shared";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import { navigateApp } from "../app-views";
import { IconTrash } from "../ui";
import { DeleteHabitDialog } from "./delete-habit";
import { Burst, Moment, WaterPour } from "./fx";
import { IconDrop, IconFlame, IconTick, IconTrophy } from "./icons";
import { Plant } from "./plants";
import { PlantSheet } from "./plant-sheet";
import { GardenScene } from "./scene";
import { Avatar, BackLink, RankBadge, rescueText, SectionTitle, Stat } from "./bits";
import { plotOf, useGarden, useGardenActions } from "./use-garden";

/** One habit up close: today, how strong it is, its history and its board. */
export function PlantPage({ id }: { id: string }) {
  const { status, today } = useGarden();
  const habit = status === "ready" ? gardenStore.get(id) : null;

  if (status === "loading" || status === "idle") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-8 sm:px-6">
        <div className="h-8 w-24 animate-pulse rounded-xl bg-paper-deep" />
        <div className="mt-4 h-80 animate-pulse rounded-[1.75rem] bg-paper-deep" />
      </div>
    );
  }
  if (!habit) {
    return (
      <div className="mx-auto max-w-md px-6 pb-32 pt-24 text-center">
        <h1 className="font-display text-2xl">This habit isn&apos;t here</h1>
        <p className="mt-2 text-sm text-ink-soft">It may have been deleted, or it belongs to someone else.</p>
        <button onClick={() => navigateApp("/habits")} className="mt-5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
          Back to Habits
        </button>
      </div>
    );
  }
  return <PlantDetail key={habit.id} habit={habit} today={today} />;
}

const WEEK_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function PlantDetail({ habit, today }: { habit: HabitView; today: string }) {
  const { moments, water, compost } = useGardenActions();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [history, setHistory] = useState<HabitLogView[] | null>(null);
  const info = plotOf(habit, today);
  const { live, stage, streak } = info;
  const weekly = habit.schedule.kind === "weekly";
  const seed = seedOf(habit.seedId);
  const archived = Boolean(habit.archivedAt);
  const m = moments[habit.id] ?? { water: 0, burst: 0 };
  const best = Math.max(live.best, habit.settled.best, streak);
  const counted = habit.target > 1;

  const from = addDays(mondayOf(today), -7 * 25);
  useEffect(() => {
    let alive = true;
    void gardenApi.history(habit.id, from, today).then((r) => {
      if (alive && r.ok) setHistory(r.data.logs);
    });
    return () => {
      alive = false;
    };
    // refetch after a day is marked, so the history keeps up
  }, [habit.id, from, today, habit.growth]);

  const done = { set: new Set<string>(), frozen: new Set<string>() };
  for (const l of history ?? []) {
    if (l.done) done.set.add(l.date);
    else if (l.frozen) done.frozen.add(l.date);
  }
  // the store's recent days are fresher than the fetched history
  for (const [date, l] of gardenStore.logs(habit.id)) {
    if (l.done) done.set.add(date);
    else done.set.delete(date);
    if (l.frozen && !l.done) done.frozen.add(date);
  }

  const week = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(today), i));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <div className="flex items-center justify-between gap-2">
        <BackLink href="/habits" label="Habits" />
        <div className="flex items-center gap-2">
          {!archived && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex h-9 items-center rounded-full border border-line bg-card px-3.5 text-xs font-semibold text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => setDeleting(true)}
            aria-label="Delete habit"
            title="Delete habit"
            className="grid size-9 place-items-center rounded-full border border-line bg-card text-ink-faint transition-colors hover:border-clay/50 hover:text-clay"
          >
            <IconTrash size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <GardenScene weather={info.due ? "partly" : "clear"} thriving={live.health === "thriving" ? 3 : live.health === "healthy" ? 1 : 0} compact>
          <div className="relative flex flex-col items-center pb-5">
            <button
              type="button"
              disabled={archived}
              onClick={() => void water(habit)}
              aria-label={archived ? habit.name : live.todayDone && !counted ? `Unmark ${habit.name}` : `Mark ${habit.name} done`}
              className="relative -mt-16 rounded-[3rem] outline-none focus-visible:ring-4 focus-visible:ring-white/60 disabled:cursor-default"
            >
              <span className={`block ${m.water ? "gd-perk" : ""}`} key={`perk-${m.water}`}>
                <Plant species={habit.species} stage={stage} health={info.due && live.health === "thriving" ? "healthy" : live.health} size={200} fit="snug" />
              </span>
              <Moment id={m.water} ms={1300}>
                <WaterPour />
              </Moment>
              <Moment id={m.burst} ms={1200}>
                <Burst count={26} />
              </Moment>
            </button>
          </div>
        </GardenScene>
      </div>

      <header className="mt-6">
        <h1 className="font-display break-words text-4xl">{habit.name}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {scheduleLabel(habit.schedule)}
          {counted && ` · ${habit.target}${habit.unit ? ` ${habit.unit}` : " times"} a day`}
          {habit.reminder && ` · reminder at ${habit.reminder}`}
        </p>
        {habit.why && <p className="font-display mt-3 text-lg italic text-ink-soft">&ldquo;{habit.why}&rdquo;</p>}
      </header>

      {archived ? (
        <div className="mt-5 rounded-2xl border border-line bg-card p-4" data-archived-card>
          <p className="text-sm text-ink-soft">This habit is archived. It&apos;s off your list and sends no reminders. Its history is kept.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void compost(habit, false)} className="h-9 rounded-full bg-ink px-4 text-sm font-semibold text-paper">
              Restore
            </button>
            <button type="button" onClick={() => setDeleting(true)} className="h-9 rounded-full border border-line px-4 text-sm font-semibold text-clay">
              Delete forever
            </button>
          </div>
        </div>
      ) : (
        <>
          {live.rescue && !live.rescue.covered && live.rescue.keeps > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
              <p className="text-sm text-ink-soft">{rescueText(habit, live.rescue.keeps)}</p>
              <button type="button" onClick={() => void water(habit, { date: addDays(today, -1), fill: true })} className="h-8 rounded-full bg-ink px-3.5 text-xs font-semibold text-paper">
                Mark yesterday done
              </button>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {counted ? (
              <div className="flex items-center gap-1 rounded-full border border-line bg-card p-1">
                <button type="button" onClick={() => void water(habit, { step: -1 })} disabled={live.todayCount === 0} className="grid size-9 place-items-center rounded-full text-lg text-ink-soft hover:bg-paper-deep disabled:opacity-30" aria-label="One less">
                  −
                </button>
                <span className="min-w-24 text-center text-sm font-semibold tabular-nums">
                  {live.todayCount} of {habit.target} {habit.unit}
                </span>
                <button
                  type="button"
                  onClick={() => void water(habit, { step: 1 })}
                  className={`grid size-9 place-items-center rounded-full ${live.todayDone ? "bg-moss text-white" : "bg-sun text-on-accent"}`}
                  aria-label="One more"
                >
                  {live.todayDone ? <IconTick size={14} /> : <span className="text-lg font-semibold leading-none">+</span>}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void water(habit)}
                aria-pressed={live.todayDone}
                className={`flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-all active:scale-95 ${
                  live.todayDone ? "border border-moss/30 bg-moss-soft text-moss" : "bg-sun text-on-accent shadow-sm shadow-sun/25 hover:bg-sun-deep"
                }`}
              >
                <IconTick size={14} />
                {live.todayDone ? "Done today" : "Mark done"}
              </button>
            )}
            {!live.dueToday && !live.todayDone && <span className="text-sm text-ink-faint">{weekly ? "This week is already met." : "Nothing due today."}</span>}
          </div>
        </>
      )}

      <StrengthCard strength={info.strength} weekly={weekly} />

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat value={streak} label={weekly ? "Week streak" : "Day streak"} icon={<IconFlame size={13} className="text-clay" />} />
        <Stat value={best} label="Best streak" icon={<IconTrophy size={13} />} />
        <Stat value={habit.growth} label="Times done" icon={<IconTick size={13} className="text-moss" />} />
        <Stat value={`${live.drops} of ${MAX_DROPS}`} label="Streak savers" icon={<IconDrop size={13} className="text-sky" />} />
      </div>
      <p className="mt-2 px-1 text-xs text-ink-faint">You earn a streak saver for every 7 in a row. If you miss a day, one is used and your streak carries on.</p>

      <section className="mt-8">
        <SectionTitle>This week</SectionTitle>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const isDone = done.set.has(d);
            const isFrozen = done.frozen.has(d);
            const future = d > today;
            const before = d < habit.startDate;
            return (
              <div
                key={d}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 ${d === today ? "border-sun/60 bg-sun-soft/40" : "border-line bg-card"}`}
              >
                <span className="text-[10px] font-semibold text-ink-faint">{WEEK_LETTERS[weekdayOf(d)]}</span>
                <span
                  className={`grid size-6 place-items-center rounded-full ${isDone ? "bg-moss text-white" : isFrozen ? "bg-sky-soft text-sky" : ""}`}
                  aria-label={isDone ? "done" : isFrozen ? "covered by a streak saver" : future || before ? "" : "not done"}
                >
                  {isDone ? <IconTick size={11} /> : isFrozen ? <IconDrop size={12} /> : <span className={`block rounded-full ${future || before ? "size-1 bg-line" : "size-1.5 bg-ink-faint/40"}`} />}
                </span>
              </div>
            );
          })}
        </div>
        {live.week && (
          <p className="mt-2 text-xs text-ink-soft">
            {live.week.done} of {live.week.times} this week{live.week.done >= live.week.times ? ". This week is met." : ""}
          </p>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle>Last 26 weeks</SectionTitle>
        <Heatmap from={from} today={today} startDate={habit.startDate} done={done.set} frozen={done.frozen} loading={history === null} />
      </section>

      {seed && !archived && <BoardCard seedId={seed.id} seedName={seed.name} weekly={weekly} />}

      {!archived && (
        <section className="mt-10 border-t border-line pt-5" aria-label="Stop this habit" data-manage>
          <SectionTitle>Stop this habit</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void compost(habit, true).then((ok) => ok && navigateApp("/habits"))}
              className="rounded-2xl border border-line bg-card px-4 py-3 text-left transition-colors hover:border-ink-faint/50"
            >
              <span className="block text-sm font-semibold text-ink">Archive habit</span>
              <span className="mt-0.5 block text-xs text-ink-faint">Off your list, no reminders. History kept; restore it any time.</span>
            </button>
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="rounded-2xl border border-clay/30 bg-card px-4 py-3 text-left transition-colors hover:border-clay/60 hover:bg-clay-soft/40"
            >
              <span className="block text-sm font-semibold text-clay">Delete habit</span>
              <span className="mt-0.5 block text-xs text-ink-faint">Removes it and every day you marked. Can&apos;t be undone.</span>
            </button>
          </div>
        </section>
      )}

      {editing && <PlantSheet habit={habit} onClose={() => setEditing(false)} />}
      {deleting && (
        <DeleteHabitDialog
          habit={habit}
          onClose={() => setDeleting(false)}
          onDone={() => {
            setDeleting(false);
            navigateApp("/habits");
          }}
        />
      )}
    </div>
  );
}

/** How rooted the habit is, what that means, and what's next. */
function StrengthCard({ strength, weekly }: { strength: number; weekly: boolean }) {
  const next = nextLevel(strength, weekly);
  const level = STRENGTH_LEVELS.reduce((cur, l) => (strength >= l.min ? l : cur), STRENGTH_LEVELS[0]);
  const unit = weekly ? (next?.left === 1 ? "week" : "weeks") : next?.left === 1 ? "day" : "days";
  return (
    <section className="mt-8 rounded-2xl border border-line bg-card p-4" aria-label="Strength" data-strength={strength}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Strength</h2>
        <span className="text-xs font-semibold text-moss" data-level={level.id}>
          {level.label}
        </span>
      </div>
      <div className="font-display mt-1 text-4xl leading-none tabular-nums">{strength}%</div>
      <div className="relative mt-3 h-2 rounded-full bg-paper-deep" aria-hidden>
        <div className="h-full rounded-full bg-moss transition-[width] duration-500" style={{ width: `${strength}%` }} />
        {STRENGTH_LEVELS.slice(1).map((l) => (
          <span key={l.id} className="absolute top-0 h-2 w-0.5 bg-card" style={{ left: `${l.min}%` }} />
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-soft">
        {next
          ? `About ${next.left} more ${unit} in a row to reach “${next.level.label}”.`
          : "Rooted. This habit is part of your routine now. Keep it going and it stays that way."}
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        Strength rises a little every {weekly ? "week you meet" : "day you keep"} it and dips a little when you miss. Most habits take about two months to feel automatic.
      </p>
    </section>
  );
}

function Heatmap({ from, today, startDate, done, frozen, loading }: { from: string; today: string; startDate: string; done: Set<string>; frozen: Set<string>; loading: boolean }) {
  const weeks = Array.from({ length: 26 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(from, w * 7 + d)));
  // on a narrow screen the newest weeks are the ones worth seeing first
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [loading]);
  return (
    <div className={`rounded-2xl border border-line bg-card p-4 ${loading ? "animate-pulse" : ""}`}>
      <div ref={scroller} className="no-scrollbar overflow-x-auto">
        <div className="grid min-w-[30rem] grid-flow-col grid-cols-[repeat(26,minmax(0,1fr))] grid-rows-7 gap-[3px]" role="img" aria-label={`Done on ${done.size} days in the last 26 weeks`}>
          {weeks.flat().map((d) => (
            <span
              key={d}
              title={d}
              className={`block aspect-square rounded-[3px] ${
                d > today ? "bg-transparent" : done.has(d) ? "bg-moss" : frozen.has(d) ? "bg-sky/60" : d < startDate ? "bg-paper-deep/50" : "bg-line"
              } ${d === today ? "ring-1 ring-sun ring-offset-1 ring-offset-card" : ""}`}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-moss" /> Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-sky/60" /> Covered by a streak saver
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-line" /> Not done
        </span>
      </div>
    </div>
  );
}

/** A habit's leaderboard, in brief. */
export function BoardCard({ seedId, seedName, weekly = false }: { seedId: string; seedName: string; weekly?: boolean }) {
  const { gardener } = useGarden();
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    let alive = true;
    void gardenApi.board(seedId, "global").then((r) => {
      if (alive && r.ok) setBoard(r.data);
    });
    return () => {
      alive = false;
    };
  }, [seedId]);

  if (!board) return null;
  const top = board.rows.slice(0, 3);
  const me = board.me;
  const above = me ? [...board.rows].reverse().find((r) => r.streak > me.streak) : null;
  const gap = above && me ? above.streak - me.streak + 1 : 0;
  return (
    <section className="mt-8">
      <SectionTitle
        action={
          <button type="button" onClick={() => navigateApp(`/habits/community?seed=${seedId}`)} className="text-xs font-semibold text-sun-deep hover:underline">
            Full leaderboard
          </button>
        }
      >
        {seedName} leaderboard
      </SectionTitle>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        {top.length === 0 ? (
          <p className="px-4 py-3 text-sm text-ink-soft">Nobody public on this leaderboard yet. The top spot is open.</p>
        ) : (
          <ol className="divide-y divide-line">
            {top.map((r) => (
              <li key={`${r.rank}-${r.name}`} className={`flex items-center gap-3 px-4 py-2.5 ${r.me ? "bg-sun-soft/50" : ""}`}>
                <RankBadge rank={r.rank} />
                <Avatar animal={r.animal} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {r.name}
                  {r.me && <span className="ml-1.5 text-xs font-normal text-ink-faint">you</span>}
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                  <IconFlame size={13} className="text-clay" />
                  {r.streak}
                </span>
              </li>
            ))}
          </ol>
        )}
        {me && (
          <p className="border-t border-line px-4 py-2.5 text-xs text-ink-soft">
            {me.rank === 1 && board.rows.length > 0 && gardener?.public ? "You're at the top. Keep it that way." : `You'd be #${me.rank} of ${Math.max(board.gardeners, me.rank)}.`}{" "}
            {above && `${gap} more ${weekly ? (gap === 1 ? "week" : "weeks") : gap === 1 ? "day" : "days"} to pass ${above.name}.`}
            {!gardener?.public && (
              <button type="button" onClick={() => navigateApp("/habits/community")} className="ml-1 font-semibold text-sun-deep hover:underline">
                Join the leaderboard
              </button>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
