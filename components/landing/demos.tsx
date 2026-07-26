/**
 * Looping in-app demos for the landing page. Pure CSS/SVG — no video files,
 * so they load instantly, stay sharp at any size, follow the theme, and
 * freeze politely for anyone who prefers reduced motion.
 */

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="glass overflow-hidden rounded-[1.75rem] p-4 shadow-xl shadow-ink/5 sm:p-5"
    >
      {children}
    </div>
  );
}

function Row({
  title,
  chip,
  chipTone = "neutral",
  dim,
  star,
}: {
  title: string;
  chip?: string;
  chipTone?: "neutral" | "sun" | "sky" | "moss" | "lilac";
  dim?: boolean;
  star?: boolean;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-paper-deep text-ink-soft",
    sun: "bg-sun-soft text-sun-deep",
    sky: "bg-sky-soft text-sky",
    moss: "bg-moss-soft text-moss",
    lilac: "bg-lilac-soft text-lilac",
  };
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-card/80 px-3 py-2.5">
      <span className="size-[18px] shrink-0 rounded-full border-2 border-ink-faint/60" />
      <span className={`min-w-0 flex-1 truncate text-[13px] ${dim ? "text-ink-faint" : ""}`}>
        {title}
      </span>
      {star && (
        <span className="shrink-0 text-sun" aria-hidden>
          ✦
        </span>
      )}
      {chip && (
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] ${tones[chipTone]}`}>
          {chip}
        </span>
      )}
    </div>
  );
}

/** Capture: text types itself, then AI-derived chips appear. */
export function CaptureDemo() {
  return (
    <Frame label="Typing a task in Kairo while AI fills in the date, time and list">
      <div className="rounded-2xl bg-card/70 px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] sm:text-sm">
            <span className="demo-type">call mom tomorrow 6pm ~15m</span>
            <span className="demo-caret ml-px inline-block w-px text-ink">|</span>
          </span>
          <span className="ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sun to-sky text-on-accent">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2c.7 5.2 4.8 9.3 10 10-5.2.7-9.3 4.8-10 10-.7-5.2-4.8-9.3-10-10 5.2-.7 9.3-4.8 10-10z" />
            </svg>
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[
            { t: "☀️ Tomorrow", tone: "bg-sun-soft text-sun-deep", d: "0.2s" },
            { t: "🕐 6 PM", tone: "bg-sun-soft text-sun-deep", d: "0.5s" },
            { t: "~15m", tone: "bg-paper-deep text-ink-soft", d: "0.8s" },
            { t: "📁 Life", tone: "bg-paper-deep text-ink-soft", d: "1.1s" },
          ].map((c) => (
            <span
              key={c.t}
              className={`demo-chip rounded-md px-1.5 py-0.5 text-[10px] font-medium ${c.tone}`}
              style={{ animationDelay: c.d }}
            >
              {c.t}
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Today: a bounded day with Spotlight, and a task ticking itself off. */
export function TodayDemo() {
  return (
    <Frame label="Today in Kairo, showing three Spotlight tasks and the day's capacity">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-xl">Today</span>
        <span className="text-[10px] text-ink-soft">holds ~2h 45m · fits ✓</span>
      </div>
      <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-sun-deep">
        ✦ Spotlight
      </div>
      <div className="space-y-1.5">
        {/* this one completes on a loop */}
        <div className="flex items-center gap-2.5 rounded-xl bg-card/80 px-3 py-2.5">
          <span className="demo-check grid size-[18px] shrink-0 place-items-center rounded-full border-2 text-white">
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M2 6l3 3 5-6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="relative min-w-0 flex-1 truncate text-[13px]">
            Send the proposal
            <span className="demo-strike absolute left-0 top-1/2 h-px bg-ink-faint" />
          </span>
          <span className="shrink-0 text-sun" aria-hidden>
            ✦
          </span>
          <span className="shrink-0 rounded-md bg-paper-deep px-1.5 py-0.5 text-[10px] text-ink-soft">
            ~45m
          </span>
        </div>
        <Row title="Review Maya's PR" chip="~30m" star />
        <Row title="Book dentist" chip="📁 Life" />
      </div>
    </Frame>
  );
}

/** Fresh start: leftovers, each with one decision. */
export function FreshStartDemo() {
  return (
    <Frame label="The Fresh start sweep offering one decision per leftover task">
      <div className="text-center">
        <div className="text-2xl" aria-hidden>
          🌅
        </div>
        <div className="font-display mt-1 text-xl">Fresh start</div>
        <p className="mt-0.5 text-[11px] text-ink-soft">
          2 things from before didn&apos;t get done — that&apos;s what tomorrows are for.
        </p>
      </div>
      <div className="mt-3 space-y-2">
        {["Draft the retro notes", "Reply to Sam"].map((t, i) => (
          <div key={t} className="rounded-xl bg-card/80 p-2.5">
            <div className="truncate text-[12px]">{t}</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {["Today", "Later", "Someday", "Did it", "Let go"].map((c, j) => (
                <span
                  key={c}
                  className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                    j === (i === 0 ? 0 : 2)
                      ? "bg-sun-soft text-sun-deep"
                      : "bg-paper-deep text-ink-faint"
                  }`}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-center text-[10px] text-ink-faint">No red badges. Ever.</p>
    </Frame>
  );
}

