import { ImageResponse } from "next/og";
import { inviteInfo } from "@/lib/city";
import { utcToday, type HabitColor } from "@/lib/habits-shared";

/**
 * The picture of a saved plot: who saved it, their garden with its own
 * plants, and the plot beside it roped off for you. It's the link's preview
 * when shared, and the picture in the invite email.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A plot saved for you in Kairo City";

const CANOPY: Record<HabitColor, string> = {
  sun: "#2bb39f",
  amber: "#f0b44c",
  rose: "#f27a8d",
  lilac: "#a893e6",
  sky: "#63a9dd",
  moss: "#5fb86e",
};

function Fence({ width }: { width: number }) {
  return (
    <div style={{ position: "absolute", left: 18, top: -30, width: width - 36, display: "flex", justifyContent: "space-between" }}>
      {Array.from({ length: Math.floor((width - 36) / 24) }, (_, i) => (
        <div key={i} style={{ width: 13, height: 40, background: "#fbf6ea", borderRadius: "7px 7px 0 0", boxShadow: "0 2px 0 rgba(0,0,0,0.08)" }} />
      ))}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const info = await inviteInfo(null, code, utcToday());
  const who = info?.inviterName ?? "A friend";
  const garden = info?.inviter ?? null;
  const plants = (garden?.plants ?? []).slice(0, 5);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", background: "linear-gradient(180deg, #3aa1ea 0%, #8ad0f6 50%, #d8f2fb 100%)", fontFamily: "sans-serif" }}>
        {/* sun, skyline, hills */}
        <div style={{ position: "absolute", right: 80, top: 40, width: 110, height: 110, borderRadius: 999, background: "#ffd35c", boxShadow: "0 0 80px 26px rgba(255, 211, 92, 0.55)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 250, display: "flex", alignItems: "flex-end", gap: 10, paddingLeft: 20 }}>
          {[120, 70, 150, 95, 60, 130, 85, 110, 160, 75, 140, 90, 120, 65].map((h, i) => (
            <div key={i} style={{ width: 70, height: h, background: i % 2 ? "#86b1cf" : "#9ec3dd", borderRadius: "4px 4px 0 0" }} />
          ))}
        </div>
        <div style={{ position: "absolute", left: -80, right: -80, bottom: 190, height: 150, borderRadius: "50% 50% 0 0", background: "#9fd48c" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 250, background: "#6fb863" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 64, background: "#4a4f57", display: "flex", alignItems: "center", justifyContent: "space-around" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} style={{ width: 48, height: 7, background: "#f4d35e", borderRadius: 4 }} />
          ))}
        </div>

        {/* the words */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40 }}>
          <div style={{ fontSize: 24, letterSpacing: 6, color: "rgba(255,255,255,0.95)", fontWeight: 800 }}>KAIRO CITY</div>
          <div style={{ fontSize: who.length > 14 ? 54 : 64, lineHeight: 1.05, color: "#ffffff", fontWeight: 800, marginTop: 10, textShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>{`${who} saved you a plot`}</div>
        </div>

        {/* their garden, and the plot beside it */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 84, display: "flex", justifyContent: "center", gap: 70 }}>
          <div style={{ position: "relative", width: 440, height: 210, borderRadius: 26, background: "#7cc46c", boxShadow: "0 10px 0 #8a5a3b", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 18, paddingBottom: 26 }}>
            <Fence width={440} />
            <div style={{ position: "absolute", top: -84, left: 120, display: "flex", alignItems: "center", background: "#e2bd8a", borderRadius: 14, padding: "8px 18px", boxShadow: "0 6px 14px rgba(0,0,0,0.18)" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#3b2716" }}>{garden ? `${who} · Lv ${garden.level}` : who}</div>
            </div>
            {plants.length === 0 ? (
              <div style={{ fontSize: 24, color: "#ffffff", fontWeight: 700 }}>A garden getting started</div>
            ) : (
              plants.map((p, i) => {
                const h = 70 + p.stage * 16;
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: h * 0.72, height: h * 0.72, borderRadius: 999, background: CANOPY[p.color] ?? "#5fb86e", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: p.doneToday ? "0 0 26px 8px rgba(255,244,170,0.9)" : "none" }}>
                      <div style={{ width: h * 0.26, height: h * 0.26, borderRadius: 999, background: "rgba(255,255,255,0.4)" }} />
                    </div>
                    <div style={{ width: 9, height: h * 0.4, background: "#7a5230", marginTop: -6 }} />
                    <div style={{ width: h * 0.62, height: 14, borderRadius: 999, background: "#8a5a3b" }} />
                  </div>
                );
              })
            )}
          </div>
          <div style={{ position: "relative", width: 380, height: 210, borderRadius: 26, background: "#88cc76", border: "6px dashed #f4c95d", boxShadow: "0 10px 0 #8a5a3b", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Fence width={370} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#ffffff", borderRadius: 22, padding: "14px 30px", boxShadow: "0 8px 20px rgba(0,0,0,0.15)" }}>
              <div style={{ fontSize: 22, letterSpacing: 4, color: "#b8862b", fontWeight: 800 }}>RESERVED</div>
              <div style={{ fontSize: 34, color: "#1c2624", fontWeight: 800, marginTop: 2 }}>for you</div>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
