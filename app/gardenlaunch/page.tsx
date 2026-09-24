import type { Metadata } from "next";
import { GardenFilm } from "@/components/launch/garden-film";

/**
 * The garden film, as a web page.
 *
 * Not linked from anywhere — it exists so the habits announcement can be
 * recorded from the real design system, with the app's own plants, rather
 * than mocked up in an editor. Left alone it plays and loops, which is what
 * a screen recording needs. The recorder can also drive it frame by frame:
 *
 *   LAUNCH_URL=http://localhost:3010/gardenlaunch node scripts/record-launch.mjs --aspect 16:9 --out kairo-garden-16x9.mp4
 *
 * Retime a beat in components/launch/garden-film.tsx and play it again;
 * nothing is baked into a file.
 */
export const metadata: Metadata = {
  title: "Kairo, garden film",
  robots: { index: false, follow: false },
};

export default function GardenLaunchPage() {
  return <GardenFilm />;
}
