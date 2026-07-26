import type { MetadataRoute } from "next";
import { ARTICLES } from "@/lib/support/content";

const BASE = (process.env.APP_URL || "https://kairo.jaimansoni.com").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/support`, changeFrequency: "weekly", priority: 0.8 },
    ...ARTICLES.map((a) => ({
      url: `${BASE}/support/${a.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
