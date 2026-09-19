"use client";

import type { Phase } from "./scene";

/**
 * The land behind the garden, painted: far mountains, the hills with their
 * fence, a waterfall off a mossy cliff, and a little village on a knoll with
 * a windmill. Hand-painted pieces, laid out back to front so the sky, the
 * weather and the light can pass between them.
 *
 * The art is painted in daylight. Every other hour is a grade laid over it:
 * a colour multiplied into the paint (through a mask cut from the picture
 * itself, so only the paint takes it, never the sky around it), plus a touch
 * of brightness and saturation. At night the village swaps to its own
 * painting, with the lamps lit.
 *
 * The mountains and hills are mirrored copies side by side, so they run to
 * any width without a seam; the pieces keep their shape and stand where the
 * hills put them. The meadow tiles on its own, softened with a wash so the
 * plants growing in it stay the first thing you see.
 */

export const ART = {
  mountains: "/art/garden/mountains.webp",
  hills: "/art/garden/hills.webp",
  falls: "/art/garden/falls.webp",
  villageDay: "/art/garden/village-day.webp",
  villageNight: "/art/garden/village-night.webp",
  meadow: "/art/garden/meadow.webp",
  balloonDay: "/art/garden/balloon-day.webp",
  balloonNight: "/art/garden/balloon-night.webp",
} as const;

/** Width over height of each piece, so it can be sized by height alone. */
const RATIO = { falls: 900 / 605, villageDay: 900 / 483, villageNight: 900 / 514, balloon: 295 / 420 };

type Grade = { filter?: string; tint?: string; amount?: number };

/** How each hour lights a painting made in daylight. */
export const GRADE: Record<Phase, Grade> = {
  day: {},
  dawn: { filter: "brightness(0.96) saturate(0.95)", tint: "#e6a2c4", amount: 0.38 },
  golden: { filter: "saturate(1.08) brightness(1.02)", tint: "#ffb060", amount: 0.4 },
  dusk: { filter: "brightness(0.82) saturate(0.8)", tint: "#6a55a8", amount: 0.62 },
  night: { filter: "brightness(0.7) saturate(0.7)", tint: "#1f3470", amount: 0.88 },
};
/** The lamplit village is already painted for the night: it needs only a little of the blue. */
const NIGHT_VILLAGE: Grade = { filter: "brightness(0.95)", tint: "#1f3470", amount: 0.3 };

type Fit = { size: string; repeat: string; position: string };
const COVER: Fit = { size: "100% 100%", repeat: "no-repeat", position: "center" };
const STRIP: Fit = { size: "auto 100%", repeat: "repeat-x", position: "center bottom" };

/**
 * One painted piece, with the hour's grade and any snow laid over it. The
 * overlays wear the painting as their mask, so they colour the paint and
 * nothing else.
 */
function Paint({ src, fit, grade, frost, className, style }: { src: string; fit: Fit; grade: Grade; frost: number; className?: string; style?: React.CSSProperties }) {
  const mask = (): React.CSSProperties => ({
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskSize: fit.size,
    maskSize: fit.size,
    WebkitMaskRepeat: fit.repeat,
    maskRepeat: fit.repeat,
    WebkitMaskPosition: fit.position,
    maskPosition: fit.position,
  });
  return (
    <div className={`absolute ${className ?? ""}`} style={style}>
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `url(${src})`, backgroundSize: fit.size, backgroundRepeat: fit.repeat, backgroundPosition: fit.position, filter: grade.filter }}
      />
      {grade.tint && <div className="absolute inset-0" style={{ ...mask(), background: grade.tint, opacity: grade.amount, mixBlendMode: "multiply" }} />}
      {frost > 0 && <div className="absolute inset-0" style={{ ...mask(), background: "#f4f8fb", opacity: frost * 0.55 }} />}
    </div>
  );
}

export function PaintedLand({
  phase,
  className,
  style,
  frost,
  detail,
}: {
  phase: Phase;
  /** Where the land sits and how tall it is. */
  className: string;
  style?: React.CSSProperties;
  /** Snow lying on everything, 0 to 1. */
  frost: number;
  /** Everything, or only the big shapes (the small card on Today). */
  detail: boolean;
}) {
  const grade = GRADE[phase];
  const night = phase === "night";
  const village = night ? { src: ART.villageNight, ratio: RATIO.villageNight, grade: NIGHT_VILLAGE } : { src: ART.villageDay, ratio: RATIO.villageDay, grade };
  return (
    <div className={`gd-par pointer-events-none absolute -left-[3%] bottom-0 w-[106%] ${className}`} style={style} aria-hidden data-landscape="painted">
      <Paint src={ART.mountains} fit={STRIP} grade={grade} frost={frost} className="inset-x-0 bottom-[26%] h-[64%]" />
      {detail && (
        <Paint src={ART.falls} fit={COVER} grade={grade} frost={frost} className="bottom-[14%] left-[2%] h-[86%]" style={{ aspectRatio: RATIO.falls }} />
      )}
      <Paint
        src={village.src}
        fit={COVER}
        grade={village.grade}
        frost={frost}
        className={detail ? "bottom-[16%] right-[4%] h-[84%]" : "bottom-[10%] right-[14%] h-[80%]"}
        style={{ aspectRatio: village.ratio }}
      />
      <Paint src={ART.hills} fit={STRIP} grade={grade} frost={frost} className="inset-x-0 -bottom-[2%] h-[46%]" />
    </div>
  );
}

/** The meadow the garden grows in, graded to the hour like the land behind it. */
export function PaintedMeadow({ phase, tile }: { phase: Phase; tile: number }) {
  const grade = GRADE[phase];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden data-meadow>
      <div className="absolute inset-0" style={{ backgroundImage: `url(${ART.meadow})`, backgroundSize: `${tile}px ${tile}px`, filter: grade.filter }} />
      {/* a soft wash, so the grass sits back and the plants come forward */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(168, 200, 120, 0.34) 0%, rgba(132, 178, 96, 0.3) 100%)" }} />
      {grade.tint && <div className="absolute inset-0" style={{ background: grade.tint, opacity: grade.amount, mixBlendMode: "multiply" }} />}
    </div>
  );
}

/**
 * A hot air balloon drifting across the sky on a calm day, bobbing as it
 * goes; after dark, its burner glowing. It flies behind the clouds and in
 * front of the far mountains, and stays grounded in wind, rain, fog or snow.
 */
export function PaintedBalloon({ phase, className }: { phase: Phase; className: string }) {
  const lit = phase === "night" || phase === "dusk";
  return (
    <div className="gd-balloon-flight pointer-events-none absolute" aria-hidden data-balloon>
      <div className="gd-balloon-bob">
        <Paint src={lit ? ART.balloonNight : ART.balloonDay} fit={COVER} grade={lit ? NIGHT_VILLAGE : GRADE[phase]} frost={0} className={`relative ${className}`} style={{ aspectRatio: RATIO.balloon }} />
      </div>
    </div>
  );
}
