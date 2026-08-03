import type { MetadataRoute } from "next";
import { ARTICLES, DOCS_UPDATED } from "@/lib/support/content";
import { BLOG_UPDATED, POSTS } from "@/lib/blog/content";
import { SITE_URL } from "@/lib/site";

/**
 * Only pages a stranger can actually read.
 *
 * The app itself (/today, /lists, …) is per-user and behind sign-in, and /home
 * is the same landing page under a second address for signed-in users — it
 * carries a canonical back to `/`, so listing it here would invite exactly the
 * duplicate the canonical exists to prevent.
 *
 * `lastModified` is a real revision date, not build time. A date that changes
 * on every deploy is worse than none: crawlers learn to distrust it.
 */

const LANDING_UPDATED = "2026-07-31"; // pricing section, drawn mark
const PRICING_UPDATED = "2026-07-30"; // two plans
const PRIVACY_UPDATED = "2026-07-31"; // Google Analytics added
const LEGAL_UPDATED = "2026-07-28"; // terms, refunds

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: LANDING_UPDATED, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: PRICING_UPDATED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/support`, lastModified: DOCS_UPDATED, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/support/contact`, lastModified: DOCS_UPDATED, changeFrequency: "yearly", priority: 0.5 },
    ...ARTICLES.map((a) => ({
      url: `${SITE_URL}/support/${a.slug}`,
      lastModified: DOCS_UPDATED,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${SITE_URL}/blog`, lastModified: BLOG_UPDATED, changeFrequency: "weekly", priority: 0.8 },
    ...POSTS.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.updated,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/terms`, lastModified: LEGAL_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: PRIVACY_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/refunds`, lastModified: LEGAL_UPDATED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
