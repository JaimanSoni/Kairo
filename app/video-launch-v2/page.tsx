import type { Metadata } from "next";
import { VideoLaunchFilmV2 } from "@/components/launch/video-film-v2";

/**
 * The second cut of the launch film — longer, more cinematic, told with
 * hand-animated product UI. Not linked from anywhere; it exists to be
 * recorded frame by frame through `window.__seek(ms)`.
 */
export const metadata: Metadata = {
  title: "Kairo, launch film v2",
  robots: { index: false, follow: false },
};

export default function VideoLaunchV2Page() {
  return <VideoLaunchFilmV2 />;
}
