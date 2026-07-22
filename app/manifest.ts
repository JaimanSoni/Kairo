import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kairo — win the day",
    short_name: "Kairo",
    description:
      "A daily planner that forgives. Plan a day you can actually finish — no red badges, no overdue guilt.",
    start_url: "/today",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf6ef",
    theme_color: "#fbf6ef",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
