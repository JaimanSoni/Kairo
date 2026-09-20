"use client";

import { useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics-client";
import { GoogleBadge } from "../guest-mode";
import { Modal } from "../ui";
import { Plant } from "./plants";
import { GardenScene } from "./scene";

/**
 * The garden, before there's an account to grow one: a full-grown garden on
 * Today, there to be looked at, with a line under it saying what it is. A tap
 * opens the pitch: what the garden is, in three plain lines over a bigger
 * view of it, and one button to start a real one.
 *
 * It shows a garden a few months in, not an empty plot: the point is to see
 * where keeping a habit leads.
 */

type Demo = { species: "sunflower" | "tulip" | "cherry" | "lavender" | "rose" | "lemon" | "lotus"; stage: number };

const DEMO: Demo[] = [
  { species: "tulip", stage: 5 },
  { species: "cherry", stage: 6 },
  { species: "sunflower", stage: 6 },
  { species: "lavender", stage: 5 },
  { species: "lemon", stage: 6 },
];

const POINTS = [
  { title: "Every habit is a plant", body: "Keep it, and it grows: a sprout in week one, in bloom once it's part of you." },
  { title: "It has your sky", body: "Real weather and the real sunset, where you are. Finish the day and a rainbow comes out." },
  { title: "Nothing ever dies", body: "Miss a day and a plant only droops. It perks up the day you come back." },
];

function subscribeWide(cb: () => void) {
  const mq = window.matchMedia("(min-width: 640px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function Bed({ size, count }: { size: number; count: number }) {
  return (
    <div className="relative flex items-end justify-center gap-1 pb-2.5 pl-[22%] pr-3 pt-1 sm:gap-4 sm:pl-[14%]" aria-hidden>
      {DEMO.slice(0, count).map((p, i) => (
        <Plant key={p.species} species={p.species} stage={p.stage} health="thriving" size={size} phase={i * 0.7} fit="snug" />
      ))}
    </div>
  );
}

export function GuestGardenCard() {
  const [open, setOpen] = useState(false);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 640px)").matches, () => true);
  const show = () => {
    setOpen(true);
    track("guest-garden-open");
  };
  return (
    <section className="anim-rise mb-5" aria-label="A garden grown from habits">
      <div
        role="button"
        tabIndex={0}
        onClick={show}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            show();
          }
        }}
        aria-label="See what your habits could grow into"
        className="gd-card group relative block cursor-pointer rounded-2xl outline-none transition-transform duration-300 hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-sun/40"
        data-guest-garden
      >
        <GardenScene variant="mini" weather="clear" thriving={3} gardenerLine="Hi! Want a garden like this?">
          <Bed size={wide ? 60 : 52} count={wide ? 5 : 4} />
        </GardenScene>
      </div>
      <button type="button" onClick={show} className="mt-2.5 flex w-full items-center gap-2 px-1 text-left" tabIndex={-1} aria-hidden>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Your habits can grow into a garden like this</span>
          <span className="block text-xs text-ink-soft">One plant for each habit, under your real sky. Free to start.</span>
        </span>
        <span className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper transition-transform group-hover:translate-x-0.5">See how</span>
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} wide>
          <div data-guest-garden-pitch>
            <div className="p-3 pb-0 sm:p-4 sm:pb-0">
              <GardenScene weather="clear" thriving={4} allDone compact>
                <div className="relative z-[2] flex min-h-24 items-end justify-center gap-2 px-3 pb-4 pt-2 sm:min-h-32 sm:gap-5" aria-hidden>
                  {DEMO.map((p, i) => (
                    <Plant key={p.species} species={p.species} stage={p.stage} health="thriving" size={wide ? 92 : 58} phase={i * 0.7} fit="snug" />
                  ))}
                </div>
              </GardenScene>
            </div>
            <div className="p-6 sm:p-8">
              <h2 className="font-display text-3xl leading-tight tracking-tight">Grow a garden from your habits</h2>
              <p className="mt-1.5 text-sm leading-6 text-ink-soft">A small thing done most days turns into something you can see. This one is a few months old. Yours starts with a single seed.</p>
              <ul className="mt-5 space-y-3.5">
                {POINTS.map((pt) => (
                  <li key={pt.title} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-moss" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{pt.title}</span>
                      <span className="block text-[13px] leading-5 text-ink-soft">{pt.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <a
                href="/api/auth/google"
                data-track="guest-signin"
                className="mt-7 flex w-full items-center justify-center gap-3 rounded-full bg-sun py-2.5 pl-2.5 pr-6 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99]"
                data-guest-garden-signin
              >
                <GoogleBadge size={30} /> Continue with Google, plant my first habit
              </a>
              <p className="mt-2.5 text-center text-xs text-ink-faint">Free to start, no card. The tasks you&apos;ve made here come with you.</p>
              <button onClick={() => setOpen(false)} className="mt-1.5 w-full rounded-full px-5 py-2 text-sm font-medium text-ink-faint hover:text-ink">
                Not yet
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
