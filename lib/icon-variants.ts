/**
 * The icon candidates, as SVG source strings.
 *
 * Strings rather than JSX because the same markup is previewed in the page,
 * serialised to an .svg download, and rasterised to PNG through a canvas — one
 * source for all three. Every internal id carries an `__ID__` placeholder that
 * render() swaps for a unique prefix, so two previews of the same variant on
 * one page can't fight over gradient ids.
 *
 * All geometry derives from the existing mark — the ✱ as three rounded bars —
 * and every colour is a palette token. An icon that invents its own palette
 * stops being the app's icon.
 */

export type IconVariant = {
  key: string;
  name: string;
  note: string;
  build: (opts?: { fullBleed?: boolean }) => string;
};

/* palette tokens, verbatim from globals.css */
const SUN = "#0c9384";
const SUN_DEEP = "#076b60";
const SKY = "#4e93c9";
const MOSS = "#4ca75b";
const CLAY = "#d96354";
const LILAC = "#8d7bd4";
const PAPER = "#f4f7f6";
const INK = "#1c2624";

const S = 512;
/** iOS-style squircle approximation; 0 for maskable full-bleed exports. */
const RX = Math.round(S * 0.2265);

function svg(defs: string, body: string, opts?: { fullBleed?: boolean }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
<defs>${defs}</defs>
<clipPath id="__ID__tile"><rect width="${S}" height="${S}" rx="${opts?.fullBleed ? 0 : RX}"/></clipPath>
<g clip-path="url(#__ID__tile)">${body}</g>
</svg>`;
}

/** The ✱: three rounded bars, 60° apart. */
function mark(fill: string, scale = 1, extra = ""): string {
  const w = 54 * scale;
  const h = 288 * scale;
  const x = 256 - w / 2;
  const y = 256 - h / 2;
  const bar = (rot: number) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" transform="rotate(${rot} 256 256)"/>`;
  return `<g fill="${fill}" ${extra}>${bar(0)}${bar(60)}${bar(120)}</g>`;
}

/** Soft top sheen + hairline inner ring — the "expensive tile" furniture. */
function polish(): string {
  return `<path d="M0 0 H${S} V${S * 0.42} C ${S * 0.7} ${S * 0.52}, ${S * 0.3} ${S * 0.52}, 0 ${S * 0.42} Z" fill="#ffffff" opacity="0.10"/>
<rect x="5" y="5" width="${S - 10}" height="${S - 10}" rx="${RX - 4}" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="10"/>`;
}

const shadow = (id: string, dy: number, blur: number, color: string) =>
  `<filter id="__ID__${id}" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="${dy}" stdDeviation="${blur}" flood-color="${color}"/></filter>`;

