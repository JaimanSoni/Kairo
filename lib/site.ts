import { CITY_SHOWN } from "./types";

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

export const SITE_TAGLINE = "Your whole day, in bloom.";

/** The name and the line together, the way titles and link previews say it. */
export const SITE_TITLE = "Kairo. Your whole day, in bloom";

export const SITE_DESCRIPTION =
  CITY_SHOWN
    ? "Plan a day you'll actually finish, keep habits that grow into a garden you can see, and move in next door to your friends in Kairo City."
    : "Tasks, habits and notes in one calm place. Plan a day you'll actually finish, and watch your habits grow into a garden you can see.";

/** Where a human should write to — matches the legal pages and /support/contact. */
export const SUPPORT_EMAIL = "kairo.support@jaimansoni.com";
