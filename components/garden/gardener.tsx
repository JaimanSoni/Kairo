"use client";

import { useState } from "react";
import { ART_DIR, COVER, GRADE, Paint } from "./painted";
import type { Phase } from "./scene";

/**
 * The gardener: a kid in a green cap, waving from the back of the garden by
 * the fence, watering can in hand. He says hi for the hour and the weather,
 * says well done when the day's habits are all done, and goes home for the night.
 *
 * He stands behind the plants, never over them. What he says shows for a
 * few seconds and fades; he says it again when there's something new to
 * say, and whenever he's tapped.
 */

const SRC = `${ART_DIR}/gardener.webp`;
const RATIO = 320 / 560;

export type GardenerWeather = "clear" | "rain" | "storm" | "snow" | "fog";

export function greetingFor(minute: number, weather: GardenerWeather, allDone: boolean): string {
  if (allDone) return "All done today! Great job!";
  if (weather === "storm") return "Hi! Stay cozy today!";
  if (weather === "rain") return "Hi! The plants love this rain!";
  if (weather === "snow") return "Hi! It's snowing!";
  if (weather === "fog") return "Hi! So foggy today!";
  if (minute < 12 * 60) return "Hi! Good morning!";
  if (minute < 17 * 60) return "Hi! Good afternoon!";
  return "Hi! Good evening!";
}

export function Gardener({ phase, minute, weather, allDone, className }: { phase: Phase; minute: number; weather: GardenerWeather; allDone: boolean; className: string }) {
  const [taps, setTaps] = useState(0);
  const line = greetingFor(minute, weather, allDone);
  return (
    <div className={`absolute z-[3] ${className}`} style={{ aspectRatio: RATIO }} data-gardener>
      <button type="button" onClick={() => setTaps((n) => n + 1)} aria-label={line} className="gd-kid absolute inset-0 cursor-pointer outline-none">
        <Paint src={SRC} fit={COVER} grade={GRADE[phase]} frost={0} className="inset-0" />
      </button>
      {/* keyed by what he says and how often he's been tapped, so each new line pops in and fades again */}
      <span
        key={`${line}:${taps}`}
        className="gd-bubble pointer-events-none absolute bottom-[86%] left-[62%] w-max max-w-[11rem] rounded-2xl rounded-bl-sm bg-white px-2.5 py-1.5 text-[11px] font-semibold leading-tight text-[#1c2624] shadow-md sm:text-xs"
        aria-hidden
        data-gardener-says
      >
        {line}
      </span>
    </div>
  );
}
