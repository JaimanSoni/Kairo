import type { Metadata } from "next";
import Link from "next/link";
import { Icon3d } from "@/components/img3d";

export const metadata: Metadata = {
  description:
    "Kairo is a daily planner that forgives. Plan a day you can actually finish — voice capture, AI sorting, focus timer, and a fresh start every morning. No red badges, no overdue guilt.",
  keywords: [
    "daily planner", "todo app", "task planner", "task manager",
    "guilt-free productivity", "focus timer", "AI task planner", "day planner app",
  ],
  openGraph: {
    title: "Kairo — a daily planner that forgives",
    description:
      "Plan a day you can actually finish. No red badges, no overdue guilt, no infinite lists.",
    type: "website",
    siteName: "Kairo",
  },
  twitter: {
    card: "summary",
    title: "Kairo — a daily planner that forgives",
    description: "Plan a day you can actually finish. No red badges, no overdue guilt.",
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Kairo",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  description:
    "A daily planner that forgives: bounded days, guilt-free fresh starts, voice + AI capture, and a focus timer.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

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

function CheckDot({ done }: { done?: boolean }) {
  return (
    <span
      className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
        done ? "border-moss bg-moss text-on-accent" : "border-ink-faint/60"
      }`}
      aria-hidden
    >
      {done && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
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
    <div className="flex items-center gap-3 rounded-2xl bg-card/80 px-4 py-3 shadow-sm">
      <CheckDot done={done} />
      <span className={`text-sm ${done ? "line-through text-ink-faint" : "text-ink"}`}>{title}</span>
      {spotlight && <span className="text-sun text-sm" aria-hidden>✦</span>}
      {chip && (
        <span className="ml-auto rounded-lg bg-paper-deep/80 px-2 py-0.5 text-xs text-ink-soft">{chip}</span>
      )}
    </div>
  );
}

const FEATURE_PILLS = [
  "🎙 voice capture",
  "✨ AI sorting",
  "⏱ focus timer",
  "↻ recurring tasks",
  "🔒 private lists",
  "🌙 dark mode",
];

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const { auth_error } = await searchParams;
  const devLogin = process.env.NODE_ENV === "development" && process.env.DEV_LOGIN === "1";

  return (
    <main className="mesh flex-1 overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* nav */}
      <nav aria-label="Main" className="sticky top-4 z-40 mx-auto mt-4 flex w-[min(94%,56rem)] items-center justify-between rounded-full glass px-5 py-2.5 shadow-lg shadow-ink/5">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="text-sun text-xl leading-none" aria-hidden>✱</span> kairo
        </Link>
        <a
          href="/api/auth/google"
          className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <GoogleMark /> Sign in
        </a>
      </nav>

      {auth_error && (
        <div className="mx-auto mt-6 w-[min(94%,42rem)]">
          <div className="anim-pop glass rounded-3xl border-clay/40 px-6 py-4 text-sm">
            {auth_error === "not_configured" ? (
              <>
                <b>Google sign-in isn&apos;t configured yet.</b> Add <code>GOOGLE_CLIENT_ID</code> and{" "}
                <code>GOOGLE_CLIENT_SECRET</code> to <code>.env.local</code>.
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
      <section aria-label="Intro" className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center sm:pt-28">
        <p className="mx-auto mb-5 w-max rounded-full glass px-4 py-1.5 text-xs font-medium text-ink-soft">
          the daily planner that forgives
        </p>
        <h1 className="font-display mx-auto max-w-3xl text-5xl leading-[1.04] tracking-tight sm:text-7xl">
          Your to-do list shouldn&apos;t make you{" "}
          <em className="bg-gradient-to-r from-sun to-sky bg-clip-text text-transparent">feel bad</em>.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
          Plan a day you can actually finish. When life happens, start fresh —
          no red badges, no &ldquo;62 overdue&rdquo;, no shame spiral.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3">
          <a
            href="/api/auth/google"
            className="flex items-center gap-3 rounded-full bg-sun px-8 py-4 text-base font-semibold text-on-accent shadow-xl shadow-sun/25 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-sun/30 active:translate-y-0"
          >
            <GoogleMark /> Continue with Google
          </a>
          <span className="text-xs text-ink-faint">Free. Your tasks stay yours.</span>
        </div>

        {/* app glimpse */}
        <div className="anim-rise mx-auto mt-16 max-w-md rounded-[2rem] glass p-6 text-left shadow-2xl shadow-ink/10">
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
          <div className="mt-4 rounded-2xl bg-paper-deep/50 px-4 py-3 text-sm text-ink-soft">
            yesterday&apos;s 2 leftovers? <span className="font-semibold text-sun-deep">swept, guilt-free →</span>
          </div>
        </div>

        {/* feature pills */}
        <ul className="mx-auto mt-12 flex max-w-xl flex-wrap items-center justify-center gap-2" aria-label="Features">
          {FEATURE_PILLS.map((f) => (
            <li key={f} className="rounded-full glass px-3.5 py-1.5 text-xs font-medium text-ink-soft">
              {f}
            </li>
          ))}
        </ul>
      </section>

      {/* principles */}
      <section aria-label="Principles" className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="font-display text-center text-4xl tracking-tight sm:text-5xl">
          Built different, <em className="text-sun">on purpose</em>
        </h2>
        <div className="squiggle mx-auto mt-5 w-32" aria-hidden />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: "sunrise",
              title: "The day is the unit",
              body:
                "Kairo opens on Today — a short list you chose, with up to 3 Spotlight must-wins. The infinite backlog stays out of sight until you ask.",
            },
            {
              icon: "inbox",
              title: "Capture beats forgetting",
              body:
                "One keystroke or one breath — speak it, type it, done. “call mom tomorrow ~15m” just works, and AI quietly sorts the details.",
            },
            {
              icon: "moon",
              title: "Failing is a feature",
              body:
                "Didn't finish? Tomorrow morning, sweep leftovers in one tap — reschedule, park, or let go. Carried three times? We'll suggest breaking it down.",
            },
          ].map((c) => (
            <article
              key={c.title}
              className="rounded-[2rem] glass p-8 shadow-lg shadow-ink/5 transition-transform hover:-translate-y-1"
            >
              <Icon3d name={c.icon} size={56} />
              <h3 className="mt-4 text-lg font-bold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* comparison */}
      <section aria-label="Why Kairo" className="mx-auto max-w-4xl px-6 py-14">
        <div className="rounded-[2rem] glass p-8 shadow-lg shadow-ink/5 sm:p-10">
          <h2 className="font-display text-center text-3xl tracking-tight sm:text-4xl">
            Other apps track tasks. <span className="text-sun">Kairo protects your day.</span>
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Every other app
              </h3>
              <ul className="space-y-2.5 text-sm text-ink-soft">
                {[
                  "62 overdue tasks glowing red",
                  "Fake due dates on everything",
                  "Broken streaks, guilt trips",
                  "40 features, 12 settings pages",
                ].map((x) => (
                  <li key={x} className="flex items-center gap-2.5">
                    <span className="text-clay" aria-hidden>✕</span> {x}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-sun-deep">
                Kairo
              </h3>
              <ul className="space-y-2.5 text-sm font-medium">
                {[
                  "A fresh start every morning",
                  "Planned days ≠ deadlines",
                  "A log of what you did finish",
                  "Capture, plan, finish. That's it",
                ].map((x) => (
                  <li key={x} className="flex items-center gap-2.5">
                    <span className="text-moss" aria-hidden>✓</span> {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* final CTA */}
      <section aria-label="Get started" className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
          Win <em className="text-sun">today</em>. Repeat tomorrow.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-ink-soft">
          Three must-wins, an honest plan, and a clean slate whenever you need one.
        </p>
        <a
          href="/api/auth/google"
          className="mt-8 inline-flex items-center gap-3 rounded-full bg-ink px-8 py-4 text-base font-semibold text-paper shadow-xl shadow-ink/20 transition-all hover:-translate-y-0.5 hover:shadow-2xl"
        >
          Start your first day →
        </a>
      </section>

      <footer className="border-t border-line/60 py-8 text-center text-xs text-ink-faint">
        <span className="text-sun" aria-hidden>✱</span> kairo — made for humans with unfinished lists
        {" · "}
        <Link href="/support" className="underline underline-offset-2 hover:text-ink-soft">
          Help
        </Link>
      </footer>
    </main>
  );
}
