"use client";

import { navigateApp } from "../app-views";
import { useApp } from "../store";
import { HabitMark } from "../garden/bits";
import { IconTick } from "../garden/icons";
import { habitsOn, useGardenDays } from "./day-data";

/**
 * The plants of one day, as small chips: the ones watered, then the ones the
 * day still asks for. Loaded on demand, because it brings the garden's art.
 */
export default function DayHabits({
  date,
  today,
  wateredOnly = false,
  className = "",
}: {
  date: string;
  today: string;
  /** Only what was watered: for places that show what you did, never what you missed. */
  wateredOnly?: boolean;
  className?: string;
}) {
  const { state } = useApp();
  const ready = useGardenDays(!state.user.guest && state.user.spaces.garden, today, state.user.id);
  if (!ready) return null;
  const day = habitsOn(date, today);
  const watered = day.watered;
  const waiting = wateredOnly ? [] : day.waiting;
  const total = watered.length + waiting.length;
  if (total === 0) return null;
  const future = date > today;

  return (
    <section className={className} aria-label="Habits">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        {future ? `Habits · ${total} due` : wateredOnly ? `Watered · ${watered.length}` : `Habits · ${watered.length} of ${total} watered`}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {[...watered, ...waiting].map(({ habit, done }) => (
          <li key={habit.id}>
            <a
              href={`/garden/${habit.id}`}
              onClick={(e) => {
                e.preventDefault();
                navigateApp(`/garden/${habit.id}`);
              }}
              data-day-habit={habit.id}
              data-done={done}
              className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition-colors ${
                done ? "border-moss/30 bg-moss-soft/50 text-ink" : "border-line bg-card text-ink-faint hover:text-ink-soft"
              }`}
            >
              <HabitMark habit={habit} size={20} className="rounded-full" />
              <span className="max-w-[9rem] truncate">{habit.name}</span>
              {done && <IconTick size={10} className="text-moss" />}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
