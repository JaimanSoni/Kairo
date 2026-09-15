import { ImageResponse } from "next/og";
import { inviteInfo } from "@/lib/city";
import { utcToday } from "@/lib/habits-shared";

/** The card a saved plot's link unfurls as: who saved it, and the plot waiting beside their garden. */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A plot saved for you in Kairo City";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const info = await inviteInfo(null, code, utcToday());
  const who = info?.inviterName ?? "A friend";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "linear-gradient(180deg, #3aa1ea 0%, #8ad0f6 55%, #d8f2fb 100%)", fontFamily: "sans-serif" }}>
        <div style={{ position: "absolute", right: 90, top: 50, width: 120, height: 120, borderRadius: 999, background: "#ffd35c", boxShadow: "0 0 80px 26px rgba(255, 211, 92, 0.55)" }} />
        <div style={{ position: "absolute", left: -80, right: -80, bottom: 170, height: 200, borderRadius: "50% 50% 0 0", background: "#9fd48c" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 210, background: "#6fb863" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 70, background: "#4a4f57" }} />
        {/* the plot, roped off with a sign */}
        <div style={{ position: "absolute", right: 110, bottom: 80, width: 420, height: 190, borderRadius: 26, background: "#7cc46c", border: "6px dashed #f4c95d", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#ffffff", borderRadius: 22, padding: "14px 30px" }}>
            <div style={{ fontSize: 22, letterSpacing: 4, color: "#b8862b", fontWeight: 800 }}>RESERVED</div>
            <div style={{ fontSize: 32, color: "#1c2624", fontWeight: 800, marginTop: 4 }}>for you</div>
          </div>
        </div>
        {/* a white picket fence behind it */}
        <div style={{ position: "absolute", right: 120, bottom: 262, display: "flex", gap: 12 }}>
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} style={{ width: 14, height: 46, background: "#fbf6ea", borderRadius: "6px 6px 0 0" }} />
          ))}
        </div>
        <div style={{ position: "absolute", left: 70, top: 70, display: "flex", flexDirection: "column", maxWidth: 600 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, color: "rgba(255,255,255,0.92)", fontWeight: 700 }}>KAIRO CITY</div>
          <div style={{ fontSize: who.length > 12 ? 58 : 70, lineHeight: 1.05, color: "#ffffff", fontWeight: 800, marginTop: 14, textShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>{who}</div>
          <div style={{ fontSize: 58, lineHeight: 1.05, color: "#ffffff", fontWeight: 800, textShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>saved you a plot</div>
          <div style={{ fontSize: 30, color: "#ffffff", marginTop: 24, fontWeight: 600, textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>Right next to their garden.</div>
        </div>
        <div style={{ position: "absolute", left: 70, bottom: 100, display: "flex" }}>
          <div style={{ fontSize: 32, color: "#3b2a00", background: "#ffd166", borderRadius: 999, padding: "12px 30px", fontWeight: 800 }}>Claim it, free</div>
        </div>
      </div>
    ),
    size
  );
}
