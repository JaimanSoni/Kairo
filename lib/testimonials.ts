/**
 * Testimonials shown on the landing page.
 *
 * ────────────────────────────────────────────────────────────────────────
 *  THESE ARE PLACEHOLDERS. Replace them with real words from real people
 *  before you launch — publishing invented testimonials is a lie to your
 *  visitors (and illegal advertising in many places). Delete any entry you
 *  can't attribute to something someone actually said.
 *  An empty array simply hides the whole section.
 * ────────────────────────────────────────────────────────────────────────
 *
 * Three kinds are supported:
 *
 *  1. Anonymous  — quote only. Use `label` for soft attribution
 *                  ("Beta user", "Designer, Bangalore").
 *  2. Attributed — add `name`, optional `role`, optional `avatar`
 *                  (a path under /public, e.g. "/testimonials/asha.jpg").
 *  3. Recorded   — add `video` (or `audio`) pointing at a file in
 *                  /public/testimonials/. The quote doubles as the
 *                  transcript, so the words are readable without playing it.
 *
 * Keep `featured: true` for one or two of the strongest — they render larger.
 */

export type Testimonial = {
  id: string;
  /** The words. For recordings this is the transcript, so keep it faithful. */
  quote: string;
  /** Leave out for an anonymous entry. */
  name?: string;
  role?: string;
  /** Soft attribution when there's no name — "Beta user", "Teacher". */
  label?: string;
  avatar?: string;
  /** A recording in /public — the quote stays visible as its transcript. */
  video?: string;
  audio?: string;
  poster?: string;
  featured?: boolean;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "placeholder-1",
    quote:
      "Replace this with something a real person actually said about Kairo — the more specific the better. Quotes that name a moment (“the morning sweep”) beat generic praise.",
    label: "Example — replace before launch",
    featured: true,
  },
  {
    id: "placeholder-2",
    quote:
      "This one shows an anonymous testimonial: no name, just a soft label underneath. Good for people who are happy to be quoted but not identified.",
    label: "Example — anonymous",
  },
  {
    id: "placeholder-3",
    quote:
      "And this one shows an attributed testimonial with a name and role. Add an avatar image under /public to show a face alongside it.",
    name: "Your customer's name",
    role: "Their role, City",
  },
];
