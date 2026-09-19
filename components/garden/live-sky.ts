"use client";

import { useSyncExternalStore } from "react";
import type { LiveSky } from "@/lib/weather-shared";
import { useClock } from "./fx";

/**
 * The real sky, for every garden on screen: asked once, shared by all of
 * them, and kept fresh while one is showing.
 *
 * Where it comes from is a choice kept on this device:
 *
 *   - "auto": the town your connection comes from. No prompt, nothing to
 *     set up, and usually right.
 *   - "here": this device's own location, asked for once. Rounded to about
 *     10 km before it leaves the browser, and asked for again quietly each
 *     time, so a trip takes its weather along.
 *   - "off": the garden's own weather, which clears as the day's habits get
 *     done, the way it always has.
 *
 * The last sky is remembered too, so opening Kairo in the rain shows rain
 * straight away rather than a sunny guess that clouds over a second later.
 */

export type SkyMode = "auto" | "here" | "off";

const MODE_KEY = "kairo:sky-mode";
const LAST_KEY = "kairo:sky-last";
/** How long an answer is good for before it is asked again. */
const FRESH_MS = 15 * 60_000;
/** An older answer still makes a better first picture than a guess. */
const SHOW_MS = 3 * 3600_000;
/** After a failure, wait a little before trying again. */
const RETRY_MS = 2 * 60_000;

export type SkyState = {
  mode: SkyMode;
  sky: LiveSky | null;
  /** The town your connection comes from, when we know it. */
  connection: string | null;
  /** When the sky was last answered. */
  at: number;
  status: "idle" | "loading" | "ready" | "unknown" | "failed";
  /** Asked for this device's location and didn't get it. */
  locationError: "denied" | "unavailable" | null;
};

let state: SkyState | null = null;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
let triedAt = 0;
let signedOut = false;
let timer: ReturnType<typeof setInterval> | null = null;

function read(): SkyState {
  if (state) return state;
  let mode: SkyMode = "auto";
  let sky: LiveSky | null = null;
  let connection: string | null = null;
  let at = 0;
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "here" || saved === "off") mode = saved;
    const last = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as { sky?: LiveSky | null; connection?: string | null; at?: number; mode?: SkyMode } | null;
    if (last && typeof last.at === "number" && Date.now() - last.at < SHOW_MS && last.mode === mode) {
      sky = last.sky ?? null;
      connection = last.connection ?? null;
      at = last.at;
    }
  } catch {
    /* private mode: start from nothing */
  }
  state = { mode, sky, connection, at, status: sky ? "ready" : "idle", locationError: null };
  return state;
}

function set(patch: Partial<SkyState>) {
  state = { ...read(), ...patch };
  for (const l of listeners) l();
}

/** This device's location, a tenth of a degree at a time. Without `ask`, only if it was already allowed. */
async function position(ask: boolean): Promise<{ lat: number; lon: number } | "denied" | "unavailable"> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return "unavailable";
  if (!ask) {
    try {
      const p = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
      if (p && p.state === "denied") return "denied";
      if (p && p.state !== "granted") return "unavailable";
    } catch {
      /* no permissions API: asking is how we find out */
    }
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: Math.round(pos.coords.latitude * 10) / 10, lon: Math.round(pos.coords.longitude * 10) / 10 }),
      (err) => resolve(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, maximumAge: 30 * 60_000, timeout: 12_000 }
    );
  });
}

function remember(s: SkyState) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ sky: s.sky, connection: s.connection, at: s.at, mode: s.mode }));
  } catch {
    /* private mode: it is asked again next time */
  }
}

function saveMode(mode: SkyMode) {
  try {
    if (mode === "auto") localStorage.removeItem(MODE_KEY);
    else localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* private mode: this visit only */
  }
}

