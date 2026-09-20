"use client";

import { useState } from "react";
import { Modal } from "../ui";
import { PREVIEW_TIMES, PREVIEW_WEATHERS, setSkyPreview, sunMinutes, useGardenMinute, useLiveSky, useSkyPreview, useSkySettings, type SkyMode } from "./live-sky";
import { useApp } from "../store";
import { phaseOf } from "./scene";
import { skyLabel, skyTemp, type LiveSky } from "@/lib/weather-shared";

/**
 * The real weather, in words: a chip on the garden's sky that says what the
 * sky is showing, and opens onto where it comes from.
 */

const WEATHER_CREDIT = "MET Norway";

/** Night, by the real sun when we know it. */
function useNight(sky: LiveSky | null): boolean {
  const phase = phaseOf(useGardenMinute(), sunMinutes(sky));
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
          {sky && (
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky/12 text-sky">
              <SkyGlyph sky={sky} night={night} size={24} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-xl leading-tight">{sky ? `${skyLabel(sky, night)}${temp ? `, ${temp}` : ""}` : "Garden weather"}</h2>
            <p className="truncate text-sm text-ink-soft">{sky ? (sky.place ? `${sky.place}, this hour` : "Where you are, this hour") : "Clears as habits get done"}</p>
          </div>
        </div>
        <SkyOptions className="mt-4" />
        <SkyPreviewPanel className="mt-4" />
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-faint">Weather from {WEATHER_CREDIT}</p>
          <button type="button" onClick={onClose} className="h-9 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Whether the garden follows the real weather. Kept on this device.
 *
 * There used to be three answers, two of which were the same answer with
 * different plumbing. There are two now: on, or the garden's own weather.
 * On means this device's location if the browser will give it, and the town
 * your connection comes from if it won't — so a refused prompt quietly
 * downgrades instead of breaking the feature, and the line underneath says
 * which one it ended up using.
 */
export function SkyOptions({ className = "" }: { className?: string }) {
  const { state, setMode } = useSkySettings();
  const [busy, setBusy] = useState<SkyMode | null>(null);
  const mode = state?.mode ?? "auto";
  const precise = mode === "here" && !state?.locationError;
  const where = precise ? "This device" : (state?.connection ?? "Your connection");
  const choices: { value: SkyMode; title: string; body: string }[] = [
    { value: "here", title: "Real weather", body: busy ? "Looking…" : where },
    { value: "off", title: "Off", body: "The garden's own sky" },
  ];
  const pick = async (m: SkyMode) => {
    setBusy(m);
    await setMode(m);
    setBusy(null);
  };
  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="The garden's weather">
        {choices.map((c) => {
          // anything that isn't off is the real weather, however it was found
          const on = c.value === "off" ? mode === "off" : mode !== "off";
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy !== null}
              onClick={() => void pick(c.value)}
              className={`rounded-2xl border p-3 text-left transition-colors disabled:cursor-wait ${on ? "border-sun bg-sun-soft/40" : "border-line hover:border-ink-faint"}`}
              data-sky-mode={c.value}
            >
              <span className="block text-sm font-medium">{c.title}</span>
              <span className="mt-0.5 block truncate text-xs text-ink-faint">{c.body}</span>
            </button>
          );
        })}
      </div>
      {mode !== "off" && state?.locationError === "denied" && (
        <p className="mt-2 text-xs text-ink-faint" data-sky-denied>
          This device&apos;s location is blocked, so the weather follows your connection.
        </p>
      )}
    </div>
  );
}

/**
 * For Kairo's admins only: the garden in any weather, at any hour, on this
 * device. Everyone else never sees it.
 */
export function SkyPreviewPanel({ className = "" }: { className?: string }) {
  const { state } = useApp();
  const p = useSkyPreview();
  if (!state.user.isAdmin) return null;
  const chip = (on: boolean) =>
    `h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${on ? "border-sun bg-sun text-on-accent" : "border-line bg-card text-ink-soft hover:border-ink-faint hover:text-ink"}`;
  return (
    <div className={`rounded-2xl border border-dashed border-line p-3 ${className}`} data-sky-preview>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Preview, only you see this</span>
        {(p.weather || p.minute !== null) && (
          <button type="button" onClick={() => setSkyPreview({ weather: null, minute: null })} className="text-xs font-semibold text-sun-deep hover:underline" data-preview-reset>
            Back to real
          </button>
        )}
      </div>
      <div className="mt-2.5 text-xs font-medium text-ink-soft">Weather</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" className={chip(!p.weather)} onClick={() => setSkyPreview({ weather: null })} data-preview-weather="real">
          Real
        </button>
        {PREVIEW_WEATHERS.map((w) => (
          <button key={w.id} type="button" className={chip(p.weather === w.id)} onClick={() => setSkyPreview({ weather: w.id })} data-preview-weather={w.id}>
            {w.label}
          </button>
        ))}
      </div>
      <div className="mt-3 text-xs font-medium text-ink-soft">Time of day</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" className={chip(p.minute === null)} onClick={() => setSkyPreview({ minute: null })} data-preview-time="real">
          Now
        </button>
        {PREVIEW_TIMES.map((t) => (
          <button key={t.minute} type="button" className={chip(p.minute === t.minute)} onClick={() => setSkyPreview({ minute: t.minute })} data-preview-time={t.minute}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
