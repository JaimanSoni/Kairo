import type { Metadata } from "next";
import { LaunchFilm } from "@/components/launch/film";

/**
 * The launch film, as a web page.
 *
 * Not a marketing page and not linked from anywhere — it exists so the video
 * can be rendered from the real product rather than mocked up in an editor.
 * The recorder drives it through `window.__seek(ms)` and photographs one frame
 * at a time, so what ships is exactly what this route draws.
 *
 * To retime a shot, edit the timeline in components/launch/film.tsx and
 * re-record. Nothing here is baked into a file.
 */
export const metadata: Metadata = {
  title: "Kairo — launch film",
  robots: { index: false, follow: false },
};

export default function LaunchPage() {
  return <LaunchFilm />;
}
