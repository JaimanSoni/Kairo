"use client";

import { useSyncExternalStore } from "react";
import { scheduleLabel, type HabitView } from "@/lib/habits-shared";
import { navigateApp } from "../app-views";
import { HABIT_TINT } from "./bits";
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

/** One habit's plant in the garden: tap it to mark today, tap its name to open it. */
export function Plot({
  info,
  index,
  moments,
  onWater,
  size = 104,
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
  const small = size < 92;

  return (
    <div className="gd-plot relative flex shrink-0 flex-col items-center" data-habit={habit.id} style={{ width: Math.round(size * 1.12) }}>
      <button
        type="button"
        onClick={() => onWater(habit)}
        aria-label={live.todayDone && !counted ? `Unmark ${label}` : `Mark done ${label}`}
        className="group relative block rounded-[2rem] outline-none focus-visible:ring-4 focus-visible:ring-white/60"
      >
        {/* a kept habit glows warm behind its plant */}
        {live.todayDone && <span className="gd-glow pointer-events-none absolute -inset-x-3 top-0 aspect-square rounded-full" aria-hidden />}
        <span className={`relative block transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-95 ${m.water ? "gd-perk" : ""}`} key={`perk-${m.water}`}>
          <Plant species={habit.species} stage={stage} health={look} size={size} phase={index * 0.7} fit="snug" />
        </span>
        {/* one badge, top right: done, counting, or due */}
        {live.todayDone ? (
          <span className="absolute right-0 top-2 grid size-7 place-items-center rounded-full bg-moss text-white shadow-md ring-2 ring-white/80" aria-hidden data-state="done">
            <IconTick />
          </span>
        ) : counted && live.todayCount > 0 ? (
          <span className="absolute right-0 top-2 grid size-8 place-items-center rounded-full bg-white shadow-md" aria-hidden data-state="counting">
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
          <span className="gd-thirst absolute right-0 top-2 grid size-7 place-items-center rounded-full bg-white/95 text-[#0c9384] shadow-md" aria-hidden data-state="due">
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
        className={`-mt-2.5 max-w-full truncate rounded-full bg-white/95 font-semibold text-[#1c2624] shadow-sm transition-transform hover:-translate-y-0.5 ${small ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs"}`}
      >
        {habit.name}
      </a>
      <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
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

function subscribeWide(cb: () => void) {
  const mq = window.matchMedia("(min-width: 640px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Every plant, planted in rows that recede: the first habits stand at the
 * front and largest, later ones further back and smaller, each row offset
 * from the one in front so nothing hides behind anything.
 */
export function GardenBed({ plots, moments, onWater, scale = 1 }: { plots: PlotInfo[]; moments: Moments; onWater: (h: HabitView) => void; scale?: number }) {
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 640px)").matches, () => true);
  const perRow = wide ? 5 : 3;
  const rows: PlotInfo[][] = [];
  for (let i = 0; i < plots.length; i += perRow) rows.push(plots.slice(i, i + perRow));
  const back = [...rows].reverse();
  return (
    <div className="relative px-1 pb-6 pt-2 sm:px-4" data-garden-bed>
      {back.map((row, ri) => {
        const depth = back.length === 1 ? 1 : ri / (back.length - 1);
        const size = Math.round((wide ? 80 + depth * 32 : 72 + depth * 22) * scale);
        const first = plots.indexOf(row[0]);
        return (
          <div
            key={row[0].habit.id}
            className={`relative flex items-end justify-center gap-x-0.5 sm:gap-x-5 ${ri > 0 ? "mt-2 sm:-mt-3" : ""}`}
            style={{ zIndex: ri + 1, paddingLeft: back.length > 1 && ri % 2 === 0 ? "7%" : undefined }}
          >
            {row.map((p, i) => (
              <Plot key={p.habit.id} info={p} index={first + i} moments={moments} onWater={onWater} size={size} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Today's progress, as a ring and a few words, floating on the sky. */
export function GardenHud({ done, total }: { done: number; total: number }) {
  const all = total > 0 && done === total;
  const p = total ? done / total : 0;
  return (
    <span className="gd-hud flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]" data-hud>
      <span className="relative grid size-7 place-items-center">
        <svg className="absolute inset-0" viewBox="0 0 28 28" aria-hidden>
          <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
          <circle cx="14" cy="14" r="11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${p * 69.1} 69.1`} transform="rotate(-90 14 14)" className="transition-[stroke-dasharray] duration-700" />
        </svg>
        {all ? <IconTick size={11} /> : <span className="text-[10px] tabular-nums">{done}</span>}
      </span>
      {total === 0 ? "Nothing due today" : all ? "All done today" : `${done} of ${total} done today`}
    </span>
  );
}

/** A habit as a row: the plain way to see and mark today, and the main one. */
export function PlantCard({
  info,
  onWater,
}: {
  info: PlotInfo;
  onWater: (h: HabitView, opts?: { date?: string; step?: 1 | -1 }) => void;
}) {
  const { habit, live, due, streak } = info;
  const counted = habit.target > 1;
  const tint = HABIT_TINT[habit.color] ?? HABIT_TINT.sun;
  const meta = live.week ? `${live.week.done} of ${live.week.times} this week` : live.dueToday || live.todayDone ? scheduleLabel(habit.schedule) : "Nothing due today";
  return (
    <li
      data-habit-row={habit.id}
      data-done={live.todayDone || undefined}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card transition-all hover:-translate-y-0.5 hover:border-ink-faint/40 hover:shadow-md"
    >
      <a
        href={`/habits/${habit.id}`}
        onClick={(e) => {
          e.preventDefault();
          navigateApp(`/habits/${habit.id}`);
        }}
        className="flex flex-1 flex-col"
      >
        {/* the plant itself, grown as far as the habit is rooted */}
        <span
          className="relative flex h-20 items-end justify-center"
          style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${tint} 5%, transparent), color-mix(in srgb, ${tint} 16%, transparent))` }}
        >
          {streak > 0 && (
            <span className="absolute left-2.5 top-2.5 flex items-center gap-0.5 rounded-full bg-card/90 px-1.5 py-0.5 text-[10px] font-semibold text-clay shadow-sm" title={streakWord(habit, streak)}>
              <IconFlame size={10} />
              <span className="tabular-nums">{streak}</span>
            </span>
          )}
          <span className={`transition-transform duration-300 group-hover:scale-105 ${live.todayDone ? "" : "opacity-95"}`}>
            <Plant species={habit.species} stage={info.stage} size={60} sway={false} ground="none" fit="tight" />
          </span>
        </span>
        <span className="flex flex-1 flex-col px-3 pt-2.5">
          <span className={`truncate text-sm font-medium leading-snug ${live.todayDone ? "text-ink-soft" : "text-ink"}`}>{habit.name}</span>
          <span className="mt-0.5 truncate text-xs text-ink-faint">{meta}</span>
          <StrengthBar strength={info.strength} className="mt-2 pb-0.5" />
        </span>
      </a>

      {/* one tap, at the bottom of every card in the same place */}
      <div className="px-3 pb-3 pt-2.5">
        {counted ? (
          <span className="flex items-center justify-between rounded-full border border-line bg-paper p-0.5">
            <button
              type="button"
              onClick={() => onWater(habit, { step: -1 })}
              disabled={live.todayCount === 0}
              aria-label={`One less for ${habit.name}`}
              className="grid size-8 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-paper-deep disabled:opacity-30"
            >
              <IconMinus />
            </button>
            <span className="min-w-0 truncate px-1 text-xs font-semibold tabular-nums text-ink">
              {live.todayCount}/{habit.target}
            </span>
            <button
              type="button"
              onClick={() => onWater(habit, { step: 1 })}
              aria-label={`One more for ${habit.name}`}
              className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${live.todayDone ? "bg-moss text-white" : "bg-sun text-on-accent hover:bg-sun-deep"}`}
            >
              {live.todayDone ? <IconTick size={14} /> : <span className="text-base font-semibold leading-none">+</span>}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onWater(habit)}
            aria-label={live.todayDone ? `Unmark ${habit.name}` : `Mark ${habit.name} done`}
            aria-pressed={live.todayDone}
            className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-all active:scale-[0.98] ${
              live.todayDone
                ? "bg-moss text-white"
                : due
                  ? "border-2 border-sun/60 text-sun-deep hover:bg-sun hover:text-on-accent"
                  : "border border-line bg-card text-ink-faint hover:border-ink-faint/40 hover:text-ink-soft"
            }`}
          >
            <IconTick size={14} />
            {live.todayDone ? "Done" : due ? "Mark done" : "Not due"}
          </button>
        )}
      </div>
    </li>
  );
}
