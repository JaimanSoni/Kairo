/**
 * Testimonials shown on the landing page.
 *
 * Only publish words someone actually said. Invented testimonials are a lie to
 * your visitors and unlawful advertising in most places. An empty array simply
 * hides the whole section.
 *
 * Three kinds are supported:
 *
 *  1. Anonymous  — quote only. Use `label` for soft attribution
 *                  ("Beta user", "Designer, Bangalore").
 *  2. Attributed — add `name`, optional `role`, optional `avatar`
 *                  (a path under /public, e.g. "/testimonials/asha.jpg").
 *  3. Recorded   — add `audio` or `video` pointing at a file in
 *                  /public/testimonials/. The quote doubles as the
 *                  transcript, so the words are readable without playing it.
 *
 * Recordings must be in a format every browser can play: **MP3 for audio**,
 * **MP4/H.264 for video**. Safari plays neither Ogg nor WebM, so convert
 * WhatsApp voice notes (.ogg) before adding them:
 *   ffmpeg -i note.ogg -ac 1 -ar 44100 -b:a 64k public/testimonials/name.mp3
 *
 * `featured: true` renders an entry larger — use it for one or two.
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
    id: "laksha-nahata",
    quote:
      "I like how clean the UI of this app is, and the way you can switch easily between 2 of your accounts and you can lock one account is really helpful. Other than that, the separators that are available that can help you separate between tasks and easily navigate and manage through them is great!",
    name: "Laksha Nahata",
    role: "Digital Marketing Executive, AllEvents",
    avatar: "/testimonials/laksha-nahata.jpg",
    audio: "/testimonials/laksha-nahata.mp3",
    featured: true,
  },
];
