"use client";

import { scheduleLabel, speciesOf, type HabitView } from "@/lib/habits-shared";
import { navigateApp } from "../app-views";
import { Burst, Moment, WaterPour } from "./fx";
import { Plant } from "./plants";
import type { Moments, PlotInfo } from "./use-garden";

const RING: Record<string, string> = {
  sun: "#0c9384",
  amber: "#d8a03e",
  rose: "#d96354",
  lilac: "#8d7bd4",
  sky: "#4e93c9",
  moss: "#4ca75b",
};

/** One plant on the ground: tap it to water, tap its sign to open it, tap ripe fruit to pick. */
export function Plot({
  info,
  index,
  moments,
  onWater,
  onPick,
  size = 112,
}: {
  info: PlotInfo;
  index: number;
  moments: Moments;
  onWater: (h: HabitView) => void;
  onPick: (h: HabitView, kind: "fruit" | "golden") => void;
  size?: number;
}) {
  const { habit, live, stage, ripe, golden, thirsty } = info;
  const m = moments[habit.id] ?? { water: 0, burst: 0, golden: false };
  const counted = habit.target > 1;
  const progress = counted ? Math.min(1, live.todayCount / habit.target) : live.todayDone ? 1 : 0;
  const label = `${habit.name}: ${live.todayDone ? "watered today" : thirsty ? "needs water" : "resting today"}, ${live.streak}-day streak`;
  // a plant that thrives but hasn't been watered today looks a touch thirsty, never worse than it is
  const look = thirsty && live.health === "thriving" ? "healthy" : live.health;

  return (
    <div className="gd-plot relative flex flex-col items-center" data-habit={habit.id}>
      <button
        type="button"
        onClick={() => onWater(habit)}
        aria-label={`Water ${label}`}
        className="group relative block rounded-[2rem] outline-none focus-visible:ring-4 focus-visible:ring-white/60"
      >
        <span className={`block transition-transform duration-200 group-active:scale-95 ${m.water ? "gd-perk" : ""}`} key={`perk-${m.water}`}>
          <Plant
            species={habit.species}
            stage={stage.index}
            health={look}
            ripe={ripe}
            golden={golden}
            size={size}
            phase={index * 0.7}
            fit="snug"
            className="h-auto w-[5.75rem] sm:w-[7rem]"
          />
        </span>
        {/* one badge, top right: thirsty, counting, or done */}
        {live.todayDone ? (
          <span className="absolute right-0 top-3 grid size-7 place-items-center rounded-full bg-moss text-xs font-bold text-white shadow-md ring-2 ring-white/80" aria-hidden>
            ✓
          </span>
        ) : counted && live.todayCount > 0 ? (
          <span className="absolute right-0 top-3 grid size-8 place-items-center rounded-full bg-white shadow-md" aria-hidden>
            <svg className="absolute inset-0" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="13" fill="none" stroke="#e3eef6" strokeWidth="3" />
              <circle
                cx="16"
                cy="16"
                r="13"
                fill="none"
                stroke={RING[habit.color] ?? RING.sky}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${progress * 81.7} 81.7`}
                transform="rotate(-90 16 16)"
                className="transition-[stroke-dasharray] duration-500"
              />
            </svg>
            <span className="relative text-[10px] font-bold text-ink">
              {live.todayCount}/{habit.target}
            </span>
          </span>
        ) : thirsty ? (
          <span className="gd-thirst absolute right-0 top-3 grid size-7 place-items-center rounded-full bg-white/90 text-sm shadow-md" aria-hidden>
            💧
          </span>
        ) : null}
        <Moment id={m.water} ms={1300}>
          <WaterPour />
        </Moment>
        <Moment id={m.burst} ms={1200}>
          <Burst golden={m.golden} />
        </Moment>
      </button>

      {(ripe > 0 || golden > 0) && (
        <button
          type="button"
          onClick={() => onPick(habit, golden > 0 ? "golden" : "fruit")}
          className={`gd-pick absolute top-1 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-lg ${golden > 0 ? "bg-[#ffd23f] text-[#6b4a00]" : "bg-white text-ink"}`}
          aria-label={`Pick ${golden > 0 ? "a golden fruit" : `a ${speciesOf(habit.species).fruit.toLowerCase()}`} from ${habit.name}`}
        >
          {golden > 0 ? "✨" : speciesOf(habit.species).fruitEmoji} Pick
        </button>
      )}

      <a
        href={`/garden/${habit.id}`}
        onClick={(e) => {
          e.preventDefault();
          navigateApp(`/garden/${habit.id}`);
        }}
        className="-mt-3 flex max-w-[9.5rem] items-center gap-1 truncate rounded-full border border-[#e3cfae] bg-[#fbf1df] px-2.5 py-1 text-xs font-semibold text-[#5b4128] shadow-sm transition-transform hover:-translate-y-0.5"
      >
        <span aria-hidden>{habit.emoji}</span>
        <span className="truncate">{habit.name}</span>
      </a>
      <div className="mt-1 flex items-center gap-2 text-[11px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
        <span title={`${live.streak}-day streak`}>🔥 {live.streak}</span>
        {live.drops > 0 && <span title={`${live.drops} dew ${live.drops === 1 ? "drop" : "drops"}`}>💧 {live.drops}</span>}
        {live.week && (
          <span>
            {live.week.done}/{live.week.times} wk
          </span>
        )}
      </div>
    </div>
  );
}

/** A plant as a row: for the list under the scene, where every control is plain to reach. */
export function PlantRow({
  info,
  onWater,
  compact = false,
}: {
  info: PlotInfo;
  onWater: (h: HabitView, opts?: { date?: string; step?: 1 | -1 }) => void;
  compact?: boolean;
}) {
  const { habit, live, stage, thirsty } = info;
  const counted = habit.target > 1;
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2">
      <a
        href={`/garden/${habit.id}`}
        onClick={(e) => {
          e.preventDefault();
          navigateApp(`/garden/${habit.id}`);
        }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className="-my-2 shrink-0">
          <Plant species={habit.species} stage={stage.index} health={live.health} size={compact ? 38 : 46} sway={false} ground="none" fit="tight" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
            <span aria-hidden>{habit.emoji}</span>
            <span className="truncate">{habit.name}</span>
          </span>
          <span className="block truncate text-xs text-ink-faint">
            {live.week ? `${live.week.done} of ${live.week.times} this week` : live.dueToday ? scheduleLabel(habit.schedule) : "Resting today"}
            {live.streak > 0 && ` · 🔥 ${live.streak}`}
            {counted && ` · ${live.todayCount}/${habit.target}${habit.unit ? ` ${habit.unit}` : ""}`}
          </span>
        </span>
      </a>
      {counted ? (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onWater(habit, { step: -1 })}
            disabled={live.todayCount === 0}
            aria-label={`One less for ${habit.name}`}
            className="grid size-8 place-items-center rounded-full border border-line text-ink-soft disabled:opacity-30"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => onWater(habit, { step: 1 })}
            aria-label={`One more for ${habit.name}`}
            className={`grid size-9 place-items-center rounded-full text-base font-bold shadow-sm transition-transform active:scale-90 ${live.todayDone ? "bg-moss text-white" : "bg-sky text-white"}`}
          >
            {live.todayDone ? "✓" : "+"}
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onWater(habit)}
          aria-label={live.todayDone ? `Unwater ${habit.name}` : `Water ${habit.name}`}
          aria-pressed={live.todayDone}
          className={`grid size-10 shrink-0 place-items-center rounded-full text-lg shadow-sm transition-all active:scale-90 ${
            live.todayDone ? "bg-moss text-white" : thirsty ? "border-2 border-sky bg-sky-soft text-sky" : "border border-line bg-card text-ink-faint"
          }`}
        >
          {live.todayDone ? "✓" : "💧"}
        </button>
      )}
    </li>
  );
}
