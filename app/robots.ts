import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * What crawlers may read.
 *
 * The public half of Kairo is the landing page, pricing, policies and the help
 * centre. Everything else is one person's private planner and there is nothing
 * in it worth indexing.
 *
 * Note what is *not* disallowed: /home is the landing page under a second
 * address for signed-in users, and it carries `noindex` in its metadata.
 * Blocking it here would stop crawlers reading that tag, which is the usual way
 * a page ends up indexed as a bare URL — so it stays crawlable on purpose.
 */

/** Per-user or privileged. Nothing here renders the same twice. */
const PRIVATE = ["/today", "/calendar", "/upcoming", "/lists", "/log", "/billing", "/admin", "/api/"];

/**
 * Assistants and their training crawlers, listed explicitly.
 *
 * They are already covered by the wildcard group, but several honour only the
 * group naming them, and two of these tokens (Google-Extended,
 * Applebot-Extended) do no crawling at all — they exist purely to opt in or out
 * of training. Kairo's public pages are documentation, and being quotable by an
 * assistant is the point, so they are allowed the same paths as everyone else.
 */
const ASSISTANTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "DuckAssistBot",
  "cohere-ai",
  "meta-externalagent",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: ASSISTANTS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    // the host directive is a bare hostname, not a URL
    host: new URL(SITE_URL).host,
  };
}
