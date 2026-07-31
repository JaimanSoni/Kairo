import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
