"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDays,
  fruitsEarned,
  GOLDEN_STREAKS,
  mondayOf,
  nextFruitAt,
  nextGoldenAt,
  scheduleLabel,
  seedOf,
  speciesOf,
  STAGES,
  weekdayOf,
  type Board,
  type HabitLogView,
  type HabitView,
} from "@/lib/habits-shared";
import { gardenApi, gardenStore } from "@/lib/habits-client";
import { useApp } from "../store";
import { navigateApp } from "../app-views";
import { Burst, Moment, WaterPour } from "./fx";
import { Plant } from "./plants";
import { PlantSheet } from "./plant-sheet";
import { GardenScene } from "./scene";
import { Avatar, BackLink, rescueText, SectionTitle, Stat } from "./bits";
import { plotOf, useGarden, useGardenActions } from "./use-garden";

/** One plant up close: how it's growing, its fruit, its history and its board. */
export function PlantPage({ id }: { id: string }) {
  const { status, today } = useGarden();
  const habit = status === "ready" ? gardenStore.get(id) : null;

  if (status === "loading" || status === "idle") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6">
        <div className="h-8 w-24 animate-pulse rounded-xl bg-paper-deep" />
        <div className="mt-4 h-80 animate-pulse rounded-[1.75rem] bg-paper-deep" />
      </div>
    );
  }
  if (!habit) {
    return (
      <div className="mx-auto max-w-md px-6 pb-32 pt-24 text-center">
        <div className="text-4xl">🍂</div>
        <h1 className="font-display mt-3 text-2xl">This plant isn&apos;t here</h1>
        <p className="mt-2 text-sm text-ink-soft">It may have been deleted, or it belongs to another garden.</p>
        <button onClick={() => navigateApp("/garden")} className="mt-5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper">
          Back to the garden
        </button>
      </div>
    );
  }
  return <PlantDetail key={habit.id} habit={habit} today={today} />;
}

