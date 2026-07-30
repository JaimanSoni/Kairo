/**
 * The Kairo mark — the same three rounded bars the app icon is built from.
 *
 * This replaces the ✱ font glyph that used to stand in for it. A glyph's
 * spokes are whatever the font decided; the icon's are drawn. Once the real
 * icon ships, every place still rendering the glyph quietly disagrees with it.
 *
 * currentColor on purpose: the chrome tints it with text classes, so it
 * follows the theme (including dark mode) like the glyph did.
 */
export function Mark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable="false"
    >
      <g fill="currentColor">
        <rect x="229" y="112" width="54" height="288" rx="27" />
        <rect x="229" y="112" width="54" height="288" rx="27" transform="rotate(60 256 256)" />
        <rect x="229" y="112" width="54" height="288" rx="27" transform="rotate(120 256 256)" />
      </g>
    </svg>
  );
}