export const ICON_VARIANTS: IconVariant[] = [
  {
    key: "tide",
    name: "Tide",
    note: "The current mark, finished properly, deeper gradient, sheen, a real shadow under the ✱.",
    build: (o) =>
      svg(
        `<linearGradient id="__ID__bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#15ab9b"/><stop offset="1" stop-color="${SUN_DEEP}"/>
        </linearGradient>${shadow("sh", 10, 16, "rgba(3,46,41,0.45)")}`,
        `<rect width="${S}" height="${S}" fill="url(#__ID__bg)"/>
         ${mark(PAPER, 1, `filter="url(#__ID__sh)"`)}
         ${polish()}`,
        o
      ),
  },
  {
    key: "lagoon",
    name: "Lagoon",
    note: "Teal into sky on the diagonal, the two calm colours of the app in one wash.",
    build: (o) =>
      svg(
        `<linearGradient id="__ID__bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${SUN}"/><stop offset="1" stop-color="${SKY}"/>
        </linearGradient>
        <radialGradient id="__ID__glow" cx="0.5" cy="0.32" r="0.6">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>${shadow("sh", 10, 16, "rgba(9,50,74,0.4)")}`,
        `<rect width="${S}" height="${S}" fill="url(#__ID__bg)"/>
         <rect width="${S}" height="${S}" fill="url(#__ID__glow)"/>
         ${mark(PAPER, 1, `filter="url(#__ID__sh)"`)}
         ${polish()}`,
        o
      ),
  },
  {
    key: "ink",
    name: "Ink",
    note: "Lights off. The ✱ carries the gradient instead of the tile, reads premium at every size.",
    build: (o) =>
      svg(
        `<linearGradient id="__ID__bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#232f2c"/><stop offset="1" stop-color="#141b19"/>
        </linearGradient>
        <linearGradient id="__ID__mk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#19c3af"/><stop offset="1" stop-color="#6fb3e0"/>
        </linearGradient>${shadow("sh", 0, 22, "rgba(20,195,175,0.45)")}`,
        `<rect width="${S}" height="${S}" fill="url(#__ID__bg)"/>
         ${mark("url(#__ID__mk)", 1, `filter="url(#__ID__sh)"`)}
         <rect x="5" y="5" width="${S - 10}" height="${S - 10}" rx="${RX - 4}" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="10"/>`,
        o
      ),
  },
  {
    key: "aurora",
    name: "Aurora",
    note: "The whole palette as northern lights behind the mark, loudest of the set.",
    build: (o) =>
      svg(
        `<radialGradient id="__ID__a" cx="0.2" cy="0.15" r="0.8"><stop offset="0" stop-color="${SKY}"/><stop offset="1" stop-color="${SKY}" stop-opacity="0"/></radialGradient>
         <radialGradient id="__ID__b" cx="0.85" cy="0.25" r="0.75"><stop offset="0" stop-color="${LILAC}"/><stop offset="1" stop-color="${LILAC}" stop-opacity="0"/></radialGradient>
         <radialGradient id="__ID__c" cx="0.25" cy="0.9" r="0.8"><stop offset="0" stop-color="${MOSS}"/><stop offset="1" stop-color="${MOSS}" stop-opacity="0"/></radialGradient>
         <radialGradient id="__ID__d" cx="0.9" cy="0.85" r="0.7"><stop offset="0" stop-color="${CLAY}"/><stop offset="1" stop-color="${CLAY}" stop-opacity="0"/></radialGradient>
         ${shadow("sh", 10, 18, "rgba(11,38,45,0.5)")}`,
        `<rect width="${S}" height="${S}" fill="${SUN_DEEP}"/>
         <rect width="${S}" height="${S}" fill="url(#__ID__a)"/>
         <rect width="${S}" height="${S}" fill="url(#__ID__b)" opacity="0.9"/>
         <rect width="${S}" height="${S}" fill="url(#__ID__c)" opacity="0.85"/>
         <rect width="${S}" height="${S}" fill="url(#__ID__d)" opacity="0.8"/>
         ${mark(PAPER, 1, `filter="url(#__ID__sh)"`)}
         ${polish()}`,
        o
      ),
  },
  {
    key: "bloom",
    name: "Bloom",
    note: "The ✱ softened into six petals around a centre, same silhouette, friendlier soul.",
    build: (o) => {
      const petal = (rot: number) =>
        `<path d="M256 226 C 286 196 286 118 256 96 C 226 118 226 196 256 226 Z" transform="rotate(${rot} 256 256)"/>`;
      return svg(
        `<linearGradient id="__ID__bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#15ab9b"/><stop offset="1" stop-color="${SUN_DEEP}"/>
        </linearGradient>${shadow("sh", 8, 14, "rgba(3,46,41,0.4)")}`,
        `<rect width="${S}" height="${S}" fill="url(#__ID__bg)"/>
         <g fill="${PAPER}" filter="url(#__ID__sh)">
           ${[0, 60, 120, 180, 240, 300].map(petal).join("")}
           <circle cx="256" cy="256" r="34"/>
         </g>
         ${polish()}`,
        o
      );
    },
  },
  {
    key: "badge",
    name: "Badge",
    note: "Tide plus a small moss tick, says “tasks” at a glance, at the cost of some calm.",
    build: (o) =>
      svg(
        `<linearGradient id="__ID__bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#15ab9b"/><stop offset="1" stop-color="${SUN_DEEP}"/>
        </linearGradient>${shadow("sh", 10, 16, "rgba(3,46,41,0.45)")}${shadow("bs", 6, 10, "rgba(3,46,41,0.5)")}`,
        `<rect width="${S}" height="${S}" fill="url(#__ID__bg)"/>
         ${mark(PAPER, 0.94, `filter="url(#__ID__sh)" transform="translate(-20 -20)"`)}
         <g filter="url(#__ID__bs)">
           <circle cx="386" cy="386" r="86" fill="${MOSS}" stroke="${PAPER}" stroke-width="16"/>
           <path d="M348 388 L374 414 L426 358" fill="none" stroke="${PAPER}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
         </g>
         ${polish()}`,
        o
      ),
  },
  {
    key: "glass",
    name: "Glass",
    note: "The teaser's frosted look: colour blooms behind glass, teal ✱ in front.",
    build: (o) =>
      svg(
        `<radialGradient id="__ID__a" cx="0.25" cy="0.2" r="0.7"><stop offset="0" stop-color="#f0a95a"/><stop offset="1" stop-color="#f0a95a" stop-opacity="0"/></radialGradient>
         <radialGradient id="__ID__b" cx="0.85" cy="0.4" r="0.75"><stop offset="0" stop-color="#41b3a3"/><stop offset="1" stop-color="#41b3a3" stop-opacity="0"/></radialGradient>
         <radialGradient id="__ID__c" cx="0.4" cy="0.95" r="0.8"><stop offset="0" stop-color="#7fb4dd"/><stop offset="1" stop-color="#7fb4dd" stop-opacity="0"/></radialGradient>
         <linearGradient id="__ID__mk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${SUN}"/><stop offset="1" stop-color="${SUN_DEEP}"/>
         </linearGradient>${shadow("sh", 8, 12, "rgba(7,80,72,0.3)")}`,
        `<rect width="${S}" height="${S}" fill="${PAPER}"/>
         <rect width="${S}" height="${S}" fill="url(#__ID__a)" opacity="0.9"/>
         <rect width="${S}" height="${S}" fill="url(#__ID__b)" opacity="0.9"/>
         <rect width="${S}" height="${S}" fill="url(#__ID__c)" opacity="0.9"/>
         <rect x="84" y="84" width="${S - 168}" height="${S - 168}" rx="88" fill="#ffffff" fill-opacity="0.72" stroke="#ffffff" stroke-opacity="0.9" stroke-width="4"/>
         ${mark("url(#__ID__mk)", 0.72, `filter="url(#__ID__sh)"`)}`,
        o
      ),
  },
  {
    key: "porcelain",
    name: "Porcelain",
    note: "Paper tile, teal mark, the quietest one, at home next to Things and Bear.",
    build: (o) =>
      svg(
        `<linearGradient id="__ID__bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e8eeec"/>
        </linearGradient>
        <linearGradient id="__ID__mk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#15ab9b"/><stop offset="1" stop-color="${SUN_DEEP}"/>
        </linearGradient>${shadow("sh", 8, 12, "rgba(28,38,36,0.22)")}`,
        `<rect width="${S}" height="${S}" fill="url(#__ID__bg)"/>
         ${mark("url(#__ID__mk)", 1, `filter="url(#__ID__sh)"`)}
         <rect x="5" y="5" width="${S - 10}" height="${S - 10}" rx="${RX - 4}" fill="none" stroke="${INK}" stroke-opacity="0.06" stroke-width="10"/>`,
        o
      ),
  },
];

/** Materialises a variant with unique internal ids. */
export function renderIcon(v: IconVariant, instance: string, opts?: { fullBleed?: boolean }): string {
  return v.build(opts).replaceAll("__ID__", `${v.key}-${instance}-`);
}
