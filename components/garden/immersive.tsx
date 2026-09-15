"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { IconPlus, IconX } from "../ui";
import { useClock, useReducedMotion } from "./fx";
import { Plant } from "./plants";
import { GardenBed, GardenHud } from "./plot";
import { GardenScene, type Weather } from "./scene";
import { gardenLevelOf, gardenScore } from "@/lib/habits-shared";
import { plotOf, useGarden, useGardenActions } from "./use-garden";

/**
 * The garden, full screen. It opens from the garden card on Today or the
 * garden on Habits, and lives at ?garden=open, so the back button (or a
 * phone's back gesture) closes it the way it closes anything else.
 */

function withGarden(open: boolean): string {
  const url = new URL(window.location.href);
  if (open) url.searchParams.set("garden", "open");
  else url.searchParams.delete("garden");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function useGardenView() {
  const params = useSearchParams();
  const open = params.get("garden") === "open";
  const show = () => {
    if (open) return;
    // marked, so closing knows it can step back rather than leave a stray entry behind
    window.history.pushState({ kairoGarden: true }, "", withGarden(true));
  };
  const hide = () => {
    if ((window.history.state as { kairoGarden?: boolean } | null)?.kairoGarden) {
      window.history.back();
    } else {
      window.history.replaceState(null, "", withGarden(false));
    }
  };
  return { open, show, hide };
}

const noop = () => () => {};

function subscribeResize(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

function subscribeWide(cb: () => void) {
  const mq = window.matchMedia("(min-width: 640px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

const DAY_PART = (min: number) => (min < 5 * 60 ? "night" : min < 12 * 60 ? "morning" : min < 17 * 60 ? "afternoon" : min < 21 * 60 ? "evening" : "night");

export function ImmersiveGarden({ onClose }: { onClose: () => void }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 640px)").matches, () => true);
  // plants fill a tall screen rather than sitting small in the middle of it
  const tall = useSyncExternalStore(subscribeResize, () => window.innerHeight, () => 800);
  const { status, habits, today } = useGarden();
  const { moments, celebrate, water } = useGardenActions();
  const minute = useClock();
  const still = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  // Escape closes; the page behind stays put
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
      cancelAnimationFrame(frame.current);
    };
  }, [onClose]);

  if (!mounted) return null;

  // the garden's own history entry becomes the Habits page, so Back from there doesn't reopen it
  const toHabits = () => {
    window.history.replaceState(null, "", "/habits");
    window.scrollTo(0, 0);
  };

  const plots = habits.map((h) => plotOf(h, today));
  const due = plots.filter((p) => p.live.dueToday || p.live.todayDone);
  const doneToday = due.filter((p) => p.live.todayDone).length;
  const allDone = due.length > 0 && doneToday === due.length;
  const thriving = plots.filter((p) => p.live.health === "thriving").length;
  const weather: Weather = due.length === 0 || allDone ? "clear" : doneToday > 0 || minute < 17 * 60 ? "partly" : "cloudy";
  const weekday = new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" });

  const onPointerMove = (e: React.PointerEvent) => {
    if (still || e.pointerType !== "mouse") return;
    const el = root.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--gx", ((clientX / window.innerWidth) * 2 - 1).toFixed(3));
      el.style.setProperty("--gy", ((clientY / window.innerHeight) * 2 - 1).toFixed(3));
    });
  };

  return createPortal(
    <div ref={root} className="gd-immersive fixed inset-0 z-[60] bg-[#0b1a2c]" role="dialog" aria-modal aria-label="Your garden" onPointerMove={onPointerMove} data-immersive>
      <GardenScene variant="immersive" weather={weather} thriving={thriving} allDone={allDone} celebrate={celebrate} decorLevel={gardenLevelOf(gardenScore(plots.map((p) => p.strength))).level}>
        {status !== "ready" ? null : plots.length === 0 ? (
          <div className="flex flex-col items-center px-6 text-center">
            <div className="flex items-end gap-4">
              {(["tulip", "sunflower", "lavender"] as const).map((s, i) => (
                <Plant key={s} species={s} stage={i === 1 ? 2 : 0} size={i === 1 ? 150 : 120} phase={i} fit="snug" />
              ))}
            </div>
            <p className="font-display mt-3 text-2xl text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.3)]">Your garden is waiting</p>
            <button
              type="button"
              onClick={toHabits}
              className="mt-4 flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#1c2624] shadow-lg transition-transform hover:-translate-y-0.5"
            >
              <IconPlus size={15} /> Start a habit
            </button>
          </div>
        ) : (
          <div className="pb-16 pt-4">
            <GardenBed plots={plots} moments={moments} onWater={(h) => void water(h)} scale={wide ? Math.min(1.75, Math.max(1.2, tall / 560)) : 1.12} />
          </div>
        )}
      </GardenScene>

      {/* a soft shade under the title, so a passing cloud never washes it out */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-48 bg-gradient-to-b from-[#0b1a2c]/40 via-[#0b1a2c]/12 to-transparent" aria-hidden />

      {/* over the sky: where you are in the day, and the way out */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-7">
        <div className="pointer-events-auto min-w-0">
          <h2 className="font-display text-3xl leading-none text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.28)] sm:text-4xl">Your garden</h2>
          <p className="mt-1.5 text-sm font-medium text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.35)]">
            {weekday} {DAY_PART(minute)}
          </p>
          {plots.length > 0 && (
            <div className="mt-3">
              <GardenHud done={doneToday} total={due.length} />
            </div>
          )}
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toHabits}
            className="gd-hud hidden h-10 items-center rounded-full px-4 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 sm:flex"
          >
            All habits
          </button>
          <button type="button" onClick={onClose} aria-label="Close garden" className="gd-hud grid size-10 place-items-center rounded-full text-white transition-transform hover:scale-105" data-close-garden>
            <IconX size={18} />
          </button>
        </div>
      </div>

      {plots.length > 0 && (
        <p className="gd-hint pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 mx-auto w-max max-w-[90vw] rounded-full bg-black/35 px-4 py-2 text-center text-xs font-semibold text-white backdrop-blur-sm">
          Tap a plant to mark it done
        </p>
      )}
    </div>,
    document.body
  );
}