function PlantDetail({ habit, today }: { habit: HabitView; today: string }) {
  const { showToast } = useApp();
  const { moments, water, pick, compost } = useGardenActions();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [history, setHistory] = useState<HabitLogView[] | null>(null);
  const info = plotOf(habit, today);
  const { live, stage, ripe, golden, thirsty } = info;
  const species = speciesOf(habit.species);
  const seed = seedOf(habit.seedId);
  const archived = Boolean(habit.archivedAt);
  const m = moments[habit.id] ?? { water: 0, burst: 0, golden: false };
  const best = Math.max(live.best, habit.settled.best);

  const from = addDays(mondayOf(today), -7 * 25);
  useEffect(() => {
    let alive = true;
    void gardenApi.history(habit.id, from, today).then((r) => {
      if (alive && r.ok) setHistory(r.data.logs);
    });
    return () => {
      alive = false;
    };
    // refetch after a watering changes growth, so the heatmap keeps up
  }, [habit.id, from, today, habit.growth]);

  const done = { set: new Set<string>(), frozen: new Set<string>() };
  for (const l of history ?? []) {
    if (l.done) done.set.add(l.date);
    else if (l.frozen) done.frozen.add(l.date);
  }
  // the store's recent logs are fresher than the fetched history
  for (const [date, l] of gardenStore.logs(habit.id)) {
    if (l.done) done.set.add(date);
    else done.set.delete(date);
    if (l.frozen && !l.done) done.frozen.add(date);
  }

  const week = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(today), i));
  const toFruit = nextFruitAt(habit.growth) - habit.growth;
  const toGolden = nextGoldenAt(best);

  const removeForever = async () => {
    const r = await gardenApi.deleteForever(habit.id);
    if (!r.ok) {
      showToast({ message: r.kind === "invalid" ? r.message : "Couldn't delete that just now." });
      return;
    }
    gardenStore.remove(habit.id);
    showToast({ message: `${habit.name} is gone for good.` });
    navigateApp("/garden");
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <div className="flex items-center justify-between">
        <BackLink href="/garden" label="Garden" />
        {!archived && (
          <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-line bg-card px-3 py-1 text-sm font-semibold text-ink-soft hover:border-sun hover:text-sun-deep">
            Edit
          </button>
        )}
      </div>

      <div className="mt-3">
        <GardenScene weather={thirsty ? "partly" : "clear"} thriving={live.health === "thriving" ? 3 : live.health === "healthy" ? 1 : 0} compact>
          <div className="relative flex flex-col items-center pb-5">
            <button
              type="button"
              disabled={archived}
              onClick={() => void water(habit)}
              aria-label={archived ? habit.name : live.todayDone && habit.target === 1 ? `Unwater ${habit.name}` : `Water ${habit.name}`}
              className="relative -mt-16 rounded-[3rem] outline-none focus-visible:ring-4 focus-visible:ring-white/60 disabled:cursor-default"
            >
              <span className={`block ${m.water ? "gd-perk" : ""}`} key={`perk-${m.water}`}>
                <Plant
                  species={habit.species}
                  stage={stage.index}
                  health={thirsty && live.health === "thriving" ? "healthy" : live.health}
                  ripe={ripe}
                  golden={golden}
                  size={200}
                />
              </span>
              <Moment id={m.water} ms={1300}>
                <WaterPour />
              </Moment>
              <Moment id={m.burst} ms={1200}>
                <Burst golden={m.golden} count={26} />
              </Moment>
            </button>
            {(ripe > 0 || golden > 0) && !archived && (
              <div className="-mt-2 flex gap-2">
                {golden > 0 && (
                  <button type="button" onClick={() => void pick(habit, "golden")} className="gd-pick rounded-full bg-[#ffd23f] px-3.5 py-1.5 text-sm font-bold text-[#6b4a00] shadow-lg">
                    ✨ Pick golden fruit
                  </button>
                )}
                {ripe > 0 && (
                  <button type="button" onClick={() => void pick(habit, "fruit")} className="gd-pick rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-ink shadow-lg">
                    {species.fruitEmoji} Pick {ripe > 1 ? `${ripe} ripe` : "ripe fruit"}
                  </button>
                )}
              </div>
            )}
          </div>
        </GardenScene>
      </div>

      <header className="mt-5">
        <h1 className="font-display flex items-center gap-2 text-3xl sm:text-4xl">
          <span aria-hidden>{habit.emoji}</span>
          <span className="min-w-0 break-words">{habit.name}</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {species.label} · {stage.label} · {scheduleLabel(habit.schedule)}
          {habit.target > 1 && ` · ${habit.target}${habit.unit ? ` ${habit.unit}` : " times"} a day`}
          {habit.reminder && ` · ⏰ ${habit.reminder}`}
        </p>
        {habit.why && <p className="mt-2 text-[15px] italic text-ink-soft">“{habit.why}”</p>}
      </header>

      {archived ? (
        <div className="mt-5 rounded-2xl border border-line bg-card p-4">
          <p className="text-sm text-ink-soft">This plant is resting in the compost. Its growth and fruit are kept.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void compost(habit, false)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
              🌱 Replant it
            </button>
            {confirmDelete ? (
              <button type="button" onClick={() => void removeForever()} className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white">
                Yes, delete its whole history
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-clay">
                Delete forever
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {live.rescue && !live.rescue.covered && live.rescue.keeps > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sun/40 bg-sun-soft/60 px-4 py-2.5">
              <p className="text-sm">{rescueText(habit, live.rescue.keeps)}</p>
              <button type="button" onClick={() => void water(habit, { date: addDays(today, -1), fill: true })} className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper">
                Water yesterday
              </button>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {habit.target > 1 ? (
              <div className="flex items-center gap-2 rounded-full border border-line bg-card p-1">
                <button type="button" onClick={() => void water(habit, { step: -1 })} disabled={live.todayCount === 0} className="grid size-10 place-items-center rounded-full text-lg text-ink-soft disabled:opacity-30" aria-label="One less">
                  −
                </button>
                <span className="min-w-20 text-center text-sm font-semibold">
                  {live.todayCount} / {habit.target} {habit.unit}
                </span>
                <button type="button" onClick={() => void water(habit, { step: 1 })} className={`grid size-10 place-items-center rounded-full text-lg font-bold text-white ${live.todayDone ? "bg-moss" : "bg-sky"}`} aria-label="One more">
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void water(habit)}
                aria-pressed={live.todayDone}
                className={`rounded-full px-5 py-2.5 text-sm font-bold shadow-sm transition-transform active:scale-95 ${live.todayDone ? "bg-moss text-white" : "bg-sky text-white"}`}
              >
                {live.todayDone ? "✓ Watered today" : "💧 Water today"}
              </button>
            )}
            {!live.dueToday && !live.todayDone && <span className="text-sm text-ink-faint">Resting today — nothing due.</span>}
          </div>
        </>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat value={`🔥 ${live.streak}`} label={habit.schedule.kind === "weekly" ? "week streak" : "day streak"} tone="text-clay" />
        <Stat value={best} label="best streak" />
        <Stat value={`💧 ${live.drops}`} label="dew drops (max 3)" tone="text-sky" />
        <Stat value={habit.growth} label="times watered" tone="text-moss" />
      </div>

      <section className="mt-6">
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
                className={`flex flex-col items-center rounded-xl border py-2 text-xs ${d === today ? "border-sun" : "border-line"} ${isDone ? "bg-moss-soft" : isFrozen ? "bg-sky-soft" : "bg-card"}`}
              >
                <span className="font-semibold text-ink-faint">{["S", "M", "T", "W", "T", "F", "S"][weekdayOf(d)]}</span>
                <span className="mt-1 text-base" aria-label={isDone ? "watered" : isFrozen ? "covered by a dew drop" : future || before ? "" : "not watered"}>
                  {isDone ? "💧" : isFrozen ? "❄️" : future || before ? "·" : "–"}
                </span>
              </div>
            );
          })}
        </div>
        {live.week && (
          <p className="mt-2 text-xs text-ink-soft">
            {live.week.done} of {live.week.times} this week{live.week.done >= live.week.times ? " — the week is kept 🎉" : ""}
          </p>
        )}
      </section>

      <section className="mt-6">
        <SectionTitle>Growth</SectionTitle>
        <div className="rounded-2xl border border-line bg-card p-4">
          <div className="flex items-end justify-between gap-1">
            {STAGES.map((s, i) => (
              <div key={s.id} className="flex min-w-0 flex-1 flex-col items-center">
                <div className={i <= stage.index ? "" : "opacity-30 grayscale"}>
                  <Plant species={habit.species} stage={i} size={i === stage.index ? 52 : 38} sway={false} ground="none" fit="tight" />
                </div>
                <span className={`mt-0.5 hidden truncate text-[10px] sm:block ${i === stage.index ? "font-bold text-ink" : "text-ink-faint"}`}>{s.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-deep">
            <div className="h-full rounded-full bg-gradient-to-r from-moss to-sun transition-all" style={{ width: `${Math.round(((stage.index + stage.progress) / (STAGES.length - 1)) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {stage.next ? `${stage.next.left} more ${stage.next.left === 1 ? "watering" : "waterings"} to ${stage.next.label.toLowerCase()}.` : "Fully grown. It keeps bearing fruit as you keep watering."}
          </p>
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle>Fruit</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-2xl">{species.fruitEmoji}</span> {fruitsEarned(habit.growth)} {species.fruit.toLowerCase()} grown
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              {habit.harvested.fruit} picked{ripe > 0 ? `, ${ripe} ripe now` : ""}. The next ripens in {toFruit} {toFruit === 1 ? "watering" : "waterings"}.
            </p>
          </div>
          <div className="gd-golden-card rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-2xl">✨</span> Golden fruit
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              Ripens on a best streak of {GOLDEN_STREAKS.join(", ")}.{" "}
              {toGolden ? `${toGolden - best} more in a row for the next.` : "You've grown every golden fruit there is."}
              {habit.harvested.golden > 0 && ` ${habit.harvested.golden} picked.`}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle>Last 26 weeks</SectionTitle>
        <Heatmap from={from} today={today} startDate={habit.startDate} done={done.set} frozen={done.frozen} loading={history === null} />
      </section>

      {seed && !archived && <BoardCard seedId={seed.id} seedName={seed.name} />}

      {!archived && (
        <div className="mt-8 border-t border-line pt-4">
          <button type="button" onClick={() => void compost(habit, true).then((ok) => ok && navigateApp("/garden"))} className="text-sm font-medium text-ink-faint hover:text-clay">
            Move to compost
          </button>
          <p className="mt-1 text-xs text-ink-faint">Stops reminders and takes it off the ground. Growth and fruit are kept, and you can replant it.</p>
        </div>
      )}

      {editing && <PlantSheet habit={habit} onClose={() => setEditing(false)} />}
    </div>
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
    <div ref={scroller} className={`no-scrollbar overflow-x-auto rounded-2xl border border-line bg-card p-3 ${loading ? "animate-pulse" : ""}`}>
      <div className="flex min-w-max gap-[3px]" role="img" aria-label={`${done.size} days watered in the last 26 weeks`}>
        {weeks.map((days, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {days.map((d) => (
              <span
                key={d}
                title={d}
                className={`block size-3 rounded-[3px] ${
                  d > today ? "bg-transparent" : done.has(d) ? "bg-moss" : frozen.has(d) ? "bg-sky/60" : d < startDate ? "bg-paper-deep/50" : "bg-line"
                } ${d === today ? "ring-1 ring-sun" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-ink-faint">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-moss" /> watered
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-sky/60" /> dew drop
        </span>
      </div>
    </div>
  );
}

/** A plant's leaderboard, in brief. */
export function BoardCard({ seedId, seedName }: { seedId: string; seedName: string }) {
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
  return (
    <section className="mt-6">
      <SectionTitle
        action={
          <button type="button" onClick={() => navigateApp(`/garden/community?seed=${seedId}`)} className="text-xs font-semibold text-sun-deep">
            Full board →
          </button>
        }
      >
        {seedName} leaderboard
      </SectionTitle>
      <div className="rounded-2xl border border-line bg-card p-3">
        {top.length === 0 ? (
          <p className="px-1 py-2 text-sm text-ink-soft">No public gardeners on this board yet. Be the first.</p>
        ) : (
          <ol className="space-y-1">
            {top.map((r) => (
              <li key={`${r.rank}-${r.name}`} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${r.me ? "bg-sun-soft" : ""}`}>
                <span className="w-6 text-center text-sm">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
                <Avatar animal={r.animal} size={26} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
                <span className="text-sm font-bold">🔥 {r.streak}</span>
              </li>
            ))}
          </ol>
        )}
        {me && (
          <p className="mt-2 border-t border-line px-1 pt-2 text-xs text-ink-soft">
            {me.rank === 1 && board.rows.length > 0 && gardener?.public
              ? "You're at the top. Keep it that way."
              : `You'd be #${me.rank} of ${Math.max(board.gardeners, me.rank)}.`}{" "}
            {above && `${above.streak - me.streak + 1} more ${above.streak - me.streak + 1 === 1 ? "day" : "days"} to pass ${above.name}.`}
            {!gardener?.public && (
              <button type="button" onClick={() => navigateApp("/garden/community")} className="ml-1 font-semibold text-sun-deep">
                Join the board
              </button>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
