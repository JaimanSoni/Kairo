import type { Metadata } from "next";
import { MilestoneFilm } from "@/components/launch/milestone-film";

/**
 * The 250-tasks milestone film — ten seconds, square, light theme.
 * Not linked from anywhere: it exists to be watched here or recorded frame
 * by frame through `window.__seek(ms)`.
 */
export const metadata: Metadata = {
  title: "Kairo, 250 tasks",
  robots: { index: false, follow: false },
};

export default function VideoMilestonePage() {
  return <MilestoneFilm />;
}
