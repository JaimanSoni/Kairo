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

export const SITE_TAGLINE = "Where good days grow.";

/** The name and the line together, the way titles and link previews say it. */
export const SITE_TITLE = "Kairo, where good days grow";

export const SITE_DESCRIPTION =
  "Plan a day you'll actually finish, keep habits that grow into a garden you can see, and move in next door to your friends in Kairo City.";

/** Where a human should write to — matches the legal pages and /support/contact. */
export const SUPPORT_EMAIL = "kairo.support@jaimansoni.com";
