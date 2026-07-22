import Link from "next/link";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C40.9 35.5 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

function Sticker({
  children,
  className,
  rotate,
}: {
  children: React.ReactNode;
  className?: string;
  rotate?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-ink px-4 py-1.5 text-sm font-semibold shadow-[3px_3px_0_0_var(--color-ink)] ${className ?? "bg-card"}`}
      style={{ transform: `rotate(${rotate ?? "0deg"})` }}
    >
      {children}
    </span>
  );
}

function MiniTask({
  title,
  done,
  chip,
  spotlight,
}: {
  title: string;
  done?: boolean;
  chip?: string;
  spotlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-sm border border-line">
      <span
        className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
          done ? "border-moss bg-moss text-white" : "border-ink-faint"
        }`}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={`text-sm ${done ? "line-through text-ink-faint" : "text-ink"}`}>{title}</span>
      {spotlight && <span className="text-sun text-sm">✦</span>}
      {chip && (
        <span className="ml-auto rounded-md bg-paper-deep px-2 py-0.5 text-xs text-ink-soft">{chip}</span>
      )}
    </div>
  );
}

const MARQUEE = [
  "no red badges, ever",
  "streaks are a trap",
  "inbox zero is a lie",
  "plan less, finish more",
  "your backlog is not a scoreboard",
  "tomorrow is allowed",
];

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const { auth_error } = await searchParams;
  const devLogin = process.env.NODE_ENV === "development" && process.env.DEV_LOGIN === "1";

  return (
    <main className="glow-warm flex-1 overflow-x-hidden">
      {/* nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <span className="text-sun text-2xl leading-none">✱</span> kairo
        </div>
        <a
          href="/api/auth/google"
          className="flex items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-semibold shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
        >
          <GoogleMark /> Continue with Google
        </a>
      </nav>

      {auth_error && (
        <div className="mx-auto max-w-2xl px-6">
          <div className="anim-pop rounded-2xl border-2 border-clay bg-clay-soft px-5 py-4 text-sm">
            {auth_error === "not_configured" ? (
              <>
                <b>Google sign-in isn&apos;t configured yet.</b> Add <code>GOOGLE_CLIENT_ID</code> and{" "}
                <code>GOOGLE_CLIENT_SECRET</code> to <code>.env.local</code> (redirect URI:{" "}
                <code>http://localhost:3010/api/auth/callback/google</code>).
                {devLogin && (
                  <>
                    {" "}
                    Meanwhile you can{" "}
                    <a href="/api/auth/dev" className="font-semibold underline">
                      use the local dev login
                    </a>
                    .
                  </>
                )}
              </>
            ) : (
              <>Sign-in didn&apos;t go through. Please try again.</>
            )}
          </div>
        </div>
      )}

      {/* hero */}
      <section className="relative mx-auto max-w-5xl px-6 pt-14 pb-10 text-center">
        <div className="pointer-events-none absolute -left-8 top-24 hidden md:block anim-float" style={{ "--rot": "-8deg" } as React.CSSProperties}>
          <Sticker className="bg-lilac-soft" rotate="-8deg">guilt-free ✌️</Sticker>
        </div>
        <div className="pointer-events-none absolute -right-6 top-40 hidden md:block anim-float" style={{ "--rot": "6deg", animationDelay: "1.2s" } as React.CSSProperties}>
          <Sticker className="bg-sky-soft" rotate="6deg">3 things a day</Sticker>
        </div>

        <h1 className="font-display mx-auto max-w-3xl text-5xl leading-[1.05] sm:text-7xl">
          Your to-do list shouldn&apos;t make you <em className="text-clay">feel bad</em>.
        </h1>
        <div className="squiggle mx-auto mt-6 w-40" />
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft">
          Kairo is a daily planner that <b className="text-ink">forgives</b>. Plan a day you can
          actually finish. When life happens, start fresh — no red badges, no
          &ldquo;62 overdue&rdquo;, no shame spiral.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href="/api/auth/google"
            className="flex items-center gap-3 rounded-full border-2 border-ink bg-sun px-7 py-3.5 text-base font-bold shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <GoogleMark /> Continue with Google
          </a>
          <span className="text-xs text-ink-faint">Free. Your tasks stay yours.</span>
        </div>

        {/* mini product mock */}
        <div className="anim-rise mx-auto mt-14 max-w-md rounded-3xl border-2 border-ink bg-paper-deep p-5 text-left shadow-[6px_6px_0_0_var(--color-ink)]">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-display text-2xl">Today</span>
            <span className="text-xs text-ink-soft">holds ~2h 45m · fits ✓</span>
          </div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-sun-deep">
            ✦ Spotlight
          </div>
          <div className="space-y-2">
            <MiniTask title="Send the proposal" spotlight chip="~45m" />
            <MiniTask title="Book dentist" chip="#life" />
            <MiniTask title="Review Maya's PR" chip="~30m" />
            <MiniTask title="Morning run" done />
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-ink-faint bg-card/60 px-4 py-3 text-sm text-ink-faint">
            yesterday&apos;s 2 leftovers? <span className="font-semibold text-ink-soft">swept, guilt-free →</span>
          </div>
        </div>
      </section>

      {/* marquee */}
      <div className="my-12 -rotate-1 border-y-2 border-ink bg-sun py-3 overflow-hidden">
        <div className="anim-marquee flex w-max gap-8 whitespace-nowrap font-semibold">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="flex items-center gap-8">
              {m} <span aria-hidden>✱</span>
            </span>
          ))}
        </div>
      </div>

      {/* principles */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="font-display text-center text-4xl sm:text-5xl">
          Built different, <em>on purpose</em>
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              emoji: "🌅",
              title: "The day is the unit",
              body:
                "Kairo opens on Today — a short list you chose, capped by honesty, with up to 3 Spotlight must-wins. The infinite backlog stays out of sight until you ask.",
              bg: "bg-sun-soft",
            },
            {
              emoji: "🪶",
              title: "Capture beats forgetting",
              body:
                "One keystroke, type the thought, hit enter. “call mom tomorrow ~15m #life” just works. No required dates, no decision fatigue at capture time.",
              bg: "bg-sky-soft",
            },
            {
              emoji: "🍃",
              title: "Failing is a feature",
              body:
                "Didn't finish? Tomorrow, Kairo helps you sweep leftovers in one tap — reschedule, defer, or let it go. Carried a task 3 times? We'll gently suggest breaking it down.",
              bg: "bg-lilac-soft",
            },
          ].map((c) => (
            <div
              key={c.title}
              className={`rounded-3xl border-2 border-ink ${c.bg} p-7 shadow-[5px_5px_0_0_var(--color-ink)]`}
            >
              <div className="text-3xl">{c.emoji}</div>
              <h3 className="mt-3 text-xl font-bold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* the enemy */}
      <section className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h2 className="font-display text-4xl sm:text-5xl">
          Other apps track tasks.
          <br />
          <em className="text-sun-deep">Kairo protects your day.</em>
        </h2>
        <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
          {[
            ["❌ 62 overdue tasks in red", "✅ A fresh start every morning"],
            ["❌ Fake due dates on everything", "✅ Planned days ≠ deadlines"],
            ["❌ Broken streaks, guilt trips", "✅ A log of what you did finish"],
            ["❌ 40 features, 12 settings pages", "✅ Capture, plan, finish. That's it"],
          ].map(([bad, good]) => (
            <div key={bad} className="rounded-2xl border border-line bg-card p-4 text-sm">
              <div className="text-ink-faint line-through decoration-clay/60">{bad.slice(2)}</div>
              <div className="mt-1 font-semibold">{good.slice(2)}</div>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <a
            href="/api/auth/google"
            className="inline-flex items-center gap-3 rounded-full border-2 border-ink bg-ink px-7 py-3.5 text-base font-bold text-paper shadow-[4px_4px_0_0_var(--color-sun)] transition-transform hover:-translate-y-0.5"
          >
            Start your first day →
          </a>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-ink-faint">
        <span className="text-sun">✱</span> kairo — made for humans with unfinished lists ·{" "}
        <Link href="/" className="underline">
          kairo.day
        </Link>
      </footer>
    </main>
  );
}
