import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kairo",
    short_name: "Kairo",
    description:
      "Where good days grow. Plan a day you'll actually finish, and grow your habits into a garden you can see.",
    start_url: "/today",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f7f6",
    theme_color: "#f4f7f6",
    icons: [
      // rounded tile — used as-is by browsers and desktop installs
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      // full-bleed square — Android applies its own mask, so this must not be pre-rounded
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
