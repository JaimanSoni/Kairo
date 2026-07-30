import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
