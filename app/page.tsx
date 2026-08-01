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
import { Pricing } from "@/components/landing/pricing";
import { CoffeeButton } from "@/components/coffee";
import { Mark } from "@/components/mark";
import { getSession } from "@/lib/session";
import { PRICE_CURRENCY, PRICE_MINOR } from "@/lib/razorpay";
import { SITE_NAME, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  // /home renders this same page and declares its own canonical back to "/",
  // so the pair can never be read as two pages.
  alternates: { canonical: "/" },
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
    title: "Kairo, a daily planner that forgives",
    description:
      "Plan a day you can actually finish. Voice + AI capture, a morning reset instead of overdue guilt, focus timer, shared lists, assignments and PIN locks.",
    type: "website",
    siteName: "Kairo",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Kairo, a daily planner that forgives" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kairo, a daily planner that forgives",
    description: "Plan a day you can actually finish. No red badges, no overdue guilt.",
    images: ["/og.png"],
  },
};

/**
 * The price here is generated from the same constants that charge the card —
 * structured data that disagrees with the checkout is the kind of thing Google
 * flags and customers screenshot.
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  url: SITE_URL,
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web, iOS, Android",
  description:
    "A daily planner that forgives: bounded days, guilt-free fresh starts, voice and AI capture, focus timer, shared lists with assignments, and PIN-locked privacy.",
  offers: {
    "@type": "Offer",
    price: (PRICE_MINOR / 100).toFixed(2),
    priceCurrency: PRICE_CURRENCY,
    category: "SaaS",
  },
};

/** On a coloured button the logo needs its own white surface — Google's green
 *  otherwise disappears into the teal, and their brand rules require it. */
function GoogleBadge({ size = 24 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-white shadow-sm"
      style={{ width: size, height: size }}
    >
      <GoogleMark size={Math.round(size * 0.6)} />
    </span>
  );
}

