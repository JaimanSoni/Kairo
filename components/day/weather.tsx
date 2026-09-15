import { MOODS, type Mood } from "@/lib/journal-shared";

/**
 * The weather inside a day, drawn instead of typed: one line icon per mood on
 * Kairo's 16px grid, in the mood's own colour. The journal asks for it, Today
 * asks for it in the evening, and the Calendar and Log show it back.
 */

const paths: Record<Mood, React.ReactNode> = {
  // stormy: a cloud with a bolt under it
  1: (
    <>
      <path d="M4.6 9.4H4.2A2.7 2.7 0 014 4.1a3.6 3.6 0 017-.3 2.6 2.6 0 01.5 5.6h-.6" />
      <path d="M8.4 7.6L6.9 10.3h2.2l-1.5 2.9" />
    </>
  ),
  // cloudy
  2: <path d="M4.5 12.25h7a2.9 2.9 0 00.3-5.8 4 4 0 00-7.7-.6A3.2 3.2 0 004.5 12.25z" />,
  // mixed: the sun behind a cloud
  3: (
    <>
      <path d="M6.1 5.2a2.6 2.6 0 014.3 1.4M8.4 1.75v1.1M12.9 3.6l-.8.8M4.9 3.6l-.8-.8" />
      <path d="M4.25 13h6.4a2.35 2.35 0 00.25-4.7 3.2 3.2 0 00-6.2-.4 2.55 2.55 0 00-.45 5.1z" />
    </>
  ),
  // sunny
  4: (
    <>
      <circle cx="8" cy="8" r="2.9" />
      <path d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M12.5 3.5l-1 1M4.5 11.5l-1 1" />
    </>
  ),
  // radiant: a rainbow
  5: (
    <>
      <path d="M2 11.5a6 6 0 0112 0" />
      <path d="M4.5 11.5a3.5 3.5 0 017 0" />
      <path d="M7 11.5a1 1 0 012 0" />
    </>
  ),
};

export function WeatherIcon({ mood, size = 16, className, tinted = true }: { mood: Mood; size?: number; className?: string; tinted?: boolean }) {
  const m = MOODS[mood - 1];
  return (
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
      style={tinted ? { color: m.color } : undefined}
      aria-hidden
    >
      {paths[mood]}
    </svg>
  );
}

/** A mood as a small chip: its icon and its name. */
export function WeatherChip({ mood, className = "" }: { mood: Mood; className?: string }) {
  const m = MOODS[mood - 1];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-paper-deep/70 py-0.5 pl-1.5 pr-2 text-[11px] font-medium text-ink-soft ${className}`}>
      <WeatherIcon mood={mood} size={12} />
      {m.label}
    </span>
  );
}

/**
 * The five weathers as a row of buttons. Picking one again leaves it picked:
 * a day's weather is changed, never unset by a stray tap.
 */
export function WeatherPicker({
  mood,
  onPick,
  disabled,
  size = "md",
  labels = false,
}: {
  mood: Mood | null;
  onPick: (m: Mood) => void;
  disabled?: boolean;
  size?: "md" | "lg";
  /** Names under the icons, where the weather is asked for the first time. */
  labels?: boolean;
}) {
  const box = size === "lg" ? "size-11" : "size-10";
  return (
    <div className="flex items-center gap-1" role="group" aria-label="The weather inside today">
      {MOODS.map((m) => {
        const active = mood === m.value;
        const button = (
          <button
            key={m.value}
            type="button"
            onClick={() => onPick(m.value)}
            disabled={disabled}
            aria-label={m.label}
            aria-pressed={active}
            title={m.label}
            className={`grid ${box} place-items-center rounded-full transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 ${
              active ? "bg-card shadow-md" : "hover:bg-card"
            }`}
            style={active ? { boxShadow: `0 0 0 2px ${m.color}` } : undefined}
          >
            <WeatherIcon mood={m.value} size={size === "lg" ? 22 : 20} />
          </button>
        );
        return labels ? (
          <span key={m.value} className="flex w-14 flex-col items-center gap-1">
            {button}
            <span className={`text-[11px] ${active ? "font-semibold text-ink" : "text-ink-faint"}`}>{m.label}</span>
          </span>
        ) : (
          button
        );
      })}
    </div>
  );
}
