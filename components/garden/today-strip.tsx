"use client";

import { useState } from "react";
import { navigateApp } from "../app-views";
import { Burst, Moment, WaterPour } from "./fx";
import { Plant } from "./plants";
import { plotOf, useGarden, useGardenActions } from "./use-garden";

const HIDE_KEY = "kairo:garden-invite-hidden";

/**
 * The garden, on Today: the plants that want water, one tap each. Kept small
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
      <div className="anim-rise mb-5 flex items-center gap-3 rounded-2xl border border-line bg-gradient-to-r from-moss-soft/70 to-card px-3 py-2">
        <Plant species="sunflower" stage={2} size={40} sway={false} ground="none" />
        <button type="button" onClick={() => navigateApp("/garden/seeds")} className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold">Grow a habit alongside your tasks</span>
          <span className="block truncate text-xs text-ink-soft">Plant a seed, water it daily, watch it bear fruit.</span>
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
          aria-label="Hide garden invite"
          className="grid size-7 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-paper-deep"
        >
          ×
        </button>
      </div>
    );
  }

  const plots = habits.map((h) => plotOf(h, today)).filter((p) => p.live.dueToday || p.live.todayDone);
  if (plots.length === 0) return null;
  const watered = plots.filter((p) => p.live.todayDone).length;
  const all = watered === plots.length;
  plots.sort((a, b) => Number(a.live.todayDone) - Number(b.live.todayDone));

  return (
    <section className="anim-rise mb-5" aria-label="Garden">
      <div className="mb-1.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateApp("/garden")}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint hover:text-sun-deep"
        >
          🌱 Garden · {all ? "all watered" : `${watered} of ${plots.length} watered`}
        </button>
        <button type="button" onClick={() => navigateApp("/garden")} className="text-xs font-semibold text-sun-deep">
          Open →
        </button>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {plots.map((p) => {
          const { habit, live, stage } = p;
          const m = moments[habit.id] ?? { water: 0, burst: 0, golden: false };
          const counted = habit.target > 1;
          return (
            <div
              key={habit.id}
              data-strip-habit={habit.id}
              className={`relative flex w-[5.5rem] shrink-0 flex-col items-center rounded-2xl border px-1 pb-1.5 pt-0.5 transition-colors ${
                live.todayDone ? "border-moss/40 bg-moss-soft/60" : "border-line bg-card"
              }`}
            >
              <button
                type="button"
                onClick={() => void water(habit, counted ? { step: 1 } : {})}
                aria-label={live.todayDone && !counted ? `Unwater ${habit.name}` : counted ? `One more for ${habit.name}` : `Water ${habit.name}`}
                className="relative"
              >
                <span className={`block ${m.water ? "gd-perk" : ""}`} key={`perk-${m.water}`}>
                  <Plant species={habit.species} stage={stage.index} health={live.health} size={58} ground="none" sway={!live.todayDone} phase={habit.order} fit="tight" />
                </span>
                <span
                  className={`absolute -right-1 top-1 grid size-5 place-items-center rounded-full text-[10px] font-bold shadow ${
                    live.todayDone ? "bg-moss text-white" : "bg-white text-sky ring-1 ring-sky/40"
                  }`}
                  aria-hidden
                >
                  {live.todayDone ? "✓" : counted ? live.todayCount : "💧"}
                </span>
                <Moment id={m.water} ms={1300}>
                  <WaterPour />
                </Moment>
                <Moment id={m.burst} ms={1200}>
                  <Burst golden={m.golden} count={12} />
                </Moment>
              </button>
              <span className="mt-0.5 w-full truncate text-center text-[11px] font-medium leading-tight">
                {habit.emoji} {habit.name}
              </span>
              <span className="text-[10px] text-ink-faint">
                {counted ? `${live.todayCount}/${habit.target}` : live.streak > 0 ? `🔥 ${live.streak}` : "new"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
