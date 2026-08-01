/**
 * What a plan can grant.
 *
 * Features are defined here, in code, and plans only reference them. That
 * direction matters: a toggle in the admin that no code reads would look like
 * it worked and quietly sell someone nothing. Every key below is enforced on
 * the server at the place named in `enforcedAt` — if you add a key, add the
 * check with it.
 *
 * Pure data, no imports: the access rules and the browser both read this.
 */

export const FEATURES = {
  "multi-account": {
    name: "Multiple accounts",
    description: "Sign in to more than one account and switch between them without signing out.",
    enforcedAt: "POST /api/auth/google, when a session already exists",
  },
  "ai-capture": {
    name: "AI capture",
    description:
      "Reads a captured sentence and fills in the day, time, estimate and list. Without it, capture still works, the local parser handles dates and times.",
    enforcedAt: "POST /api/parse",
  },
  "app-lock": {
    name: "Lock the whole app",
    description:
      "A PIN over all of Kairo. Locking individual lists is not part of this and is available on every plan.",
    enforcedAt: "POST /api/applock",
  },
} as const;

export type FeatureKey = keyof typeof FEATURES;

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

export function isFeatureKey(x: unknown): x is FeatureKey {
  return typeof x === "string" && x in FEATURES;
}

/** Everything — what a trial, a comped account, or payments-off grants. */
export const ALL_FEATURES: FeatureKey[] = [...FEATURE_KEYS];

/** Narrows an untrusted list (an admin form post) to keys that really exist. */
export function sanitiseFeatures(input: unknown): FeatureKey[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<FeatureKey>();
  for (const x of input) if (isFeatureKey(x)) seen.add(x);
  return FEATURE_KEYS.filter((k) => seen.has(k));
}
