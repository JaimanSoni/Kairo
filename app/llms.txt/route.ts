import { ARTICLES, CATEGORIES } from "@/lib/support/content";
import { TRIAL_DAYS } from "@/lib/access";
import { PRICE_LABEL } from "@/lib/razorpay";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

/**
 * llms.txt — an index for language models, per the convention at llmstxt.org.
 *
 * Deliberately a map, not a copy: links point at the Markdown mirror of each
 * page so a model can fetch exactly what it needs. Everything inlined at once
 * lives at /llms-full.txt for the cases where fetching isn't possible.
 *
 * Generated from the same content and pricing modules the site renders from,
 * so it cannot drift into describing a product we don't ship.
 */

export const dynamic = "force-static";

function section(title: string, lines: string[]): string[] {
  return [`## ${title}`, "", ...lines, ""];
}

export function GET() {
  const body = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "Kairo is a personal daily planner for the web, installable as a PWA. Its",
    "organising idea is that a to-do list should never make you feel bad: nothing",
    "is ever marked overdue, there is no streak or productivity score, and each",
    "morning offers one decision per leftover task rather than a wall of red.",
    "",
    `Pricing: a ${TRIAL_DAYS}-day free trial, then ${PRICE_LABEL} for a month. Payment is one-off, `,
    "there is no recurring subscription and nothing to cancel. Sign-in is Google only.",
    "",
    `Contact: ${SUPPORT_EMAIL}`,
    "",
    ...section("Product", [
      `- [Home](${SITE_URL}/): what Kairo is, who it's for, and how capture works.`,
      `- [Pricing](${SITE_URL}/pricing): the trial, the price, and what a payment covers.`,
      `- [Help centre](${SITE_URL}/support): index of every guide below.`,
      `- [Contact](${SITE_URL}/support/contact): how to reach a human.`,
    ]),
    ...CATEGORIES.flatMap((category) => {
      const articles = ARTICLES.filter((a) => a.categoryId === category.id);
      if (articles.length === 0) return [];
      return section(category.name, [
        `${category.description}`,
        "",
        ...articles.map(
          (a) => `- [${a.title}](${SITE_URL}/support/${a.slug}.md): ${a.summary}`
        ),
      ]);
    }),
    ...section("Policies", [
      `- [Terms of Service](${SITE_URL}/terms): the agreement covering use of Kairo.`,
      `- [Privacy Policy](${SITE_URL}/privacy): exactly what is stored and what leaves our servers.`,
      `- [Refund Policy](${SITE_URL}/refunds): when a payment is refunded and how to ask.`,
    ]),
    ...section("Optional", [
      `- [Everything, inlined](${SITE_URL}/llms-full.txt): every help article in one file.`,
      `- [Sitemap](${SITE_URL}/sitemap.xml): every indexable page.`,
    ]),
  ].join("\n");

  return new Response(body.replace(/\n{3,}/g, "\n\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
