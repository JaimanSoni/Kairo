import type { Post, PostKind } from "./types";
import { USE_CASES } from "./posts/use-cases";
import { GUIDES } from "./posts/guides";
import { COMPARISONS } from "./posts/comparisons";

/**
 * The blog's single source of truth. The pages, the sitemap, llms.txt, and
 * the JSON-LD all read from here, so a post added to one file appears
 * everywhere at once and nowhere can disagree.
 */

export const POSTS: Post[] = [...USE_CASES, ...GUIDES, ...COMPARISONS];

/** Groups for the index page, in display order. */
export const KINDS: { kind: PostKind; name: string; description: string }[] = [
  {
    kind: "use-case",
    name: "By use case",
    description: "What Kairo is like for your kind of day, honestly, including when it isn't the right tool.",
  },
  {
    kind: "guide",
    name: "Guides",
    description: "Planning methods that work with or without Kairo: deep work, time blocking, and the psychology behind both.",
  },
  {
    kind: "comparison",
    name: "Comparisons",
    description: "Kairo against the field, with real prices and the gaps on our side stated as plainly as everyone else's.",
  },
];

export function postsOf(kind: PostKind): Post[] {
  return POSTS.filter((p) => p.kind === kind);
}

export function findPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

/** Every FAQ on a post, for the FAQPage JSON-LD. Same array the page renders. */
export function faqsOf(post: Post): { q: string; a: string }[] {
  return post.sections.flatMap((s) =>
    s.blocks.flatMap((b) => (b.t === "faq" ? b.items : []))
  );
}

/** Strips the inline markup subset so schema and meta text stay plain. */
export function plain(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/** Rounded-up minutes at a 200 wpm read, computed so it can never go stale. */
export function readingMinutes(post: Post): number {
  let words = 0;
  const count = (t: string) => {
    words += t.split(/\s+/).length;
  };
  for (const s of post.sections) {
    count(s.heading);
    for (const b of s.blocks) {
      if (b.t === "p" || b.t === "note" || b.t === "tip" || b.t === "warn") count(b.text);
      else if (b.t === "ul" || b.t === "ol") b.items.forEach(count);
      else if (b.t === "table") b.rows.forEach((r) => r.forEach(count));
      else if (b.t === "wtable") b.rows.forEach((r) => r.forEach(count));
      else if (b.t === "faq") b.items.forEach((i) => { count(i.q); count(i.a); });
      else if (b.t === "cta") count(b.text);
      else if (b.t === "keys") b.rows.forEach((r) => count(r.d));
    }
  }
  return Math.max(2, Math.ceil(words / 200));
}

/** The most recent `updated` across all posts, for the sitemap's index row. */
export const BLOG_UPDATED = POSTS.reduce(
  (latest, p) => (p.updated > latest ? p.updated : latest),
  "2026-08-03"
);
