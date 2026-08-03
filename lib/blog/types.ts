import type { Block as SupportBlock, Inline } from "@/lib/support/types";

/**
 * Content model for the blog. Same philosophy as support: structured data,
 * not MDX, so every post renders consistently, cross-links safely, and can
 * be mirrored into sitemap entries, llms.txt lines, and JSON-LD without a
 * parser. Inline text keeps the same tiny markup subset: **bold**, `code`,
 * [label](/href).
 *
 * Three extra blocks beyond support's set, because marketing pages need
 * them: a wide table (comparisons run three or four columns), a visible FAQ
 * (which is also the source of the FAQPage schema, never a separate copy),
 * and a call to action.
 */

export type BlogBlock =
  | SupportBlock
  | { t: "wtable"; head: string[]; rows: Inline[][] }
  | { t: "faq"; items: { q: string; a: Inline }[] }
  | { t: "cta"; heading: string; text: Inline };

export type BlogSection = {
  /** Anchor id, stable, used for deep links and the on-page contents. */
  id: string;
  heading: string;
  blocks: BlogBlock[];
};

export type PostKind = "use-case" | "guide" | "comparison";

export type Post = {
  slug: string;
  kind: PostKind;
  /** The H1. Written for the reader, not the crawler. */
  title: string;
  /** The <title>. Hand-written per page, never templated from the H1. */
  metaTitle: string;
  /** The meta description, also the listing summary. Hand-written. */
  description: string;
  /** ISO dates. Bump `updated` when the content meaningfully changes. */
  published: string;
  updated: string;
  keywords: string[];
  sections: BlogSection[];
  /** Slugs of posts worth reading next. */
  related: string[];
};
