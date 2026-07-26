import type { MetadataRoute } from "next";

const BASE = (process.env.APP_URL || "https://kairo.jaimansoni.com").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/support"],
        // the app itself is private per-user — no value in crawling it
        disallow: ["/today", "/upcoming", "/lists", "/log", "/admin", "/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
