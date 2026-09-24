import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

/**
 * The picture a Kairo link shows when it is shared.
 *
 * It used to be the garden, which is a lovely picture of one feature and a
 * confusing answer to "what is this". A link pasted into a work channel gets
 * about a second of someone's attention, so this says the name, says what it
 * is in one line, and stops.
 *
 * Deliberately plain: no screenshot to go stale, no art to redraw, no fonts
 * to ship. It is generated at build time and cached, so it costs nothing to
 * serve.
 *
 * The mark is drawn rather than typed. There is no font here but whatever
 * the renderer has, and it has no glyph for the asterisk Kairo uses -- typing
 * it puts an empty box where the logo should be, which is a worse first
 * impression than no logo at all.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Kairo — tasks, habits and notes in one calm place";

const PAPER = "#f4f7f6";
const INK = "#1c2624";
const INK_SOFT = "#54655f";
const TEAL = "#0c9384";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: PAPER,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* one soft wash behind the name, so it is not a flat rectangle */}
        <div
          style={{
            position: "absolute",
            top: 120,
            left: 370,
            width: 460,
            height: 460,
            borderRadius: 999,
            background: "radial-gradient(circle, rgba(12,147,132,0.11), rgba(12,147,132,0))",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <svg width="92" height="92" viewBox="0 0 24 24" fill="none">
            <g stroke={TEAL} strokeWidth="3.1" strokeLinecap="round">
              <path d="M12 3.5v17" />
              <path d="M4.6 7.75l14.8 8.5" />
              <path d="M4.6 16.25l14.8-8.5" />
            </g>
          </svg>
          <span style={{ fontSize: 136, color: INK, letterSpacing: -5, fontWeight: 600 }}>
            {SITE_NAME.toLowerCase()}
          </span>
        </div>

        <div style={{ marginTop: 30, fontSize: 40, color: INK_SOFT, letterSpacing: -0.6 }}>
          Tasks, habits and notes in one calm place.
        </div>

        <div style={{ position: "absolute", bottom: 54, fontSize: 26, color: "#93a39d", letterSpacing: 0.4 }}>
          kairo.jaimansoni.com
        </div>
      </div>
    ),
    size
  );
}
