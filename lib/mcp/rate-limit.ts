/**
 * A per-key throttle.
 *
 * Not a security boundary — a serverless deployment runs many instances and
 * each holds its own counter, so the real ceiling is this number times however
 * many instances are warm. It is enough for what it is actually for: stopping
 * one runaway agent loop from emptying an Atlas M0's operation budget in a
 * minute, and giving a wedged client an error it can back off from.
 */

type Window = { count: number; resetAt: number };

declare global {
  var _kairoMcpRate: Map<string, Window> | undefined;
}

export const CALLS_PER_MINUTE = 120;
const WINDOW_MS = 60_000;
/** Stale windows are swept in bulk rather than with a timer per key. */
const MAX_TRACKED = 5000;

export type RateVerdict = { allowed: true; remaining: number } | { allowed: false; retryAfter: number };

/** `cost` is how many calls this request carries: a batch of fifty is fifty calls, not one. */
export function checkRate(keyId: string, limit = CALLS_PER_MINUTE, cost = 1): RateVerdict {
  global._kairoMcpRate ??= new Map();
  const store = global._kairoMcpRate;
  const now = Date.now();

  if (store.size > MAX_TRACKED) {
    for (const [id, w] of store) if (w.resetAt <= now) store.delete(id);
  }

  const current = store.get(keyId);
  if (!current || current.resetAt <= now) {
    if (cost > limit) return { allowed: false, retryAfter: 1 };
    store.set(keyId, { count: cost, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - cost };
  }
  if (current.count + cost > limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += cost;
  return { allowed: true, remaining: limit - current.count };
}
