"use client";

import type { Phase } from "./scene";

/**
 * The land behind the garden, painted like the background of a gentle
 * Japanese TV anime on a summer afternoon: soft blue mountains, a grassy bank
 * with a fence and sunflowers, an empty lot with three concrete pipes in the
 * long grass, and a hillside of tiled-roof houses with a utility pole and
 * its wires. Big summer clouds drift over it all. Hand-painted pieces, laid
 * out back to front so the sky, the weather and the light pass between them.
 *
 * The art is painted in daylight. Every other hour is a grade laid over it:
 * a colour multiplied into the paint (through a mask cut from the picture
 * itself, so only the paint takes it, never the sky around it), plus a touch
 * of brightness and saturation. At night the houses swap to their own
 * painting, with the lamps lit.
 *
 * The mountains and hills are mirrored copies side by side, so they run to
 * any width without a seam; the pieces keep their shape and stand where the
 * hills put them. The meadow tiles on its own, softened with a wash so the
 * plants growing in it stay the first thing you see.
 */

/**
 * The art is cached hard (a day in the browser, a week at the edge), so each
 * new set goes in its own folder: new addresses, fetched fresh everywhere.
 * Changing a picture means a new folder, never the same name.
 */
export const ART_DIR = "/art/garden/v5";

export const ART = {
  mountains: `${ART_DIR}/mountains.webp`,
  hills: `${ART_DIR}/hills.webp`,
  lot: `${ART_DIR}/lot.webp`,
  townDay: `${ART_DIR}/town-day.webp`,
  townNight: `${ART_DIR}/town-night.webp`,
  meadow: `${ART_DIR}/meadow.webp`,
  balloon: `${ART_DIR}/balloon.webp`,
  clouds: [`${ART_DIR}/cloud-1.webp`, `${ART_DIR}/cloud-2.webp`, `${ART_DIR}/cloud-3.webp`],
} as const;

/** Width over height of each piece, so it can be sized by height alone. */
const RATIO = { lot: 900 / 463, townDay: 900 / 474, townNight: 900 / 537, balloon: 299 / 420, clouds: [600 / 401, 600 / 368, 600 / 181] };

type Grade = { filter?: string; tint?: string; amount?: number };

/** How each hour lights a painting made in daylight. */
export const GRADE: Record<Phase, Grade> = {
  day: {},
  dawn: { filter: "brightness(0.96) saturate(0.95)", tint: "#e6a2c4", amount: 0.38 },
  golden: { filter: "saturate(1.08) brightness(1.02)", tint: "#ffb060", amount: 0.4 },
  dusk: { filter: "brightness(0.82) saturate(0.8)", tint: "#6a55a8", amount: 0.62 },
  night: { filter: "brightness(0.7) saturate(0.7)", tint: "#1f3470", amount: 0.88 },
};
/** The lamplit houses are already painted for the night: they need only a little of the blue. */
const NIGHT_VILLAGE: Grade = { filter: "brightness(0.95)", tint: "#1f3470", amount: 0.3 };

type Fit = { size: string; repeat: string; position: string };
export const COVER: Fit = { size: "100% 100%", repeat: "no-repeat", position: "center" };
const STRIP: Fit = { size: "auto 100%", repeat: "repeat-x", position: "center bottom" };

/**
 * One painted piece, with the hour's grade and any snow laid over it. The
 * overlays wear the painting as their mask, so they colour the paint and
 * nothing else.
 */