function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
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
  { icon: "↻", title: "Recurring tasks", body: "Daily, weekly, or monthly. Miss one and it just moves on." },
  { icon: "🔔", title: "Reminders that arrive", body: "Real notifications, even with the app closed." },
  { icon: "↳", title: "Steps with their own days", body: "Break a big task up. Give each step its own day." },
  { icon: "⌘", title: "Search everything", body: "One shortcut finds any task or list." },
  { icon: "👥", title: "Multiple accounts", body: "Work and personal, a tap apart." },
  { icon: "🌙", title: "Light, dark, auto", body: "Follows your system. Installs like a real app." },
];

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const { auth_error } = await searchParams;
  const devLogin = process.env.NODE_ENV === "development" && process.env.DEV_LOGIN === "1";
  // "/" redirects signed-in visitors to /today, so this only ever matters on
  // /home — where offering "Continue with Google" to someone already signed in
  // would be nonsense.
  const signedIn = Boolean(await getSession());

  return (
    <main className="mesh flex-1 overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* nav */}
      <nav
        aria-label="Main"
        className="glass sticky top-4 z-40 mx-auto mt-4 flex w-[min(94%,56rem)] items-center justify-between rounded-full px-4 py-2.5 shadow-lg shadow-ink/5 sm:px-5"
      >
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Mark size={20} className="text-sun" /> kairo
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/support"
            className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:block"
          >
            Help
          </Link>
          {signedIn ? (
            <Link
              href="/today"
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              Open Kairo
            </Link>
          ) : (
            <a
              href="/api/auth/google"
              className="flex items-center gap-2 rounded-full bg-ink py-1.5 pl-1.5 pr-4 text-sm font-semibold text-paper transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <GoogleBadge size={26} /> Sign in
            </a>
          )}
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
            ) : auth_error === "link_expired" ? (
              <>
                <b>That sign-in link has expired.</b> Signing in with Google using the same email
                address opens the same account, everything shared with you is still there.
              </>
            ) : auth_error === "deactivated" ? (
              <>
                <b>This account has been deactivated.</b> Nothing has been deleted, everything
                you&apos;ve written is still there. Email{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-semibold underline underline-offset-2"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                and we&apos;ll sort it out.
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
            start fresh, no red badges, no &ldquo;62 overdue&rdquo;, no shame spiral.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3">
            {signedIn ? (
              <Link
                href="/today"
                className="rounded-full bg-sun px-8 py-4 text-base font-semibold text-on-accent shadow-xl shadow-sun/25 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-sun/30 active:translate-y-0"
              >
                Open Kairo →
              </Link>
            ) : (
              <a
                href="/api/auth/google"
                className="flex items-center gap-3 rounded-full bg-sun py-2.5 pl-2.5 pr-8 text-base font-semibold text-on-accent shadow-xl shadow-sun/25 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-sun/30 active:translate-y-0"
              >
                <GoogleBadge size={34} /> Continue with Google
              </a>
            )}
            <span className="text-xs text-ink-faint">
              {signedIn ? "You're signed in." : "Free. Your tasks stay yours."}
            </span>
          </div>
        </div>
      </section>

      {/* feature walkthrough */}
      <Feature
        eyebrow="Capture"
        title={<>Say it. AI files it.</>}
        body="Talk or type. Kairo saves it straight away, then AI fills in the day, time, list and steps."
        points={[
          "Speak how you speak. Rambling is fine.",
          "Or type it: “gym fri 6pm ~45m #health”.",
          "Nothing is required. Decide later.",
        ]}
        demo={<CaptureDemo />}
        flip
      />

      <Feature
        eyebrow="Plan"
        title={<>A day with edges</>}
        body="Today holds only what you picked for today. Never the whole pile."
        points={[
          "Pick three that matter. Only three.",
          "See whether the day actually fits.",
          "Clear them all and Today says: Day won.",
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
        body="Yesterday's leftovers come back once, in the morning. One tap each and they're sorted."
        points={[
          "Today, Later, Someday, Did it, or Let go.",
          "Keeps coming back? Kairo says break it up.",
          "No overdue count. Anywhere.",
        ]}
        demo={<FreshStartDemo />}
        flip
      />

      <Feature
        eyebrow="Focus"
        title={<>Start the clock, not another list</>}
        body="Add an estimate and press play. The timer keeps running even if you close the app."
        points={[
          "Pause, reset, or add five minutes.",
          "Run over and it counts up, quietly.",
          "Shrink it to a pill and carry on.",
        ]}
        demo={<FocusDemo />}
      />

      <Feature
        eyebrow="Together"
        title={<>Share a list. Assign the work.</>}
        body="Invite someone by email and you share the list. Your own Today stays yours."
        points={[
          "Shared lists for home, work, anything.",
          "Assign a task and they get a ping.",
          "Or send one task across on its own.",
        ]}
        demo={<ShareDemo />}
        flip
      />

      <Feature
        eyebrow="Private"
        title={<>Some lists aren&apos;t for the room</>}
        body="Lock a list, or all of Kairo, with a PIN. Locked tasks disappear from everywhere."
        points={[
          "4–8 digits, never stored as plain text.",
          "Gone from search, calendar and the AI.",
          "Lock the whole app in one tap.",
        ]}
        demo={<LockDemo />}
      />

      <Feature
        eyebrow="Perspective"
        title={<>The week and month, in colour</>}
        body="See the week ahead, or the whole month with a colour for each list."
        points={[
          "Drag a task to another day.",
          "Every list gets its own colour.",
          "Busy days show up early.",
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

      <Pricing signedIn={signedIn} />

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
        <Mark size={12} className="inline text-sun" /> kairo, made for humans with unfinished lists
        {" · "}
        <Link href="/support" className="underline underline-offset-2 hover:text-ink-soft">
          Help
        </Link>
        {" · "}
        <Link href="/pricing" className="underline underline-offset-2 hover:text-ink-soft">
          Pricing
        </Link>
        {" · "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-ink-soft">
          Terms
        </Link>
        {" · "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-ink-soft">
          Privacy
        </Link>
        {" · "}
        <Link href="/refunds" className="underline underline-offset-2 hover:text-ink-soft">
          Refunds
        </Link>
        {" · "}
        <CoffeeButton />
      </footer>
    </main>
  );
}
