/**
 * The garden's line icons, drawn to the same 16px grid and 1.5 stroke as the
 * rest of Kairo's icons (components/ui.tsx), so a streak or a dew drop sits
 * beside a task or a list without looking like it came from somewhere else.
 */

type P = { size?: number; className?: string };

const svg = (size: number, className: string | undefined, children: React.ReactNode, fill = "none") => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={fill} className={className} aria-hidden>
    {children}
  </svg>
);

export function IconFlame({ size = 16, className }: P) {
  return svg(
    size,
    className,
    <>
      <path
        d="M8 14.5c-2.65 0-4.6-1.95-4.6-4.5 0-1.95 1.05-3.3 2.15-4.55.1 1.1.6 1.95 1.45 2.35C7.1 5.55 8 3.35 9.95 1.5c-.1 2.3.9 3.65 1.9 4.95.65.9.95 1.9.95 3.25 0 2.85-2.1 4.8-4.8 4.8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.05 14.5c-1.05 0-1.85-.8-1.85-1.85 0-.95.65-1.6 1.25-2.35.2.6.55.95 1.05 1.05.1-.75.4-1.4.95-1.95.3.95.85 1.55.85 2.6 0 1.4-.95 2.5-2.25 2.5z" fill="currentColor" />
    </>
  );
}

export function IconDrop({ size = 16, className }: P) {
  return svg(
    size,
    className,
    <path d="M8 1.9C6.3 4.2 3.75 7 3.75 9.75a4.25 4.25 0 008.5 0C12.25 7 9.7 4.2 8 1.9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  );
}

export function IconTrophy({ size = 16, className }: P) {
  return svg(
    size,
    className,
    <>
      <path d="M5 2.25h6v3.5a3 3 0 01-6 0v-3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5 3.5H3.25A1.5 1.5 0 004.9 6.9M11 3.5h1.75a1.5 1.5 0 01-1.65 3.4M8 8.75v2.5M5.5 13.75h5M6.5 11.25h3v2.5h-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

export function IconBasket({ size = 16, className }: P) {
  return svg(
    size,
    className,
    <path
      d="M2.25 6.75h11.5l-1.2 6a1.25 1.25 0 01-1.23 1h-6.64a1.25 1.25 0 01-1.23-1l-1.2-6zM5.5 6.75L7 2.5M10.5 6.75L9 2.5M6.25 9.25v2.25M9.75 9.25v2.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function IconSparkle({ size = 16, className }: P) {
  return svg(
    size,
    className,
    <path d="M8 1.75c.45 3.1 1.9 4.6 5 5.1-3.1.5-4.55 2-5 5.15-.45-3.15-1.9-4.65-5-5.15 3.1-.5 4.55-2 5-5.1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  );
}

export function IconBell({ size = 16, className }: P) {
  return svg(
    size,
    className,
    <path d="M4 11.25V7.5a4 4 0 118 0v3.75l1 1.25H3l1-1.25zM6.5 14h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  );
}

export function IconUsers({ size = 16, className }: P) {
  return svg(
    size,
    className,
    <path
      d="M6 7.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5zM1.75 13.5c.3-2.3 2-3.75 4.25-3.75s3.95 1.45 4.25 3.75M10.75 3a2.25 2.25 0 010 4.25M12 9.9c1.3.45 2.1 1.6 2.25 3.6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function IconArrowLeft({ size = 16, className }: P) {
  return svg(size, className, <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />);
}

export function IconSeed({ size = 16, className }: P) {
  return svg(
    size,
    className,
    <>
      <path d="M8 14.25c2.5 0 4.25-1.9 4.25-4.5 0-2.9-2.3-5.3-4.25-7.5-1.95 2.2-4.25 4.6-4.25 7.5 0 2.6 1.75 4.5 4.25 4.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6.5v5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  );
}

export function IconMinus({ size = 14, className }: P) {
  return svg(size, className, <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />);
}

/** A checkmark sized for small round badges. */
export function IconTick({ size = 12, className }: P) {
  return svg(size, className, <path d="M3.25 8.4l3 3 6.5-6.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />);
}
