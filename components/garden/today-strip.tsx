"use client";

import { useState } from "react";
import { navigateApp } from "../app-views";
import { IconSprout, IconX } from "../ui";
import { HABIT_TINT } from "./bits";
import { Burst, Moment, WaterPour } from "./fx";
import { IconFlame, IconTick } from "./icons";
import { Plant } from "./plants";
import { plotOf, useGarden, useGardenActions } from "./use-garden";

const HIDE_KEY = "kairo:garden-invite-hidden";

/**
 * Habits, on Today: the ones due, one tap each. Kept small
 * so the day's tasks stay the main thing on the page.
 */
export default function TodayGardenStrip() {
  const { status, habits, today, guest } = useGarden();
  const { moments, water } = useGardenActions();
  const [inviteHidden, setInviteHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (guest || status !== "ready") return null;

  if (habits.length === 0) {
    if (inviteHidden) return null;
    return (
      <div className="anim-rise mb-5 flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5">
        <span className="grid size-10 shrink-0 place-items-end justify-center overflow-hidden rounded-xl bg-moss-soft">
          <Plant species="sunflower" stage={2} size={32} sway={false} ground="none" fit="tight" />
        </span>
        <button type="button" onClick={() => navigateApp("/habits")} className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-medium">Build a habit alongside your tasks</span>
          <span className="block truncate text-xs text-ink-faint">Pick something small, mark it done each day, and watch it get stronger.</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setInviteHidden(true);
            try {
              localStorage.setItem(HIDE_KEY, "1");
            } catch {
              /* private mode: hidden for this visit */
            }
          }}
          aria-label="Hide habits invite"
          className="grid size-7 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-paper-deep hover:text-ink"
        >
          <IconX size={14} />
        </button>
      </div>
    );
  }

  const plots = habits.map((h) => plotOf(h, today)).filter((p) => p.live.dueToday || p.live.todayDone);
  if (plots.length === 0) return null;
  const doneCount = plots.filter((p) => p.live.todayDone).length;
  const all = doneCount === plots.length;
  plots.sort((a, b) => Number(a.live.todayDone) - Number(b.live.todayDone));

  return (
    <section className="anim-rise mb-5" aria-label="Habits">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateApp("/habits")}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint transition-colors hover:text-ink-soft"
        >
          <IconSprout size={13} />
          Habits · {all ? "all done" : `${doneCount} of ${plots.length} done`}
        </button>
        <button type="button" onClick={() => navigateApp("/habits")} className="text-xs font-semibold text-sun-deep hover:underline">
          Open
        </button>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {plots.map((p) => {
          const { habit, live, stage, streak } = p;
          const m = moments[habit.id] ?? { water: 0, burst: 0 };
          const counted = habit.target > 1;
          const tint = HABIT_TINT[habit.color] ?? HABIT_TINT.sun;
          return (
            <div
              key={habit.id}
              data-strip-habit={habit.id}
              className={`relative flex w-[5.75rem] shrink-0 flex-col items-center overflow-hidden rounded-2xl border pb-2 transition-colors ${
                live.todayDone ? "border-moss/30 bg-moss-soft/50" : "border-line bg-card"
              }`}
            >
              <button
                type="button"
                onClick={() => void water(habit, counted ? { step: 1 } : {})}
                aria-label={live.todayDone && !counted ? `Unmark ${habit.name}` : counted ? `One more for ${habit.name}` : `Mark ${habit.name} done`}
                className="relative flex w-full justify-center pt-1"
                style={live.todayDone ? undefined : { background: `linear-gradient(180deg, transparent, color-mix(in srgb, ${tint} 9%, transparent))` }}
              >
                <span className={`block ${m.water ? "gd-perk" : ""}`} key={`perk-${m.water}`}>
                  <Plant species={habit.species} stage={stage} health={live.health} size={54} ground="none" sway={!live.todayDone} phase={habit.order} fit="tight" />
                </span>
                <span
                  className={`absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full text-[10px] font-bold shadow-sm ${
                    live.todayDone ? "bg-moss text-white" : "bg-card text-sun-deep ring-1 ring-sun/40"
                  }`}
                  aria-hidden
                >
                  {live.todayDone ? <IconTick size={10} /> : counted ? live.todayCount : <span className="size-2 rounded-full border-[1.5px] border-current" />}
                </span>
                <Moment id={m.water} ms={1300}>
                  <WaterPour />
                </Moment>
                <Moment id={m.burst} ms={1200}>
                  <Burst count={12} />
                </Moment>
              </button>
              <span className="mt-1 w-full truncate px-1.5 text-center text-[11px] font-medium leading-tight">{habit.name}</span>
              <span className="mt-0.5 flex items-center gap-0.5 text-[10px] text-ink-faint">
                {counted ? (
                  `${live.todayCount}/${habit.target}`
                ) : streak > 0 ? (
                  <>
                    <IconFlame size={10} className="text-clay" />
                    {streak}
                  </>
                ) : p.strength > 0 ? (
                  `${p.strength}% strong`
                ) : (
                  " "
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
