import type { Metadata } from "next";
import { VideoLaunchFilm } from "@/components/launch/video-film";

/**
 * The kinetic launch film, as a web page — the motion-graphics cut, distinct
 * from the /launch product film. Not linked from anywhere; it exists to be
 * recorded frame by frame through `window.__seek(ms)`.
 */
export const metadata: Metadata = {
  title: "Kairo — kinetic launch film",
  robots: { index: false, follow: false },
};

export default function VideoLaunchPage() {
  return <VideoLaunchFilm />;
}
