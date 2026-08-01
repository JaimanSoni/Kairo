import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Static assets are served with explicit cache headers so the CDN in
      // front (Cloudflare, and Vercel's own edge) can actually hold them:
      // a day in the browser, a week at the edge, and stale served while
      // revalidating. Not immutable on purpose, these filenames are not
      // hashed, so an icon or OG image swap must be able to land.
      {
        source: "/:all*(png|jpg|jpeg|webp|avif|svg|ico|gif|mp3|mp4|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // The section used to be called Upcoming — old bookmarks and installed
      // PWAs still know that address.
      { source: "/upcoming", destination: "/calendar", permanent: true },
      { source: "/support/upcoming", destination: "/support/calendar", permanent: true },
    ];
  },
  async rewrites() {
    return [
      // Every help article also answers as plain Markdown at `/support/<slug>.md`,
      // which is what llms.txt points at. The dot is escaped because `source`
      // patterns treat it as a regex metacharacter.
      { source: "/support/:slug\\.md", destination: "/api/docs/:slug" },
    ];
  },
};

export default nextConfig;
