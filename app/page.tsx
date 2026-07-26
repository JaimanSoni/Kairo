import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDemo,
  CaptureDemo,
  FocusDemo,
  FreshStartDemo,
  LockDemo,
  ShareDemo,
  TodayDemo,
} from "@/components/landing/demos";
import { Testimonials } from "@/components/landing/testimonials";

export const metadata: Metadata = {
  description:
    "Kairo is a daily planner that forgives. Voice + AI capture, a bounded Today, a guilt-free morning reset, focus timer, shared lists, task assignment and PIN locks. No red badges, no overdue guilt.",
  keywords: [
    "daily planner",
    "todo app",
    "task planner",
    "shared task list",
    "assign tasks",
    "private todo list",
    "focus timer",
    "AI task capture",
    "guilt-free productivity",
  ],
  openGraph: {
    title: "Kairo — a daily planner that forgives",
    description:
      "Plan a day you can actually finish. Voice + AI capture, a morning reset instead of overdue guilt, focus timer, shared lists, assignments and PIN locks.",
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
  operatingSystem: "Web, iOS, Android",
  description:
    "A daily planner that forgives: bounded days, guilt-free fresh starts, voice and AI capture, focus timer, shared lists with assignments, and PIN-locked privacy.",
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

/** Alternating feature row: copy on one side, a live demo on the other. */
function Feature({
  eyebrow,
  title,
  body,
  points,
  demo,
  flip,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  points: string[];
  demo: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="mx-auto grid max-w-5xl items-center gap-8 px-5 py-12 sm:py-16 lg:grid-cols-2 lg:gap-14">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-sun-deep">{eyebrow}</p>
        <h2 className="font-display mt-2 text-3xl leading-tight tracking-tight sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-ink-soft">{body}</p>
        <ul className="mt-5 space-y-2.5">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-[15px] leading-6 text-ink-soft">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-sun/70" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : ""}>{demo}</div>
    </section>
  );
}

const EXTRAS = [
  { icon: "↻", title: "Recurring tasks", body: "Daily, chosen weekdays, or monthly. Miss one and you skip it — the series never dies." },
  { icon: "🔔", title: "Reminders that arrive", body: "Real push notifications, even with the app closed. They skip themselves if you've already finished." },
  { icon: "↳", title: "Steps with their own days", body: "Break a big task down, then schedule individual steps onto separate days." },
  { icon: "⌘", title: "Search everything", body: "One shortcut finds any task, list or action — with keyboard navigation throughout." },
  { icon: "👥", title: "Multiple accounts", body: "Keep work and personal apart, and switch between them in a tap." },
  { icon: "🌙", title: "Light, dark, auto", body: "Follows your system, or pick one. Installs to your home screen like a native app." },
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
      <nav
        aria-label="Main"
        className="glass sticky top-4 z-40 mx-auto mt-4 flex w-[min(94%,56rem)] items-center justify-between rounded-full px-4 py-2.5 shadow-lg shadow-ink/5 sm:px-5"
      >
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="text-sun text-xl leading-none" aria-hidden>✱</span> kairo
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/support"
            className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:block"
          >
            Help
          </Link>
          <a
            href="/api/auth/google"
            className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <GoogleMark /> Sign in
          </a>
        </div>
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
      <section aria-label="Intro" className="mx-auto max-w-5xl px-5 pb-10 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mx-auto mb-5 w-max rounded-full glass px-4 py-1.5 text-xs font-medium text-ink-soft">
            the daily planner that forgives
          </p>
          <h1 className="font-display mx-auto text-5xl leading-[1.04] tracking-tight sm:text-7xl">
            Your to-do list shouldn&apos;t make you{" "}
            <em className="bg-gradient-to-r from-sun to-sky bg-clip-text text-transparent">
              feel bad
            </em>
            .
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            Speak a thought and AI files it. Plan a day you can actually finish. When life happens,
            start fresh — no red badges, no &ldquo;62 overdue&rdquo;, no shame spiral.
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
        </div>

        <div className="anim-rise mx-auto mt-14 max-w-md">
          <CaptureDemo />
        </div>
      </section>

      {/* feature walkthrough */}
      <Feature
        eyebrow="Capture"
        title={<>Say it. AI files it.</>}
        body="Tap the mic or press N and talk. Kairo saves it instantly, then AI reads your sentence and fills in the day, time, estimate, list and even the steps — without ever overruling what you typed."
        points={[
          "Voice capture that handles rambling, not just dictation.",
          "Type shortcuts too: “gym fri 6pm ~45m #health”.",
          "Nothing is required at capture — deciding comes later.",
        ]}
        demo={<CaptureDemo />}
        flip
      />

      <Feature
        eyebrow="Plan"
        title={<>A day with edges</>}
        body="Today shows only what you chose for today — never your whole backlog. Star up to three Spotlight must-wins, and watch an honest capacity line tell you when the day is overbooked."
        points={[
          "Spotlight holds exactly three. That's the point.",
          "“Holds ~2h 45m · fits ✓” — before the day falls apart.",
          "Finish everything and Today says: Day won.",
        ]}
        demo={<TodayDemo />}
      />

      <Feature
        eyebrow="Forgiveness"
        title={
          <>
            Nothing ever turns <em className="text-clay">red</em>
          </>
        }
        body="Other apps pile up overdue items until opening them feels like failure. Kairo sweeps yesterday's leftovers each morning and asks for one decision each — then gets out of the way."
        points={[
          "Today, Later, Someday, Did it, or Let go — one tap each.",
          "Carried something three times? Kairo suggests breaking it down.",
          "There is no overdue count anywhere in the app.",
        ]}
        demo={<FreshStartDemo />}
        flip
      />

      <Feature
        eyebrow="Focus"
        title={<>Start the clock, not another list</>}
        body="Give a task an estimate and press play. A full-screen countdown keeps you honest, survives reloads, and pings you when time's up — even if the app is closed."
        points={[
          "Pause, reset, or add five minutes mid-session.",
          "Overtime counts up instead of scolding you.",
          "Minimise it to a floating pill and keep working.",
        ]}
        demo={<FocusDemo />}
      />

      <Feature
        eyebrow="Together"
        title={<>Share a list. Assign the work.</>}
        body="Invite someone by email and you both see and edit the same tasks. Put a name on a task and they get a notification — while everyone keeps their own private Today."
        points={[
          "Live shared lists for a household, a project, a team.",
          "Assign tasks to anyone on the list, with avatars on the cards.",
          "Or send a single task as a copy — a clean handoff.",
        ]}
        demo={<ShareDemo />}
        flip
      />

      <Feature
        eyebrow="Private"
        title={<>Some lists aren&apos;t for the room</>}
        body="Lock any list — or all of Kairo — behind a numeric PIN. Locked tasks vanish from every view: Today, the calendar, search, even the AI's context."
        points={[
          "4–8 digit PIN, verified on the server and never stored as text.",
          "Shared locked lists use the same PIN for everyone.",
          "Lock the whole app in one tap when you step away.",
        ]}
        demo={<LockDemo />}
      />

      <Feature
        eyebrow="Perspective"
        title={<>The week and month, in colour</>}
        body="Sketch the week in a seven-day spread, or step back to a month calendar where every list has its own colour — with each day's load shown before it becomes a problem."
        points={[
          "Drag tasks between days to replan.",
          "Colour-coded dots and a legend that decodes them.",
          "Heavy days flagged before you get there.",
        ]}
        demo={<CalendarDemo />}
        flip
      />

      {/* everything else */}
      <section aria-label="More features" className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="font-display text-center text-3xl tracking-tight sm:text-4xl">
          And the rest of it
        </h2>
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {EXTRAS.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-5">
              <div className="text-lg" aria-hidden>
                {f.icon}
              </div>
              <h3 className="mt-2 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-[13px] leading-6 text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* comparison */}
      <section aria-label="Why Kairo" className="mx-auto max-w-4xl px-5 py-10">
        <div className="glass rounded-[2rem] p-8 shadow-lg shadow-ink/5 sm:p-10">
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

      <Testimonials />

      {/* final CTA */}
      <section aria-label="Get started" className="mx-auto max-w-3xl px-5 py-16 text-center">
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
