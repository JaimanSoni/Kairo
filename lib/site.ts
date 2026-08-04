/**
 * The canonical origin, in one place.
 *
 * Every absolute URL the site emits — canonical tags, Open Graph, the sitemap,
 * robots.txt, llms.txt, the markdown mirrors — has to agree, or crawlers treat
 * the variants as different pages. APP_URL already exists for the OAuth
 * callback, so this reuses it rather than inventing a second source of truth.
 */
export const SITE_URL = (process.env.APP_URL || "https://kairo.jaimansoni.com").replace(/\/+$/, "");

export const SITE_NAME = "Kairo";

export const SITE_TAGLINE = "A daily planner that forgives.";

export const SITE_DESCRIPTION =
  "Plan a day you can actually finish, no red badges, no overdue guilt, no infinite lists.";

/** Where a human should write to — matches the legal pages and /support/contact. */
export const SUPPORT_EMAIL = "kairo.support@jaimansoni.com";
