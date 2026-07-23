"use client";

export const MIN_PIN = 4;
export const MAX_PIN = 8;

/** Shared numeric keypad + entry dots — used by list locks and the app lock. */
export function PinPad({
  pin,
  onPinChange,
  onSubmit,
  busy,
  shake,
}: {
  pin: string;
  onPinChange: (pin: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  shake?: boolean;
}) {
  const press = (d: string) => {
    if (pin.length >= MAX_PIN) return;
    try {
      navigator.vibrate?.(5);
    } catch {}
    onPinChange(pin + d);
  };

  return (
    <>
      {/* dots */}
      <div className={`mt-5 flex h-4 items-center gap-2.5 ${shake ? "anim-shake" : ""}`}>
        {Array.from({ length: Math.max(pin.length, MIN_PIN) }, (_, i) => (
          <span
            key={i}
            className={`size-3 rounded-full transition-colors ${
              i < pin.length ? "bg-ink" : "border-2 border-ink-faint"
            }`}
          />
        ))}
      </div>

      {/* keypad */}
      <div className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <KeyBtn key={d} onClick={() => press(d)}>
            {d}
          </KeyBtn>
        ))}
        <KeyBtn onClick={() => onPinChange(pin.slice(0, -1))} subtle>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 4h8A1.5 1.5 0 0117 5.5v9a1.5 1.5 0 01-1.5 1.5h-8L3 10l4.5-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M10 8l4 4M14 8l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </KeyBtn>
        <KeyBtn onClick={() => press("0")}>0</KeyBtn>
        <button
          onClick={onSubmit}
          disabled={pin.length < MIN_PIN || busy}
          aria-label="Confirm"
          className="grid size-14 place-items-center rounded-full bg-ink text-paper transition-all active:scale-95 disabled:opacity-20 sm:size-16"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </>
  );
}

function KeyBtn({
  children,
  onClick,
  subtle,
}: {
  children: React.ReactNode;
  onClick: () => void;
  subtle?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`grid size-14 place-items-center rounded-full text-xl font-semibold transition-all active:scale-95 sm:size-16 ${
        subtle ? "text-ink-soft hover:bg-paper-deep" : "bg-paper-deep text-ink hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}
