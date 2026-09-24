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

/**
 * The name and what it is, the way titles and link previews say it.
 *
 * A title is read by somebody who has never heard of this, in a tab strip or
 * a row of search results, so it says what the thing is rather than how it
 * feels about itself. The poetry lives on the page, where there is room for
 * it.
 */
export const SITE_TITLE = "Kairo. Tasks, habits and notes in one place";

export const SITE_DESCRIPTION =
  CITY_SHOWN
    ? "Plan a day you'll actually finish, keep habits that grow into a garden you can see, and move in next door to your friends in Kairo City."
    : "Tasks, habits and notes in one calm place. Plan a day you'll actually finish, and watch your habits grow into a garden you can see.";

/** Where a human should write to — matches the legal pages and /support/contact. */
export const SUPPORT_EMAIL = "kairo.support@jaimansoni.com";
