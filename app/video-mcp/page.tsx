import type { Metadata } from "next";
import { McpFilm } from "@/components/launch/mcp-film";

/**
 * The Connections film, as a web page.
 *
 * Not linked from anywhere — it exists so the announcement video can be
 * rendered from the real design system rather than mocked up in an editor.
 * The recorder drives it through `window.__seek(ms)` and photographs one frame
 * at a time, so what ships is exactly what this route draws.
 *
 *   node scripts/record-launch.mjs --aspect 16:9 --out kairo-mcp-16x9-silent.mp4
 *
 * with LAUNCH_URL pointed here. Retime a shot in components/launch/mcp-film.tsx
 * and re-record; nothing is baked into a file.
 */
export const metadata: Metadata = {
  title: "Kairo, connections film",
  robots: { index: false, follow: false },
};

export default function VideoMcpPage() {
  return <McpFilm />;
}
