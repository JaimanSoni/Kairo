import { getDb } from "./db";
import { SITE_URL } from "./site";
import type { LiveSky, SkyKind } from "./weather-shared";

/**
 * The weather over a garden: what the sky is doing where its gardener is,
 * this hour, so a rainy afternoon in the world is a rainy afternoon in the
 * garden too.
 *
 * The forecast comes from MET Norway (api.met.no): free, worldwide, no key,
 * and open to commercial use as long as we say who we are and don't ask
 * twice for what we already have. So:
 *
 *   - Places are rounded to a tenth of a degree (about 10 km) before anything
 *     is asked or kept. That is finer than the forecast itself, it lets one
 *     answer serve a whole town, and it means no one's location is stored.
 *   - Each tenth-of-a-degree square is fetched once per MET's own Expires
 *     time (usually half an hour) and shared by everyone in it. If MET is
 *     down, the last answer serves for a few hours rather than nothing.
 */

const ENDPOINT = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
/** MET asks every client to name itself and a way to reach it. */
const USER_AGENT = `Kairo/1.0 (+${SITE_URL})`;
const TIMEOUT_MS = 5_000;
/** Kept a while past its freshness, to stand in if MET can't be reached. */
const STALE_GRACE_MS = 6 * 3600_000;

/** One hour of the forecast, as much of it as a sky needs. */
type Hour = { t: string; symbol: string; temp: number | null; wind: number | null };
type CacheRow = { _id: string; hours: Hour[]; freshUntil: Date; keepUntil: Date };

let indexReady: Promise<unknown> | null = null;
async function cache() {
  const col = (await getDb()).collection<CacheRow>("weather_cache");
  indexReady ??= col.createIndex({ keepUntil: 1 }, { expireAfterSeconds: 0, name: "weather_ttl" }).catch((err: unknown) => {
    indexReady = null;
    throw err;
  });
  await indexReady;
  return col;
}

export type Place = { lat: number; lon: number };

/** A tenth of a degree: the square a place is looked up by. */
export const cell = (x: number) => Math.round(x * 10) / 10;

export function validPlace(lat: unknown, lon: unknown): Place | null {
  const a = typeof lat === "string" && lat.trim() ? Number(lat) : typeof lat === "number" ? lat : NaN;
  const o = typeof lon === "string" && lon.trim() ? Number(lon) : typeof lon === "number" ? lon : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(o) || Math.abs(a) > 90 || Math.abs(o) > 180) return null;
  return { lat: cell(a), lon: cell(o) };
}

/** Kilometres between two places, near enough. */
export function kmBetween(a: Place, b: Place): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Today's sunrise and sunset at a place, as instants (NOAA's solar
 * equations: good to a minute or two, which is plenty for a sky). Null in a
 * polar day or night, when there is no rise or set to speak of.
 */
export function sunTimes(place: Place, now = new Date()): { rise: Date; set: Date } | null {
  const rad = Math.PI / 180;
  const start = Date.UTC(now.getUTCFullYear(), 0, 1);
  const day = Math.floor((now.getTime() - start) / 86_400_000);
  const g = ((2 * Math.PI) / 365) * day;
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const lat = place.lat * rad;
  const cosHa = Math.cos(90.833 * rad) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
  if (!(cosHa >= -1 && cosHa <= 1)) return null;
  const ha = Math.acos(cosHa) / rad;
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const at = (minutes: number) => new Date(midnight + minutes * 60_000);
  return { rise: at(720 - 4 * (place.lon + ha) - eqTime), set: at(720 - 4 * (place.lon - ha) - eqTime) };
}

/**
 * MET's symbol for an hour ("heavyrainshowersandthunder_day") as the few
 * things a sky needs to know: what kind, how hard, thunder or not.
 */
export function readSymbol(symbol: string): Pick<LiveSky, "kind" | "intensity" | "thunder" | "showers"> {
  const base = symbol.replace(/_(day|night|polartwilight)$/, "");
  const intensity = (base.startsWith("heavy") ? 3 : base.startsWith("light") ? 1 : 2) as 1 | 2 | 3;
  const thunder = base.includes("thunder");
  const showers = base.includes("showers");
  let kind: SkyKind;
  if (base === "clearsky") kind = "clear";
  else if (base === "fair") kind = "fair";
  else if (base === "partlycloudy") kind = "partly";
  else if (base === "cloudy") kind = "cloudy";
  else if (base === "fog") kind = "fog";
  else if (base.includes("sleet")) kind = "sleet";
  else if (base.includes("snow")) kind = "snow";
  else if (base.includes("rain") || thunder) kind = "rain";
  else kind = "cloudy";
  return { kind, intensity, thunder, showers };
}