export function Paint({ src, fit, grade, frost, className, style }: { src: string; fit: Fit; grade: Grade; frost: number; className?: string; style?: React.CSSProperties }) {
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
  const town = night ? { src: ART.townNight, ratio: RATIO.townNight, grade: NIGHT_VILLAGE } : { src: ART.townDay, ratio: RATIO.townDay, grade };
  return (
    <div className={`gd-par pointer-events-none absolute -left-[3%] bottom-0 w-[106%] ${className}`} style={{ ...style, containerType: "size" }} aria-hidden data-landscape="painted">
      <Paint src={ART.mountains} fit={STRIP} grade={grade} frost={frost} className="inset-x-0 bottom-[26%] h-[64%]" />
      {/* sized by the land's height, but never wider than their share of the width: big on a wide screen, still in proportion on a phone */}
      <Paint src={ART.lot} fit={COVER} grade={grade} frost={frost} className="bottom-[8%] left-[1%]" style={{ aspectRatio: RATIO.lot, width: `min(${detail ? 42 : 40}cqw, ${((detail ? 0.92 : 0.98) * RATIO.lot * 100).toFixed(1)}cqh)` }} />
      <Paint
        src={town.src}
        fit={COVER}
        grade={town.grade}
        frost={frost}
        className={detail ? "bottom-[10%] right-[1%]" : "bottom-[8%] right-[1%]"}
        style={{ aspectRatio: town.ratio, width: `min(${detail ? 56 : 54}cqw, ${((detail ? 1.12 : 1.2) * town.ratio * 100).toFixed(1)}cqh)` }}
      />
      {/* the hills fade out at their foot, into the meadow drawn behind them, instead of stopping on a line */}
      <Paint
        src={ART.hills}
        fit={STRIP}
        grade={grade}
        frost={frost}
        className="inset-x-0 bottom-0 h-[46%]"
        style={{ WebkitMaskImage: "linear-gradient(to bottom, #000 62%, transparent 100%)", maskImage: "linear-gradient(to bottom, #000 62%, transparent 100%)" }}
      />
    </div>
  );
}

/**
 * The meadow the garden grows in, graded to the hour like the land behind it.
 * The same meadow runs under the foot of the hills, anchored to its bottom
 * edge while the ground is anchored to its top, so the tiles meet exactly
 * where the two do and the grass carries on without a line.
 */
export function PaintedMeadow({ phase, tile, anchor = "top" }: { phase: Phase; tile: number; anchor?: "top" | "bottom" }) {
  const grade = GRADE[phase];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden data-meadow={anchor}>
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `url(${ART.meadow})`, backgroundSize: `${tile}px ${tile}px`, backgroundPosition: anchor === "top" ? "0 0" : "0 100%", filter: grade.filter }}
      />
      {/* a soft wash, so the grass sits back and the plants come forward */}
      <div className="absolute inset-0" style={{ background: "rgba(150, 189, 108, 0.32)" }} />
      {grade.tint && <div className="absolute inset-0" style={{ background: grade.tint, opacity: grade.amount, mixBlendMode: "multiply" }} />}
    </div>
  );
}

/**
 * A hot air balloon drifting across the sky on a calm day, bobbing as it
 * goes. It flies behind the clouds and in front of the far mountains, comes
 * down for the night, and stays grounded in wind, rain, fog or snow.
 */
export function PaintedBalloon({ phase, className }: { phase: Phase; className: string }) {
  return (
    <div className="gd-balloon-flight pointer-events-none absolute" aria-hidden data-balloon>
      <div className="gd-balloon-bob">
        <Paint src={ART.balloon} fit={COVER} grade={GRADE[phase]} frost={0} className={`relative ${className}`} style={{ aspectRatio: RATIO.balloon }} />
      </div>
    </div>
  );
}

/** How a painted cloud looks at each hour, and in each weather. */
const CLOUD_LIGHT: Record<Phase, string> = {
  day: "",
  dawn: "sepia(0.25) saturate(1.3) hue-rotate(-18deg) brightness(0.98)",
  golden: "sepia(0.45) saturate(1.5) hue-rotate(-12deg)",
  dusk: "sepia(0.35) saturate(1.2) hue-rotate(-45deg) brightness(0.7)",
  night: "brightness(0.38) saturate(0.6) hue-rotate(10deg)",
};
const CLOUD_WEATHER = { white: "", grey: "grayscale(0.5) brightness(0.92)", rain: "grayscale(0.7) brightness(0.74)", storm: "grayscale(0.8) brightness(0.52)", mist: "grayscale(0.35) brightness(1.04)" };

/** One of the painted summer clouds, sized by width. */
export function PaintedCloud({ index, width, phase, tone }: { index: number; width: number | string; phase: Phase; tone: keyof typeof CLOUD_WEATHER }) {
  const i = index % ART.clouds.length;
  const filter = `${CLOUD_LIGHT[phase]} ${CLOUD_WEATHER[tone]}`.trim();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ART.clouds[i]} alt="" draggable={false} className="block select-none" style={{ width, aspectRatio: RATIO.clouds[i], filter: filter || undefined }} />
  );
}
