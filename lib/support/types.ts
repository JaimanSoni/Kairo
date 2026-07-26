/**
 * Content model for the support site. Articles are structured data (not MDX)
 * so they can be searched, cross-linked, and rendered consistently.
 *
 * Inline text supports a tiny markup subset: **bold**, `code`, [label](/href).
 */

export type Inline = string;

export type Block =
  | { t: "p"; text: Inline }
  | { t: "ul"; items: Inline[] }
  | { t: "ol"; items: Inline[] }
  | { t: "note"; text: Inline }
  | { t: "tip"; text: Inline }
  | { t: "warn"; text: Inline }
  | { t: "keys"; rows: { k: string; d: Inline }[] }
  | { t: "table"; head: [string, string]; rows: [Inline, Inline][] };

export type Section = {
  /** Anchor id — stable, used for deep links and the table of contents. */
  id: string;
  heading: string;
  blocks: Block[];
};

export type Article = {
  slug: string;
  title: string;
  /** One sentence shown in listings, search results, and page metadata. */
  summary: string;
  categoryId: string;
  /** Extra search terms users might type that don't appear in the copy. */
  keywords: string[];
  sections: Section[];
};

export type Category = {
  id: string;
  name: string;
  description: string;
};
