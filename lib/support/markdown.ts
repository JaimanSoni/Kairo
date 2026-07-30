/**
 * Renders support articles as Markdown, for readers that aren't browsers.
 *
 * The articles are structured data rather than prose files, so the HTML page
 * and this share one source. Anything added to the block model has to be
 * handled in both — the switch below is exhaustive on purpose, so leaving a new
 * block type out is a type error rather than a silently missing paragraph.
 */

import type { Article, Block, Inline } from "./types";
import { CATEGORIES } from "./content";
import { SITE_URL } from "../site";

/**
 * Site-relative links become absolute. A markdown file is read detached from
 * the site — pasted into a prompt, fetched by a crawler, concatenated into
 * llms-full.txt — where `/support/capture` resolves against nothing.
 */
function absoluteLinks(text: Inline): string {
  return text.replace(/\]\((\/[^)]*)\)/g, (_m, href: string) => `](${SITE_URL}${href})`);
}

/** Table cells are pipe-delimited, so any literal pipe has to be escaped. */
function cell(text: Inline): string {
  return absoluteLinks(text).replace(/\|/g, "\\|");
}

function blockToMarkdown(block: Block): string {
  switch (block.t) {
    case "p":
      return absoluteLinks(block.text);

    case "ul":
      return block.items.map((i) => `- ${absoluteLinks(i)}`).join("\n");

    case "ol":
      return block.items.map((i, n) => `${n + 1}. ${absoluteLinks(i)}`).join("\n");

    // The three callouts differ only by label on the page; a blockquote with
    // the same label is the closest markdown has, and keeps the emphasis.
    case "note":
      return `> **Note:** ${absoluteLinks(block.text)}`;
    case "tip":
      return `> **Good to know:** ${absoluteLinks(block.text)}`;
    case "warn":
      return `> **Heads up:** ${absoluteLinks(block.text)}`;

    case "keys":
      return [
        "| Key | What it does |",
        "| --- | --- |",
        ...block.rows.map((r) => `| \`${r.k}\` | ${cell(r.d)} |`),
      ].join("\n");

    case "table":
      return [
        `| ${block.head.map((h) => cell(h)).join(" | ")} |`,
        `| ${block.head.map(() => "---").join(" | ")} |`,
        ...block.rows.map((r) => `| ${r.map((c) => cell(c)).join(" | ")} |`),
      ].join("\n");
  }
}

/**
 * One article as Markdown.
 *
 * `depth` shifts every heading down, so the same function produces a standalone
 * document (title as `#`) and a chapter inside llms-full.txt (title as `##`).
 */
export function articleToMarkdown(article: Article, depth = 0): string {
  const h = (level: number) => "#".repeat(level + depth);
  const category = CATEGORIES.find((c) => c.id === article.categoryId);
  const out: string[] = [
    `${h(1)} ${article.title}`,
    "",
    article.summary,
    "",
    `Source: ${SITE_URL}/support/${article.slug}`,
    ...(category ? [`Section: ${category.name}`] : []),
    "",
  ];

  for (const section of article.sections) {
    out.push(`${h(2)} ${section.heading}`, "");
    for (const block of section.blocks) {
      out.push(blockToMarkdown(block), "");
    }
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** A standalone `.md` file, with the front matter a doc reader expects. */
export function articleToMarkdownFile(article: Article): string {
  const category = CATEGORIES.find((c) => c.id === article.categoryId);
  const frontMatter = [
    "---",
    `title: ${JSON.stringify(article.title)}`,
    `description: ${JSON.stringify(article.summary)}`,
    `section: ${JSON.stringify(category?.name ?? "Help")}`,
    `keywords: ${JSON.stringify(article.keywords.join(", "))}`,
    `canonical: ${SITE_URL}/support/${article.slug}`,
    "---",
    "",
  ].join("\n");
  return frontMatter + articleToMarkdown(article);
}
