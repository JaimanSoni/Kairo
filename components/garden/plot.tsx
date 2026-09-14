"use client";

import { scheduleLabel, speciesOf, type HabitView } from "@/lib/habits-shared";
import { navigateApp } from "../app-views";
import { HABIT_TINT, HabitMark } from "./bits";
import { Burst, Moment, WaterPour } from "./fx";
import { IconDrop, IconFlame, IconMinus, IconSparkle, IconTick } from "./icons";
import { FruitGlyph, Plant } from "./plants";
import type { Moments, PlotInfo } from "./use-garden";

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
        {/* one badge, top right: done, counting, or thirsty */}
        {live.todayDone ? (
          <span className="absolute right-0 top-3 grid size-7 place-items-center rounded-full bg-moss text-white shadow-md ring-2 ring-white/80" aria-hidden data-state="done">
            <IconTick />
          </span>
        ) : counted && live.todayCount > 0 ? (
          <span className="absolute right-0 top-3 grid size-8 place-items-center rounded-full bg-white shadow-md" aria-hidden data-state="counting">
            <svg className="absolute inset-0" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="13" fill="none" stroke="#e3eef6" strokeWidth="3" />
              <circle
                cx="16"
                cy="16"
                r="13"
                fill="none"
                stroke={HABIT_TINT[habit.color] ?? HABIT_TINT.sky}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${progress * 81.7} 81.7`}
                transform="rotate(-90 16 16)"
                className="transition-[stroke-dasharray] duration-500"
              />
            </svg>
            <span className="relative text-[10px] font-bold tabular-nums text-[#1c2624]">
              {live.todayCount}/{habit.target}
            </span>
          </span>
        ) : thirsty ? (
          <span className="gd-thirst absolute right-0 top-3 grid size-7 place-items-center rounded-full bg-white text-sky shadow-md" aria-hidden data-state="thirsty">
            <IconDrop size={14} />
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
          className={`gd-pick absolute top-1 z-10 flex items-center gap-1 rounded-full py-1 pl-1.5 pr-2.5 text-[11px] font-semibold shadow-lg ${
            golden > 0 ? "bg-[#ffd96a] text-[#5c4300]" : "bg-white text-[#1c2624]"
          }`}
          aria-label={`Pick ${golden > 0 ? "a golden fruit" : `a ${speciesOf(habit.species).fruit.toLowerCase()}`} from ${habit.name}`}
        >
          {golden > 0 ? <IconSparkle size={13} /> : <FruitGlyph species={habit.species} size={15} />}
          Pick
        </button>
      )}

      <a
        href={`/garden/${habit.id}`}
        onClick={(e) => {
          e.preventDefault();
          navigateApp(`/garden/${habit.id}`);
        }}
        className="-mt-3 max-w-[9.5rem] truncate rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#1c2624] shadow-sm transition-transform hover:-translate-y-0.5"
      >
        {habit.name}
      </a>
      <div className="mt-1.5 flex items-center gap-2.5 text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
        <span className="flex items-center gap-0.5" title={`${live.streak}-day streak`}>
          <IconFlame size={12} className="text-[#ffc59e]" />
          <span className="tabular-nums" data-streak>
            {live.streak}
          </span>
        </span>
        {live.drops > 0 && (
          <span className="flex items-center gap-0.5" title={`${live.drops} dew ${live.drops === 1 ? "drop" : "drops"}`}>
            <IconDrop size={12} className="text-[#cfe9ff]" />
            <span className="tabular-nums">{live.drops}</span>
          </span>
        )}
        {live.week && (
          <span className="tabular-nums">
            {live.week.done}/{live.week.times} this week
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
}: {
  info: PlotInfo;
  onWater: (h: HabitView, opts?: { date?: string; step?: 1 | -1 }) => void;
}) {
  const { habit, live, thirsty } = info;
  const counted = habit.target > 1;
  const meta = live.week ? `${live.week.done} of ${live.week.times} this week` : live.dueToday ? scheduleLabel(habit.schedule) : "Resting today";
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <a
        href={`/garden/${habit.id}`}
        onClick={(e) => {
          e.preventDefault();
          navigateApp(`/garden/${habit.id}`);
        }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <HabitMark habit={habit} size={40} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{habit.name}</span>
          <span className="flex items-center gap-2 truncate text-xs text-ink-faint">
            <span className="truncate">{meta}</span>
            {live.streak > 0 && (
              <span className="flex shrink-0 items-center gap-0.5 text-clay">
                <IconFlame size={11} />
                <span className="tabular-nums">{live.streak}</span>
              </span>
            )}
          </span>
        </span>
      </a>
      {counted ? (
        <span className="flex shrink-0 items-center rounded-full border border-line bg-paper">
          <button
            type="button"
            onClick={() => onWater(habit, { step: -1 })}
            disabled={live.todayCount === 0}
            aria-label={`One less for ${habit.name}`}
            className="grid size-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-paper-deep disabled:opacity-30"
          >
            <IconMinus />
          </button>
          <span className="min-w-12 text-center text-xs font-semibold tabular-nums text-ink">
            {live.todayCount}/{habit.target}
          </span>
          <button
            type="button"
            onClick={() => onWater(habit, { step: 1 })}
            aria-label={`One more for ${habit.name}`}
            className={`grid size-8 place-items-center rounded-full transition-colors ${live.todayDone ? "bg-moss text-white" : "bg-sky text-white hover:bg-sky/90"}`}
          >
            {live.todayDone ? <IconTick /> : <IconDrop size={14} />}
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onWater(habit)}
          aria-label={live.todayDone ? `Unwater ${habit.name}` : `Water ${habit.name}`}
          aria-pressed={live.todayDone}
          className={`grid size-9 shrink-0 place-items-center rounded-full transition-all active:scale-90 ${
            live.todayDone ? "bg-moss text-white" : thirsty ? "border border-sky/50 bg-sky-soft text-sky hover:bg-sky hover:text-white" : "border border-line bg-card text-ink-faint"
          }`}
        >
          {live.todayDone ? <IconTick size={14} /> : <IconDrop size={15} />}
        </button>
      )}
    </li>
  );
}
