"use client";

import { useState } from "react";
import { Modal } from "../ui";
import { useClock } from "./fx";
import { sunMinutes, useLiveSky, useSkySettings, type SkyMode } from "./live-sky";
import { phaseOf } from "./scene";
import { skyLabel, skyTemp, type LiveSky } from "@/lib/weather-shared";

/**
 * The real weather, in words: a chip on the garden's sky that says what the
 * sky is showing, and opens onto where it comes from.
 */

const WEATHER_CREDIT = "MET Norway";

/** Night, by the real sun when we know it. */
function useNight(sky: LiveSky | null): boolean {
  const phase = phaseOf(useClock(), sunMinutes(sky));
  return phase === "night" || phase === "dusk";
}

/** The weather as a line icon, drawn to a 16px grid. */
export function SkyGlyph({ sky, night, size = 16 }: { sky: LiveSky; night: boolean; size?: number }) {
  const cloudUp = "M4.6 9.6h6.8a2.6 2.6 0 0 0 .2-5.2 3.6 3.6 0 0 0-6.9 1.1 2.1 2.1 0 0 0-.1 4.1z";
  let body: React.ReactNode;
  if (sky.kind === "rain" || sky.kind === "sleet") {
    body = (
      <>
        <path d={cloudUp} />
        {sky.thunder ? <path d="M8.9 10.6 7.2 13.1h2.1l-1.6 2.4" /> : <path d="M5.6 11.6l-.9 2.6M8.6 11.6l-.9 2.6M11.6 11.6l-.9 2.6" />}
      </>
    );
  } else if (sky.kind === "snow") {
    body = (
      <>
        <path d={cloudUp} />
        <path d="M5.2 12.4h.01M8 14.2h.01M10.8 12.4h.01" strokeWidth="2.2" />
      </>
    );
  } else if (sky.kind === "fog") {
    body = (
      <>
        <path d="M4.6 8.6h6.8a2.6 2.6 0 0 0 .2-5.2 3.6 3.6 0 0 0-6.9 1.1 2.1 2.1 0 0 0-.1 4.1z" />
        <path d="M2.5 11h11M4.5 13.8h7" />
      </>
    );
  } else if (sky.kind === "cloudy") {
    body = <path d="M4.4 12.6h7.3a2.8 2.8 0 0 0 .3-5.6 3.9 3.9 0 0 0-7.4 1.1 2.3 2.3 0 0 0-.2 4.5z" />;
  } else if (sky.kind === "partly") {
    body = night ? (
      <>
        <path d="M7.6 6.2A3.4 3.4 0 0 1 3.1 1.7a3.4 3.4 0 1 0 4.5 4.5z" />
        <path d="M6.6 13.6h5.6a2.3 2.3 0 0 0 .2-4.6 3.2 3.2 0 0 0-6 .9 1.9 1.9 0 0 0 .2 3.7z" />
      </>
    ) : (
      <>
        <path d="M3.4 8.4A3 3 0 0 1 8.7 5.9M6 1.7v1.2M1.7 6h1.2M2.9 2.9l.9.9M9.1 2.9l-.9.9" />
        <path d="M6.6 13.6h5.6a2.3 2.3 0 0 0 .2-4.6 3.2 3.2 0 0 0-6 .9 1.9 1.9 0 0 0 .2 3.7z" />
      </>
    );
  } else if (night) {
    body = <path d="M12.6 10.3A5 5 0 0 1 5.7 3.4a5 5 0 1 0 6.9 6.9z" />;
  } else {
    body = (
      <>
        <circle cx="8" cy="8" r="2.9" />
        <path d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" />
      </>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {body}
    </svg>
  );
}

/** The chip on the sky: the weather and the temperature, and the way to where it comes from. */
export function SkyChip() {
  const sky = useLiveSky();
  const night = useNight(sky);
  const [open, setOpen] = useState(false);
  const label = sky ? skyLabel(sky, night) : "";
  const temp = sky ? skyTemp(sky) : null;
  // the sheet outlives the chip: switching the weather off in it doesn't snatch it away
  return (
    <>
      {sky && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${label}${temp ? `, ${temp}` : ""}${sky.place ? ` in ${sky.place}` : ""}. Where the weather comes from`}
          className="gd-hud gd-sky-chip flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]"
          data-sky-chip
        >
          <SkyGlyph sky={sky} night={night} size={15} />
          {temp && <span className="tabular-nums">{temp}</span>}
          <span className="hidden sm:inline">{label}</span>
        </button>
      )}
      {open && <SkySheet onClose={() => setOpen(false)} />}
    </>
  );
}

/** The weather as a line of words, for over the full-screen garden. */
export function SkyLine() {
  const sky = useLiveSky();
  const night = useNight(sky);
  const [open, setOpen] = useState(false);
  const temp = sky ? skyTemp(sky) : null;
  return (
    <>
      {sky && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="gd-sky-chip -mx-1 inline-flex items-center gap-1.5 rounded-full px-1 text-left underline-offset-4 hover:underline"
          data-sky-line
        >
          <SkyGlyph sky={sky} night={night} size={15} />
          <span>
            {skyLabel(sky, night)}
            {temp ? `, ${temp}` : ""}
            {sky.place ? ` in ${sky.place}` : ""}
          </span>
        </button>
      )}
      {open && <SkySheet onClose={() => setOpen(false)} />}
    </>
  );
}

function SkySheet({ onClose }: { onClose: () => void }) {
  const { state } = useSkySettings();
  const sky = state?.mode === "off" ? null : (state?.sky ?? null);
  const night = useNight(sky);
  const temp = sky ? skyTemp(sky) : null;
  return (
    <Modal onClose={onClose} above>
      <div className="p-5" data-sky-sheet>
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky/12 text-sky">{sky ? <SkyGlyph sky={sky} night={night} size={26} /> : null}</span>
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-tight">{sky ? `${skyLabel(sky, night)}${temp ? `, ${temp}` : ""}` : "Your garden's own weather"}</h2>
            <p className="text-sm text-ink-soft">{sky ? `${sky.place ? `In ${sky.place}` : "Where you are"}, this hour` : "Clouds that clear as the day's habits get done"}</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          Your garden has the sky you have: rain when it rains, fog, snow, a storm, and the sun setting when yours does. Finish the day&apos;s habits and the rainbow still comes out.
        </p>
        <SkyOptions className="mt-4" />
        <p className="mt-4 text-xs leading-5 text-ink-faint">Weather from {WEATHER_CREDIT}. Where you are is rounded to about 10 km, and Kairo doesn&apos;t keep it.</p>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={onClose} className="h-9 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Where the garden's weather comes from: your connection, this device, or nowhere. Kept on this device. */
export function SkyOptions({ className = "" }: { className?: string }) {
  const { state, setMode } = useSkySettings();
  const [busy, setBusy] = useState<SkyMode | null>(null);
  const mode = state?.mode ?? "auto";
  const pick = async (m: SkyMode) => {
    setBusy(m);
    await setMode(m);
    setBusy(null);
  };
  const choices: { value: SkyMode; title: string; body: string }[] = [
    {
      value: "auto",
      title: "Where my connection is",
      body: state?.connection ? `Right now that's ${state.connection}. No setup, and usually right.` : "The town your internet connection comes from. No setup, and usually right.",
    },
    { value: "here", title: "This device's location", body: "More exact, for when your connection says you're somewhere you're not. Your browser asks once." },
    { value: "off", title: "Off", body: "The garden keeps weather of its own, which clears as the day's habits get done." },
  ];
  return (
    <div className={className}>
      <div className="grid gap-2" role="radiogroup" aria-label="Where the garden's weather comes from">
        {choices.map((c) => {
          const on = mode === c.value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy !== null}
              onClick={() => void pick(c.value)}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors disabled:cursor-wait ${on ? "border-sun bg-sun-soft/40" : "border-line hover:border-ink-faint"}`}
              data-sky-mode={c.value}
            >
              <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 ${on ? "border-sun" : "border-line"}`} aria-hidden>
                {on && <span className="size-1.5 rounded-full bg-sun" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{busy === c.value ? (c.value === "here" ? "Finding you…" : "Checking the sky…") : c.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-ink-soft">{c.body}</span>
              </span>
            </button>
          );
        })}
      </div>
      {state?.locationError === "denied" && (
        <p className="mt-2 text-xs leading-5 text-clay" data-sky-denied>
          Your browser didn&apos;t share this device&apos;s location, so the weather follows your connection instead. You can allow it in the browser&apos;s site settings.
        </p>
      )}
      {state?.locationError === "unavailable" && mode === "here" && (
        <p className="mt-2 text-xs leading-5 text-ink-faint">This device couldn&apos;t find where it is just now, so this hour&apos;s weather is for your connection&apos;s town.</p>
      )}
      {mode !== "off" && state?.status === "unknown" && <p className="mt-2 text-xs leading-5 text-ink-faint">We can&apos;t tell where you are from this connection. Try this device&apos;s location instead.</p>}
    </div>
  );
}
