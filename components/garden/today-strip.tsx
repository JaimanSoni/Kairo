"use client";

import { useState, useSyncExternalStore } from "react";
import { navigateApp } from "../app-views";
import { IconX } from "../ui";
import { ImmersiveGarden, useGardenView } from "./immersive";
import { useCityView } from "./city/city";
import { GuestCityCard } from "./city/city-card";
import { GuestGardenCard } from "./guest-garden";
import { IconTick } from "./icons";
import { Plant } from "./plants";
import { gardenLevelOf, gardenScore } from "@/lib/habits-shared";
import { GardenScene, type Weather } from "./scene";
import { plotOf, useGarden, type PlotInfo } from "./use-garden";
import { gardenStore } from "@/lib/habits-client";
import { useClock } from "./fx";
import { CITY_SHOWN } from "@/lib/types";

const HIDE_KEY = "kairo:garden-invite-hidden";

function subscribeWide(cb: () => void) {
  const mq = window.matchMedia("(min-width: 640px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * The garden, on Today: a small window onto it, with today's progress on
 * the sky. Tapping it opens the whole garden, full screen, where habits are
 * marked done by tapping their plants.
 */
export default function TodayGardenStrip() {
  const { status, habits, today, guest, gardener } = useGarden();
  const requests = CITY_SHOWN ? gardenStore.friendRequests() : 0;
  const view = useGardenView();
  const city = useCityView();
  const minute = useClock();
  const [inviteHidden, setInviteHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // signed out: a grown garden to look at, and what it takes to have one (or the city, while it's open to walk around)
  if (guest) {
    return CITY_SHOWN ? <GuestCityCard onOpen={city.show} /> : <GuestGardenCard />;
  }
  if (status !== "ready") return null;

  if (habits.length === 0) {
    // someone on the street keeps a way into the city, habits or not
    const joined = CITY_SHOWN && Boolean(gardener?.public);
    if (inviteHidden && !joined && requests === 0) return null;
    return (
      <section className="anim-rise relative mb-5" aria-label="Your garden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigateApp("/habits")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigateApp("/habits");
            }
          }}
          className="gd-card group block cursor-pointer rounded-2xl outline-none transition-transform duration-300 hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-sun/40"
          data-garden-invite
        >
          <GardenScene variant="mini" weather="clear" thriving={1} live>
            <div className="flex items-end justify-center gap-6 px-4 pb-3 pt-1">
              {(["tulip", "sunflower", "lavender"] as const).map((s, i) => (
                <Plant key={s} species={s} stage={i === 1 ? 2 : 0} size={i === 1 ? 58 : 48} phase={i} sway={i === 1} fit="snug" />
              ))}
            </div>
          </GardenScene>
          <span className="gd-hud absolute left-2.5 top-2.5 max-w-[calc(100%-3.5rem)] truncate rounded-full px-3 py-1.5 text-xs font-semibold text-white">
            {joined ? "Plant a first habit in your plot" : "Build a habit alongside your tasks"}
          </span>
        </div>
        {!joined && (
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
          className="gd-hud absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full text-white"
        >
          <IconX size={13} />
        </button>
        )}
      </section>
    );
  }

  const plots = habits.map((h) => plotOf(h, today));
  const due = plots.filter((p) => p.live.dueToday || p.live.todayDone);
  const doneToday = due.filter((p) => p.live.todayDone).length;
  const allDone = due.length > 0 && doneToday === due.length;
  const thriving = plots.filter((p) => p.live.health === "thriving").length;
  const weather: Weather = due.length === 0 || allDone ? "clear" : doneToday > 0 || minute < 17 * 60 ? "partly" : "cloudy";
  const level = gardenLevelOf(gardenScore(plots.map((p) => p.strength))).level;

  return (
    <section className="anim-rise mb-5" aria-label="Your garden">
      <div
        role="button"
        tabIndex={0}
        onClick={view.show}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            view.show();
          }
        }}
        aria-label={`Open your garden. ${due.length ? `${doneToday} of ${due.length} habits done today.` : "Nothing due today."}`}
        className="gd-card group relative block cursor-pointer rounded-2xl outline-none transition-transform duration-300 hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-sun/40"
        data-garden-card
      >
        {/* just the picture: nothing laid over the sky. The whole card opens the garden, where the day's count and the weather are. */}
        <GardenScene variant="mini" weather={weather} thriving={thriving} allDone={allDone} decorLevel={level} live>
          <MiniBed plots={plots} />
        </GardenScene>
      </div>
      {view.open && <ImmersiveGarden onClose={view.hide} />}
    </section>
  );
}

/** The plants in a row, small: a glimpse, not a place to tap. */
function MiniBed({ plots }: { plots: PlotInfo[] }) {
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 640px)").matches, () => true);
  // the gardener stands in the bottom-left corner, so the plants keep to the right of him
  const room = wide ? 8 : 4;
  const shown = plots.length > room ? plots.slice(0, room - 1) : plots;
  const more = plots.length - shown.length;
  return (
    <div className="relative flex items-end justify-center gap-1.5 pb-2.5 pl-[24%] pr-3 pt-1 sm:gap-4 sm:pl-[14%]" aria-hidden>
      {shown.map((p, i) => (
        <span key={p.habit.id} className="relative flex flex-col items-center" data-mini-habit={p.habit.id} data-done={p.live.todayDone}>
          {p.live.todayDone && <span className="gd-glow absolute -inset-x-1 top-0 aspect-square rounded-full" />}
          <span className="relative">
            <Plant species={p.habit.species} stage={p.stage} health={p.due && p.live.health === "thriving" ? "healthy" : p.live.health} size={wide ? 56 : 50} phase={i * 0.7} fit="snug" />
          </span>
          {p.live.todayDone ? (
            <span className="absolute right-0 top-1 grid size-4 place-items-center rounded-full bg-moss text-white ring-1 ring-white/80">
              <IconTick size={8} />
            </span>
          ) : p.due ? (
            <span className="absolute right-0.5 top-1 size-3 rounded-full border-2 border-[#0c9384] bg-white/95" />
          ) : null}
        </span>
      ))}
      {more > 0 && <span className="mb-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#1c2624] shadow-sm">+{more}</span>}
    </div>
  );
}
