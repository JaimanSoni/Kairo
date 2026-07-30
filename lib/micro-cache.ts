/**
 * A tiny TTL cache for data that is read on almost every request and changes
 * almost never — plans, billing settings, the disabled flag.
 *
 * Why this exists: the database is an Atlas M0, which throttles operations and
 * caps connections. The expensive thing there isn't complexity, it's sheer
 * request count — so the fix is to stop re-reading two tiny, near-static
 * collections on every page view and API call.
 *
 * Why not Next's data cache: the pages involved are cookie-dynamic, the API
 * routes aren't React renders, and an explicit cache with a kill switch is
 * easier to reason about when real money depends on what it returns.
 *
 * Design rules, in order:
 *   - State lives on globalThis, same as the Mongo client — Next bundles lib/
 *     per route, so module scope can be duplicated per entrypoint and would
 *     quietly fragment the cache into per-route copies.
 *   - Concurrent misses share one load. A cold instance taking ten requests
 *     must issue one query, not ten.
 *   - A failed load serves the stale value if one exists (an Atlas blip should
 *     not take the paywall down with it), and the retry is deferred a beat so
 *     a down database isn't hammered once per request.
 *   - Writers call bust() after writing, so the instance that made a change
 *     sees it immediately. Other instances catch up within the TTL — that
 *     bounded staleness is the price, and every caller that can't pay it can
 *     pass {fresh: true}.
 *   - KAIRO_CACHE_OFF=1 bypasses everything, for debugging and for measuring.
 */

type Entry<T> = { at: number; data: T };
type Store<T> = { value: Entry<T> | null; inflight: Promise<T> | null };

const OFF = () => process.env.KAIRO_CACHE_OFF === "1";

declare global {
  var _kairoMicroCache: Map<string, Store<unknown>> | undefined;
}

function store<T>(key: string): Store<T> {
  global._kairoMicroCache ??= new Map();
  let s = global._kairoMicroCache.get(key) as Store<T> | undefined;
  if (!s) {
    s = { value: null, inflight: null };
    global._kairoMicroCache.set(key, s as Store<unknown>);
  }
  return s;
}

export type MicroCache<T> = {
  get(opts?: { fresh?: boolean }): Promise<T>;
  bust(): void;
};

export function microCache<T>(key: string, ttlMs: number, load: () => Promise<T>): MicroCache<T> {
  return {
    async get(opts?: { fresh?: boolean }): Promise<T> {
      if (OFF()) return load();

      const s = store<T>(key);
      const fresh = opts?.fresh === true;

      if (!fresh && s.value && Date.now() - s.value.at < ttlMs) {
        return s.value.data;
      }

      // A fresh read that finds a load already in flight joins it: the result
      // is newer than anything cached, which is what fresh actually wants.
      if (s.inflight) return s.inflight;

      s.inflight = load()
        .then((data) => {
          s.value = { at: Date.now(), data };
          return data;
        })
        .catch((err: unknown) => {
          if (s.value) {
            // Serve stale and push the next attempt out half a TTL, so a down
            // database sees one retry per interval instead of one per request.
            console.error(`[cache] ${key}: load failed, serving stale`, err);
            s.value = { at: Date.now() - Math.floor(ttlMs / 2), data: s.value.data };
            return s.value.data;
          }
          throw err;
        })
        .finally(() => {
          s.inflight = null;
        });
      return s.inflight;
    },

    bust(): void {
      store<T>(key).value = null;
    },
  };
}