type MetSeries = {
  properties?: {
    timeseries?: {
      time: string;
      data?: {
        instant?: { details?: { air_temperature?: number; wind_speed?: number } };
        next_1_hours?: { summary?: { symbol_code?: string } };
        next_6_hours?: { summary?: { symbol_code?: string } };
      };
    }[];
  };
};

async function fetchHours(place: Place): Promise<{ hours: Hour[]; freshUntil: Date } | null> {
  const url = `${ENDPOINT}?lat=${place.lat.toFixed(1)}&lon=${place.lon.toFixed(1)}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let body: MetSeries;
  try {
    body = (await res.json()) as MetSeries;
  } catch {
    return null;
  }
  const hours: Hour[] = [];
  for (const entry of body.properties?.timeseries ?? []) {
    const symbol = entry.data?.next_1_hours?.summary?.symbol_code ?? entry.data?.next_6_hours?.summary?.symbol_code;
    if (!symbol || typeof entry.time !== "string") continue;
    const details = entry.data?.instant?.details;
    hours.push({ t: entry.time, symbol, temp: typeof details?.air_temperature === "number" ? details.air_temperature : null, wind: typeof details?.wind_speed === "number" ? details.wind_speed : null });
    if (hours.length >= 30) break;
  }
  if (!hours.length) return null;
  // MET says how long its answer holds; we listen, within reason
  const now = Date.now();
  const expires = Date.parse(res.headers.get("expires") ?? "");
  const until = Number.isFinite(expires) ? Math.min(Math.max(expires, now + 10 * 60_000), now + 2 * 3600_000) : now + 30 * 60_000;
  return { hours, freshUntil: new Date(until) };
}

/** The hour we're in: the latest one that has started, if it isn't too old to trust. */
function hourNow(hours: Hour[], now: number): Hour | null {
  let pick: Hour | null = null;
  for (const h of hours) {
    const t = Date.parse(h.t);
    if (t <= now) pick = h;
    else break;
  }
  pick ??= hours[0] ?? null;
  if (!pick) return null;
  return Math.abs(now - Date.parse(pick.t)) <= 3 * 3600_000 ? pick : null;
}

async function hoursFor(place: Place): Promise<Hour[] | null> {
  const col = await cache();
  const key = `${place.lat.toFixed(1)},${place.lon.toFixed(1)}`;
  const row = await col.findOne({ _id: key });
  if (row && row.freshUntil.getTime() > Date.now()) return row.hours;
  const fetched = await fetchHours(place);
  if (!fetched) return row?.hours ?? null;
  await col.updateOne(
    { _id: key },
    { $set: { hours: fetched.hours, freshUntil: fetched.freshUntil, keepUntil: new Date(fetched.freshUntil.getTime() + STALE_GRACE_MS) } },
    { upsert: true }
  );
  return fetched.hours;
}

/** Where the Fahrenheit thermometers are. */
const FAHRENHEIT = new Set(["US", "PR", "GU", "VI", "AS", "MP", "UM", "LR", "BS", "BZ", "KY", "PW", "FM", "MH"]);

export async function liveSky(place: Place, extra: { name: string | null; country: string | null }, now = new Date()): Promise<LiveSky | null> {
  const hours = await hoursFor(place);
  if (!hours) return null;
  const hour = hourNow(hours, now.getTime());
  if (!hour) return null;
  const sun = sunTimes(place, now);
  return {
    ...readSymbol(hour.symbol),
    tempC: hour.temp,
    windMs: hour.wind,
    place: extra.name,
    fahrenheit: extra.country ? FAHRENHEIT.has(extra.country.toUpperCase()) : false,
    sunrise: sun?.rise.toISOString() ?? null,
    sunset: sun?.set.toISOString() ?? null,
    at: hour.t,
  };
}
