/**
 * A laptop, drawn rather than photographed.
 *
 * Deliberately generic — an unbranded aluminium silhouette. Kairo runs in a
 * browser, so implying a particular manufacturer's machine would be both a
 * trademark problem and a claim about the product that isn't true.
 *
 * Pure CSS keeps it crisp at any render size and lets the screen hold live
 * DOM, so the demos inside are the real components rather than a screenshot.
 */
export function Laptop({
  children,
  width,
}: {
  children: React.ReactNode;
  /** Screen width in px; everything else is derived from it. */
  width: number;
}) {
  const screenH = Math.round((width * 10) / 16);
  const bezel = Math.max(8, Math.round(width * 0.012));
  const lidRadius = Math.round(width * 0.018);

  return (
    <div style={{ width: width + bezel * 2 }}>
      {/* lid */}
      <div
        style={{
          padding: bezel,
          paddingBottom: bezel * 1.6,
          borderRadius: lidRadius,
          background: "linear-gradient(160deg, #4a4f4d 0%, #2c302f 40%, #1e2221 100%)",
          boxShadow:
            "0 2px 1px rgba(255,255,255,0.18) inset, 0 -1px 1px rgba(0,0,0,0.4) inset, 0 40px 80px -20px rgba(0,0,0,0.45)",
        }}
      >
        {/* camera */}
        <div
          style={{
            height: bezel * 0.5,
            display: "grid",
            placeItems: "center",
            marginBottom: bezel * 0.35,
          }}
        >
          <span
            style={{
              width: Math.max(3, bezel * 0.22),
              height: Math.max(3, bezel * 0.22),
              borderRadius: "50%",
              background: "#0d100f",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
              display: "block",
            }}
          />
        </div>
        {/* screen */}
        <div
          style={{
            width,
            height: screenH,
            borderRadius: Math.round(lidRadius * 0.45),
            overflow: "hidden",
            background: "#f4f7f6",
            position: "relative",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
          }}
        >
          {children}
          {/* a single soft sheen — enough to read as glass, not enough to fight the UI */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "linear-gradient(105deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 22%, rgba(255,255,255,0) 46%)",
            }}
          />
        </div>
      </div>

      {/* base: a shallow wedge seen almost edge-on */}
      <div
        style={{
          width: (width + bezel * 2) * 1.09,
          marginLeft: (width + bezel * 2) * -0.045,
          height: Math.max(8, Math.round(width * 0.016)),
          borderRadius: `0 0 ${Math.round(width * 0.01)}px ${Math.round(width * 0.01)}px`,
          background: "linear-gradient(180deg, #6c7270 0%, #3a3f3e 55%, #232726 100%)",
          boxShadow: "0 24px 40px -12px rgba(0,0,0,0.5)",
          position: "relative",
        }}
      >
        {/* the notch the lid is lifted by */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translateX(-50%)",
            width: "16%",
            height: Math.max(3, Math.round(width * 0.005)),
            borderRadius: `0 0 ${Math.round(width * 0.006)}px ${Math.round(width * 0.006)}px`,
            background: "rgba(0,0,0,0.45)",
          }}
        />
      </div>
    </div>
  );
}