async function load(ask = false): Promise<void> {
  if (signedOut) return;
  if (inflight) return inflight;
  inflight = (async () => {
    const mode = read().mode;
    if (mode === "off") return;
    triedAt = Date.now();
    if (!read().sky) set({ status: "loading" });
    let query = "";
    let locationError: SkyState["locationError"] = null;
    if (mode === "here") {
      const p = await position(ask);
      if (typeof p === "string") {
        locationError = p;
        // told no: back to the connection's town, and say why
        if (p === "denied") {
          saveMode("auto");
          set({ mode: "auto" });
        }
      } else {
        query = `?lat=${p.lat}&lon=${p.lon}`;
      }
    }
    try {
      const res = await fetch(`/api/weather${query}`, { cache: "no-store" });
      if (res.status === 401) {
        signedOut = true;
        set({ status: "unknown", sky: null, locationError });
        return;
      }
      if (!res.ok) {
        set({ status: "failed", locationError });
        return;
      }
      const body = (await res.json()) as { weather: LiveSky | null; connection: string | null };
      // the choice changed while this was on its way: its answer is for the old one
      if (read().mode !== (mode === "here" && locationError === "denied" ? "auto" : mode)) return;
      set({ sky: body.weather, connection: body.connection, at: Date.now(), status: body.weather ? "ready" : "unknown", locationError });
      remember(read());
    } catch {
      set({ status: "failed", locationError });
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

function due() {
  const s = read();
  if (s.mode === "off" || signedOut || document.hidden) return;
  const now = Date.now();
  if (now - s.at < FRESH_MS || now - triedAt < RETRY_MS) return;
  void load();
}

function onVisible() {
  if (!document.hidden) due();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    due();
    timer = setInterval(due, 5 * 60_000);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

const idle = () => () => {};
const none = () => null;

/** The sky over this garden, or null when it's off or not known (the garden keeps its own weather then). */
export function useLiveSky(enabled = true): LiveSky | null {
  const s = useSyncExternalStore(enabled ? subscribe : idle, enabled ? read : none, none);
  const p = useSkyPreview();
  if (enabled && p.weather) return previewSky(p.weather);
  return s && s.mode !== "off" ? s.sky : null;
}

/** Minutes past local midnight for your own garden: the clock, or the hour a preview asks for. */
export function useGardenMinute(enabled = true): number {
  const clock = useClock();
  const p = useSkyPreview();
  return enabled && p.minute !== null ? p.minute : clock;
}

/** The whole picture, for the places that let you change where the weather comes from. */
export function useSkySettings() {
  const s = useSyncExternalStore(subscribe, read, none);
  return {
    state: s,
    setMode: async (mode: SkyMode) => {
      if (mode === read().mode && mode !== "here") return;
      saveMode(mode);
      set({ mode, locationError: null, ...(mode === "off" ? {} : { at: 0 }) });
      if (mode === "off") return;
      // one already on its way was asked for the old choice
      if (inflight) await inflight;
      await load(mode === "here");
    },
  };
}

/** Sunrise and sunset in minutes past local midnight, from the sky's instants. */
export function sunMinutes(sky: LiveSky | null): { rise: number; set: number } | null {
  if (!sky?.sunrise || !sky.sunset) return null;
  const at = (iso: string) => {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  };
  const rise = at(sky.sunrise);
  const set = at(sky.sunset);
  // a device clock set somewhere else entirely: the fixed day is the better guess
  if (!(set - rise >= 4 * 60)) return null;
  return { rise, set };
}

/* ------------------------------------------------------------- preview */

/**
 * The garden in any weather and at any hour, for the people who make Kairo
 * to see how it looks without waiting for a storm or staying up for the
 * night. Kept on this device, and only ever over your own garden.
 */

export const PREVIEW_WEATHERS = [
  { id: "clear", label: "Sunny" },
  { id: "partly", label: "Partly cloudy" },
  { id: "cloudy", label: "Cloudy" },
  { id: "fog", label: "Fog" },
  { id: "drizzle", label: "Light rain" },
  { id: "rain", label: "Rain" },
  { id: "downpour", label: "Heavy rain" },
  { id: "showers", label: "Showers" },
  { id: "storm", label: "Storm" },
  { id: "snow", label: "Snow" },
  { id: "sleet", label: "Sleet" },
  { id: "windy", label: "Windy" },
] as const;
export type PreviewWeather = (typeof PREVIEW_WEATHERS)[number]["id"];

/** Minutes past midnight, around a sun that rises at 6:20 and sets at 6:35. */
export const PREVIEW_TIMES = [
  { minute: 6 * 60 + 30, label: "Sunrise" },
  { minute: 9 * 60, label: "Morning" },
  { minute: 12 * 60 + 30, label: "Noon" },
  { minute: 17 * 60 + 30, label: "Golden hour" },
  { minute: 19 * 60, label: "Dusk" },
  { minute: 22 * 60, label: "Night" },
] as const;

export type SkyPreview = { weather: PreviewWeather | null; minute: number | null };

const PREVIEW_KEY = "kairo:sky-preview";
const NO_PREVIEW: SkyPreview = { weather: null, minute: null };
let preview: SkyPreview | null = null;
const previewListeners = new Set<() => void>();

function readPreview(): SkyPreview {
  if (preview) return preview;
  try {
    const saved = JSON.parse(localStorage.getItem(PREVIEW_KEY) ?? "null") as SkyPreview | null;
    preview = saved && (saved.weather || typeof saved.minute === "number") ? { weather: saved.weather ?? null, minute: typeof saved.minute === "number" ? saved.minute : null } : NO_PREVIEW;
  } catch {
    preview = NO_PREVIEW;
  }
  return preview;
}

export function setSkyPreview(next: Partial<SkyPreview>) {
  preview = { ...readPreview(), ...next };
  try {
    if (!preview.weather && preview.minute === null) localStorage.removeItem(PREVIEW_KEY);
    else localStorage.setItem(PREVIEW_KEY, JSON.stringify(preview));
  } catch {
    /* private mode: this visit only */
  }
  for (const l of previewListeners) l();
}

function subscribePreview(cb: () => void) {
  previewListeners.add(cb);
  return () => {
    previewListeners.delete(cb);
  };
}

export function useSkyPreview(): SkyPreview {
  return useSyncExternalStore(subscribePreview, readPreview, () => NO_PREVIEW);
}

/** Today at a local hour, as an instant. */
function todayAt(minute: number): string {
  const d = new Date();
  d.setHours(0, minute, 0, 0);
  return d.toISOString();
}

/** The sky a preview asks for, around the same sunrise and sunset as its times. */
function previewSky(weather: PreviewWeather): LiveSky {
  const base: LiveSky = { kind: "clear", intensity: 2, thunder: false, showers: false, tempC: 24, windMs: 2, place: null, fahrenheit: false, sunrise: todayAt(6 * 60 + 20), sunset: todayAt(18 * 60 + 35), at: new Date().toISOString() };
  switch (weather) {
    case "drizzle":
      return { ...base, kind: "rain", intensity: 1 };
    case "downpour":
      return { ...base, kind: "rain", intensity: 3 };
    case "showers":
      return { ...base, kind: "rain", showers: true };
    case "storm":
      return { ...base, kind: "rain", intensity: 3, thunder: true, windMs: 11 };
    case "snow":
      return { ...base, kind: "snow", tempC: -2 };
    case "sleet":
      return { ...base, kind: "sleet", tempC: 1 };
    case "windy":
      return { ...base, kind: "partly", windMs: 12 };
    default:
      return { ...base, kind: weather };
  }
}
