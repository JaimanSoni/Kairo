import { ImageResponse } from "next/og";
import { visitGarden } from "@/lib/city";
import { GARDEN_LEVELS, utcToday, type HabitColor } from "@/lib/habits-shared";

/** The card a shared garden unfurls as: its level and name over a garden in bloom. */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A garden in Kairo City";

const CANOPY: Record<HabitColor, string> = {
  sun: "#2bb39f",
  amber: "#f0b44c",
  rose: "#f27a8d",
  lilac: "#a893e6",
  sky: "#63a9dd",
  moss: "#5fb86e",
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const garden = await visitGarden(null, id, utcToday());
  const name = garden?.name ?? "A garden";
  const level = garden ? GARDEN_LEVELS[garden.level - 1] : GARDEN_LEVELS[0];
  const plants = (garden?.plants ?? []).slice(0, 5);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "linear-gradient(180deg, #3fa6ec 0%, #9ad8f7 55%, #d4f1fb 100%)", fontFamily: "sans-serif" }}>
        {/* the sun */}
        <div style={{ position: "absolute", right: 110, top: 60, width: 130, height: 130, borderRadius: 999, background: "#ffd35c", boxShadow: "0 0 90px 30px rgba(255, 211, 92, 0.55)" }} />
        {/* hills and ground */}
        <div style={{ position: "absolute", left: -100, right: -100, bottom: 150, height: 220, borderRadius: "50% 50% 0 0", background: "#9fd48c" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 200, background: "linear-gradient(180deg, #74bd66 0%, #56a452 100%)" }} />
        {/* the plants */}
        <div style={{ position: "absolute", right: 60, bottom: 70, display: "flex", alignItems: "flex-end", gap: 26 }}>
          {plants.map((p, i) => {
            const h = 90 + p.stage * 26;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: h * 0.75, height: h * 0.75, borderRadius: 999, background: CANOPY[p.color] ?? "#5fb86e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: h * 0.3, height: h * 0.3, borderRadius: 999, background: "rgba(255,255,255,0.35)" }} />
                </div>
                <div style={{ width: 12, height: h * 0.45, background: "#7a5230", marginTop: -8 }} />
                <div style={{ width: h * 0.7, height: 18, borderRadius: 999, background: "#8a5a3b" }} />
              </div>
            );
          })}
        </div>
        {/* the words */}
        <div style={{ position: "absolute", left: 70, top: 70, display: "flex", flexDirection: "column", maxWidth: 620 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>KAIRO CITY</div>
          <div style={{ fontSize: name.length > 14 ? 60 : 74, lineHeight: 1.05, color: "#ffffff", fontWeight: 800, marginTop: 14, textShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>{`${name}'s`}</div>
          <div style={{ fontSize: name.length > 14 ? 60 : 74, lineHeight: 1.05, color: "#ffffff", fontWeight: 800, textShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>garden</div>
          <div style={{ display: "flex", marginTop: 26 }}>
            <div style={{ fontSize: 34, color: "#1c2624", background: "#ffd166", borderRadius: 999, padding: "10px 26px", fontWeight: 800 }}>{`Level ${garden?.level ?? 1} · ${level.name}`}</div>
          </div>
          <div style={{ fontSize: 30, color: "#ffffff", marginTop: 22, fontWeight: 600, textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>{garden ? `${garden.score} points${garden.rank ? ` · #${garden.rank} in the city` : ""}` : "Grown by real habits"}</div>
        </div>
        <div style={{ position: "absolute", left: 70, bottom: 60, fontSize: 30, color: "#ffffff", fontWeight: 700 }}>Can your habits grow a better one?</div>
      </div>
    ),
    size
  );
}
