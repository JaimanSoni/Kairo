"use client";

import { scheduleLabel, type HabitView } from "@/lib/habits-shared";
import { navigateApp } from "../app-views";
import { HABIT_TINT, HabitMark } from "./bits";
import { Burst, Moment, WaterPour } from "./fx";
import { IconFlame, IconMinus, IconTick } from "./icons";
import { Plant } from "./plants";
import type { Moments, PlotInfo } from "./use-garden";

const streakWord = (h: HabitView, n: number) => `${n}-${h.schedule.kind === "weekly" ? "week" : "day"} streak`;

/** How rooted a habit is, as a thin bar and a number. */
export function StrengthBar({ strength, className = "" }: { strength: number; className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`} title={`${strength}% strong`}>
      <span className="h-1 w-20 overflow-hidden rounded-full bg-paper-deep" aria-hidden>
        <span className="block h-full rounded-full bg-moss transition-[width] duration-500" style={{ width: `${strength}%` }} />
      </span>
      <span className="text-[11px] tabular-nums text-ink-faint">{strength > 0 ? `${strength}% strong` : "Just started"}</span>
    </span>
  );
}

/** One habit's plant in the garden view: tap it to mark today, tap its name to open it. */
export function Plot({
  info,
  index,
  moments,
  onWater,
  size = 112,
}: {
  info: PlotInfo;
  index: number;
  moments: Moments;
  onWater: (h: HabitView) => void;
  size?: number;
}) {
  const { habit, live, stage, due, streak } = info;
  const m = moments[habit.id] ?? { water: 0, burst: 0 };
  const counted = habit.target > 1;
  const progress = counted ? Math.min(1, live.todayCount / habit.target) : live.todayDone ? 1 : 0;
  const label = `${habit.name}: ${live.todayDone ? "done today" : due ? "not done yet" : "nothing due today"}, ${streakWord(habit, streak)}`;
  // a thriving habit not yet done today looks only a touch thirsty, never worse than it is
  const look = due && live.health === "thriving" ? "healthy" : live.health;

  return (
    <div className="gd-plot relative flex flex-col items-center" data-habit={habit.id}>
      <button
        type="button"
        onClick={() => onWater(habit)}
        aria-label={live.todayDone && !counted ? `Unmark ${label}` : `Mark done ${label}`}
        className="group relative block rounded-[2rem] outline-none focus-visible:ring-4 focus-visible:ring-white/60"
      >
        <span className={`block transition-transform duration-200 group-active:scale-95 ${m.water ? "gd-perk" : ""}`} key={`perk-${m.water}`}>
          <Plant species={habit.species} stage={stage} health={look} size={size} phase={index * 0.7} fit="snug" className="h-auto w-[5.75rem] sm:w-[7rem]" />
        </span>
        {/* one badge, top right: done, counting, or due */}
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
        ) : due ? (
          <span className="gd-thirst absolute right-0 top-3 grid size-7 place-items-center rounded-full bg-white text-[#0c9384] shadow-md" aria-hidden data-state="due">
            <span className="size-3.5 rounded-full border-2 border-current" />
          </span>
        ) : null}
        <Moment id={m.water} ms={1300}>
          <WaterPour />
        </Moment>
        <Moment id={m.burst} ms={1200}>
          <Burst />
        </Moment>
      </button>

      <a
        href={`/habits/${habit.id}`}
        onClick={(e) => {
          e.preventDefault();
          navigateApp(`/habits/${habit.id}`);
        }}
        className="-mt-3 max-w-[9.5rem] truncate rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#1c2624] shadow-sm transition-transform hover:-translate-y-0.5"
      >
        {habit.name}
      </a>
      <div className="mt-1.5 flex items-center gap-2.5 text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
        <span className="tabular-nums">{info.strength}%</span>
        {streak > 0 && (
          <span className="flex items-center gap-0.5" title={streakWord(habit, streak)}>
            <IconFlame size={12} className="text-[#ffc59e]" />
            <span className="tabular-nums" data-streak>
              {streak}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

/** A habit as a row: the plain way to see and mark today, and the main one. */
export function PlantRow({
  info,
  onWater,
}: {
  info: PlotInfo;
  onWater: (h: HabitView, opts?: { date?: string; step?: 1 | -1 }) => void;
}) {
  const { habit, live, due, streak } = info;
  const counted = habit.target > 1;
  const meta = live.week ? `${live.week.done} of ${live.week.times} this week` : live.dueToday || live.todayDone ? scheduleLabel(habit.schedule) : "Nothing due today";
  return (
    <li className="flex items-center gap-3 px-3 py-3" data-habit-row={habit.id}>
      <a
        href={`/habits/${habit.id}`}
        onClick={(e) => {
          e.preventDefault();
          navigateApp(`/habits/${habit.id}`);
        }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <HabitMark habit={habit} stage={info.stage} size={44} />
        <span className="min-w-0">
          <span className={`block truncate text-sm font-medium ${live.todayDone ? "text-ink-soft" : "text-ink"}`}>{habit.name}</span>
          <span className="mt-0.5 flex items-center gap-2 truncate text-xs text-ink-faint">
            <span className="truncate">{meta}</span>
            {streak > 0 && (
              <span className="flex shrink-0 items-center gap-0.5 text-clay" title={streakWord(habit, streak)}>
                <IconFlame size={11} />
                <span className="tabular-nums">{streak}</span>
              </span>
            )}
          </span>
          <StrengthBar strength={info.strength} className="mt-1.5" />
        </span>
      </a>
      {counted ? (
        <span className="flex shrink-0 items-center rounded-full border border-line bg-paper">
          <button
            type="button"
            onClick={() => onWater(habit, { step: -1 })}
            disabled={live.todayCount === 0}
            aria-label={`One less for ${habit.name}`}
            className="grid size-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-paper-deep disabled:opacity-30"
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
            className={`grid size-9 place-items-center rounded-full transition-colors ${live.todayDone ? "bg-moss text-white" : "bg-sun text-on-accent hover:bg-sun-deep"}`}
          >
            {live.todayDone ? <IconTick /> : <span className="text-base font-semibold leading-none">+</span>}
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onWater(habit)}
          aria-label={live.todayDone ? `Unmark ${habit.name}` : `Mark ${habit.name} done`}
          aria-pressed={live.todayDone}
          className={`grid size-10 shrink-0 place-items-center rounded-full transition-all active:scale-90 ${
            live.todayDone ? "bg-moss text-white" : due ? "border-2 border-sun/60 text-sun-deep hover:bg-sun hover:text-on-accent" : "border border-line bg-card text-ink-faint"
          }`}
        >
          <IconTick size={16} />
        </button>
      )}
    </li>
  );
}
