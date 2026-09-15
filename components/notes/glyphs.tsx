/**
 * Line icons for notes' blocks and menus, on Kairo's 16px grid with a 1.5
 * stroke, so a menu reads like the rest of the app rather than a font's
 * idea of a checkbox.
 */

type P = { size?: number; className?: string };

const svg = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {children}
  </svg>
);

export const GlyphText = ({ size = 16, className }: P) => svg(size, className, <path d="M3.5 3.75h9M8 3.75v8.5" />);

export const GlyphTodo = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="3" />
      <path d="M5.5 8.1l1.75 1.75L10.6 6.3" />
    </>
  );

export const GlyphBullets = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <circle cx="3.25" cy="4.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="3.25" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="3.25" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
      <path d="M6.5 4.5h7M6.5 8h7M6.5 11.5h7" />
    </>
  );

export const GlyphNumbers = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <path d="M2.6 3.4l1-.65v3.6" strokeWidth="1.3" />
      <path d="M2.3 9.7c.15-.55.6-.9 1.2-.9.65 0 1.1.4 1.1.95 0 .85-1.05 1.35-2.3 2.6h2.4" strokeWidth="1.3" />
      <path d="M7 4.5h6.5M7 11h6.5" />
    </>
  );

export const GlyphToggle = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <path d="M2.75 3.5l3 2.25-3 2.25z" fill="currentColor" strokeWidth="1" />
      <path d="M8 5.75h5.5M8 10h5.5M8 12.75h3.5" />
    </>
  );

export const GlyphQuote = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <path d="M3 3.25v9.5" strokeWidth="2" />
      <path d="M6.5 4.75h7M6.5 8h7M6.5 11.25h4.5" />
    </>
  );

export const GlyphCallout = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="1.75" y="3" width="12.5" height="10" rx="2.5" />
      <path d="M5 6.1v.01M5 8v2" strokeWidth="1.6" />
      <path d="M7.75 6.5h4M7.75 9.5h3" />
    </>
  );

export const GlyphDivider = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <path d="M2 8h12" />
      <path d="M4.5 4.25h7M4.5 11.75h7" opacity="0.4" />
    </>
  );

export const GlyphCode = ({ size = 16, className }: P) => svg(size, className, <path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" />);

export const GlyphTable = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="2" y="2.75" width="12" height="10.5" rx="2" />
      <path d="M2 6.25h12M2 9.75h12M6.5 2.75v10.5" />
    </>
  );

export const GlyphPage = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <path d="M3.75 1.75h5.5l3.5 3.5v8a1 1 0 01-1 1h-8a1 1 0 01-1-1v-10.5a1 1 0 011-1z" />
      <path d="M9 1.9v3.6h3.6M5.5 8.5h5M5.5 11.25h3.25" />
    </>
  );

export const GlyphLinkPage = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <path d="M9.5 2.5h4v4M13.5 2.5L8 8" />
      <path d="M11.5 9.5v2.75a1.25 1.25 0 01-1.25 1.25h-6.5a1.25 1.25 0 01-1.25-1.25v-6.5A1.25 1.25 0 013.75 4.5H6.5" />
    </>
  );

export const GlyphTask = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M5.6 8.15l1.65 1.65 3.2-3.4" />
    </>
  );

export const GlyphDate = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </>
  );

export const GlyphTrash = ({ size = 16, className }: P) =>
  svg(size, className, <path d="M2.5 4h11M6.5 2h3M4 4l.7 9.3a1 1 0 001 .7h4.6a1 1 0 001-.7L12 4M6.5 7v4M9.5 7v4" strokeWidth="1.4" />);

export const GlyphCopy = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="5.25" y="5.25" width="8.5" height="8.5" rx="2" />
      <path d="M10.75 5.25V3.5a1.25 1.25 0 00-1.25-1.25h-6A1.25 1.25 0 002.25 3.5v6a1.25 1.25 0 001.25 1.25h1.75" />
    </>
  );

export const GlyphUp = ({ size = 16, className }: P) => svg(size, className, <path d="M8 13V3M4 7l4-4 4 4" />);

export const GlyphDown = ({ size = 16, className }: P) => svg(size, className, <path d="M8 3v10M4 9l4 4 4-4" />);

export const GlyphTurn = ({ size = 16, className }: P) => svg(size, className, <path d="M2.75 5.5h10.5L10.75 3M13.25 10.5H2.75L5.25 13" />);

export const GlyphBack = ({ size = 16, className }: P) => svg(size, className, <path d="M10 3.5L5.5 8l4.5 4.5" />);

export const GlyphArrowLeft = ({ size = 16, className }: P) => svg(size, className, <path d="M13.5 8h-11M7 3.5L2.5 8 7 12.5" />);

export const GlyphPencil = ({ size = 16, className }: P) => svg(size, className, <path d="M10.2 2.8l3 3-7.7 7.7-3.6.6.6-3.6 7.7-7.7zM8.9 4.1l3 3" />);

export const GlyphMoveTo = ({ size = 16, className }: P) => svg(size, className, <path d="M4 2.5v6a2 2 0 002 2h7.5M10.5 7.5l3 3-3 3" />);

export const GlyphLink = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <path d="M6.9 9.1a2.6 2.6 0 003.7 0l2.2-2.2a2.6 2.6 0 00-3.7-3.7l-.9.9M9.1 6.9a2.6 2.6 0 00-3.7 0L3.2 9.1a2.6 2.6 0 003.7 3.7l.9-.9" />
  );

export const GlyphLock = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="3" y="7" width="10" height="7" rx="2" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
    </>
  );

export const GlyphFace = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.8 9.5c.5.8 1.3 1.25 2.2 1.25s1.7-.45 2.2-1.25" />
      <path d="M6 6.4v.3M10 6.4v.3" strokeWidth="1.8" />
    </>
  );

export const GlyphImage = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="2" y="3" width="12" height="10" rx="2" />
      <path d="M2.5 11.5l3.3-3.3a1 1 0 011.4 0L11 12" />
      <circle cx="10.5" cy="6.5" r="1.1" />
    </>
  );

export const GlyphPanel = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="2" y="2.75" width="12" height="10.5" rx="2" />
      <path d="M6.25 2.75v10.5" />
    </>
  );

export const GlyphTopLevel = ({ size = 16, className }: P) => svg(size, className, <path d="M3 2.75h10M8 13.5V6M4.5 9.5L8 6l3.5 3.5" />);

export const GlyphUndo = ({ size = 16, className }: P) => svg(size, className, <path d="M5.5 3.5l-3 3 3 3M2.5 6.5h6.75a3.5 3.5 0 010 7H6.5" />);

export const GlyphRedo = ({ size = 16, className }: P) => svg(size, className, <path d="M10.5 3.5l3 3-3 3M13.5 6.5H6.75a3.5 3.5 0 000 7H9.5" />);

export const GlyphSearch = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </>
  );

export const GlyphCheck = ({ size = 16, className }: P) => svg(size, className, <path d="M3 8.5l3.5 3.5L13 5" strokeWidth="2.4" />);

export const GlyphHeading = ({ level }: { level: 1 | 2 | 3 }) => <span className="text-[11px] font-bold tracking-tight">H{level}</span>;
