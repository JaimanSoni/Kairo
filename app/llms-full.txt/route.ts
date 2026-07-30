import { ARTICLES, CATEGORIES, DOCS_UPDATED } from "@/lib/support/content";
import { articleToMarkdown } from "@/lib/support/markdown";
import { TRIAL_DAYS } from "@/lib/access";
import { PRICE_LABEL } from "@/lib/razorpay";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

/**
 * Every help article in one file, for readers that can't follow the links in
 * llms.txt. Same content, same order as the help site.
 */

export const dynamic = "force-static";

export function GET() {
  const parts: string[] = [
    `# ${SITE_NAME} — complete documentation`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `This file contains every help article on ${SITE_URL}/support, in full.`,
    `Last revised ${DOCS_UPDATED}. Individual articles are also available as`,
    `Markdown at ${SITE_URL}/support/<slug>.md, and the index is at ${SITE_URL}/llms.txt.`,
    "",
    `Pricing: a ${TRIAL_DAYS}-day free trial, then ${PRICE_LABEL} for one month, paid one month`,
    "at a time. No recurring subscription. Sign-in is Google only.",
    "",
    `Contact: ${SUPPORT_EMAIL}`,
    "",
    "---",
    "",
  ];

  for (const category of CATEGORIES) {
    const articles = ARTICLES.filter((a) => a.categoryId === category.id);
    if (articles.length === 0) continue;
    parts.push(`## ${category.name}`, "", category.description, "");
    for (const article of articles) {
      // depth 2: the article title lands at h3, under its category's h2
      parts.push(articleToMarkdown(article, 2), "");
    }
  }

  return new Response(parts.join("\n").replace(/\n{3,}/g, "\n\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
