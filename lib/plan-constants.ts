/**
 * Plan facts with no database attached, so the pure access rules can read them.
 *
 * `lib/plans.ts` talks to MongoDB; `lib/access.ts` must not import anything
 * that does. Anything both need lives here.
 */

/**
 * The plan an account falls back to.
 *
 * Everyone who paid before plans existed bought the whole product, so a paid
 * period with no plan recorded resolves to full access. Reading it as the
 * cheaper tier would quietly take away something already sold.
 */
export const FALLBACK_PAID_PLAN = "full";