/** Focus timer: a sweeping ring. */
export function FocusDemo() {
  const R = 52;
  const CIRC = 2 * Math.PI * R * 2.27; // dash length tuned to the viewBox scale
  return (
    <Frame label="The Kairo focus timer counting down with a progress ring">
      <div className="flex flex-col items-center py-2">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
          Focus
        </div>
        <div className="font-display mt-1 text-base">Send the proposal</div>
        <div className="relative mt-3">
          <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
            <circle cx="66" cy="66" r={R} fill="none" stroke="var(--color-paper-deep)" strokeWidth="8" />
            <circle
              className="demo-ring"
              cx="66"
              cy="66"
              r={R}
              fill="none"
              stroke="var(--color-sun)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRC}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="font-mono text-2xl font-bold tabular-nums">24:12</div>
              <div className="text-[9px] text-ink-faint">of 45m</div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          {["Reset", "", "+5"].map((l, i) => (
            <span
              key={i}
              className={
                i === 1
                  ? "grid size-11 place-items-center rounded-full bg-ink text-paper"
                  : "grid size-8 place-items-center rounded-full border border-line text-[9px] text-ink-soft"
              }
            >
              {i === 1 ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <rect x="6" y="4" width="4" height="16" rx="1.5" />
                  <rect x="14" y="4" width="4" height="16" rx="1.5" />
                </svg>
              ) : (
                l
              )}
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Sharing + assigning: people appear on a list. */
export function ShareDemo() {
  const people = [
    { i: "A", c: "bg-sun-soft text-sun-deep" },
    { i: "M", c: "bg-sky-soft text-sky" },
    { i: "J", c: "bg-lilac-soft text-lilac" },
  ];
  return (
    <Frame label="A shared Kairo list with tasks assigned to different people">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          🏡
        </span>
        <span className="flex-1 text-sm font-bold">Home</span>
        <span className="flex -space-x-1.5">
          {people.map((p, i) => (
            <span
              key={p.i}
              className={`demo-seq grid size-6 place-items-center rounded-full border-2 border-card text-[10px] font-bold ${p.c}`}
              style={{ animationDelay: `${i * 0.4}s` }}
            >
              {p.i}
            </span>
          ))}
        </span>
      </div>
      <div className="space-y-1.5">
        <Row title="Book the movers" chip="A · you" chipTone="sun" />
        <Row title="Cancel the internet" chip="M" chipTone="neutral" />
        <Row title="Sort the garage" chip="J" chipTone="neutral" />
      </div>
      <p className="mt-2.5 text-[10px] text-ink-faint">
        Everyone sees the same list. Assignments say who&apos;s got it.
      </p>
    </Frame>
  );
}

/** Locks: a list resolving from blurred to readable. */
export function LockDemo() {
  return (
    <Frame label="A PIN-locked Kairo list revealing its tasks after unlocking">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-base" aria-hidden>
          🔒
        </span>
        <span className="flex-1 text-sm font-bold">Private</span>
        <span className="rounded-md bg-paper-deep px-1.5 py-0.5 text-[10px] text-ink-soft">
          PIN
        </span>
      </div>
      <div className="demo-unlock space-y-1.5">
        <Row title="Therapy — Thursday 5pm" chip="🕐 5 PM" chipTone="sun" />
        <Row title="Look at the mortgage rates" />
        <Row title="Write the letter" chip="~30m" />
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="size-2 rounded-full bg-ink/70" />
        ))}
      </div>
      <p className="mt-2 text-center text-[10px] text-ink-faint">
        Hidden from every view until you unlock it.
      </p>
    </Frame>
  );
}

/** Calendar: a month grid with list-coloured dots. */
export function CalendarDemo() {
  const colors = ["#0c9384", "#4e93c9", "#8d7bd4", "#d96354", "#4ca75b"];
  return (
    <Frame label="The Kairo month calendar with tasks colour-coded by list">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-lg">
          July <span className="text-ink-faint">2026</span>
        </span>
        <span className="text-[10px] text-ink-soft">Month</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-[8px] font-semibold uppercase text-ink-faint">
            {d}
          </span>
        ))}
        {Array.from({ length: 28 }, (_, i) => {
          const day = i + 1;
          const dots = [3, 5, 9, 12, 14, 18, 21, 25].includes(day)
            ? (day % 3) + 1
            : day % 7 === 0
              ? 1
              : 0;
          const isToday = day === 12;
          return (
            <span
              key={day}
              className={`flex h-7 flex-col items-center justify-center rounded-md ${
                isToday ? "bg-sun text-on-accent" : ""
              }`}
            >
              <span className="text-[9px] tabular-nums">{day}</span>
              <span className="mt-0.5 flex gap-px">
                {Array.from({ length: dots }, (_, k) => (
                  <span
                    key={k}
                    className="demo-seq size-1 rounded-full"
                    style={{
                      backgroundColor: isToday ? "#fff" : colors[(day + k) % colors.length],
                      animationDelay: `${(day % 5) * 0.2 + k * 0.1}s`,
                    }}
                  />
                ))}
              </span>
            </span>
          );
        })}
      </div>
      <p className="mt-2.5 text-[10px] text-ink-faint">
        Every list gets a colour, with a legend underneath.
      </p>
    </Frame>
  );
}
