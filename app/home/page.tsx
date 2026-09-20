import type { Metadata } from "next";
import Link from "next/link";
import { CaptureDemo, FreshStartDemo, ShareDemo, TodayDemo } from "@/components/landing/demos";
import { CityBand } from "@/components/landing/city-band";
import { HeroGarden } from "@/components/landing/hero-garden";
import { HabitsDemo, NotesDemo } from "@/components/landing/more-demos";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { CoffeeButton } from "@/components/coffee";
import { Plant } from "@/components/garden/plants";
import { Mark } from "@/components/mark";
import { GARDEN_LEVELS } from "@/lib/habits-shared";
import { getSession } from "@/lib/session";
import { PRICE_CURRENCY, PRICE_MINOR } from "@/lib/razorpay";
import { SITE_NAME, SITE_TITLE, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";
import { CITY_SHOWN } from "@/lib/types";

export const metadata: Metadata = {
  // "/" now opens straight into the product for visitors, so this page is
  // the marketing story's own canonical home.
  alternates: { canonical: "/home" },
  description:
    CITY_SHOWN
      ? "Kairo is your whole day, in bloom: one calm place for tasks, habits and notes. Plan a day you'll actually finish, keep habits that grow into a living garden, write notes and a journal, and move in next door to your friends in Kairo City. No red badges, no overdue guilt."
      : "Kairo is your whole day, in bloom: one calm place for tasks, habits and notes. Plan a day you'll actually finish, keep habits that grow into a living garden, and write notes for everything else. No red badges, no overdue guilt.",
  keywords: [
    "daily planner",
    "habit tracker",
    "habit garden",
    "todo app",
    "notes app",
    "shared task list",
    "AI task capture",
    "guilt-free productivity",
    "build habits with friends",
  ],
  openGraph: {
    title: SITE_TITLE,
    description:
      CITY_SHOWN
        ? "Plan a day you'll actually finish, grow your habits into a garden you can see, and move in next door to your friends in Kairo City."
        : "Plan a day you'll actually finish, grow your habits into a garden you can see, and keep notes for everything else.",
    type: "website",
    siteName: "Kairo",
    url: "/",
    images: [{ url: "/og-bloom.png", width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: CITY_SHOWN ? "Plan the day. Grow your habits into a garden. Visit your friends' gardens in Kairo City." : "Plan the day. Grow your habits into a garden. Write down everything else.",
    images: ["/og-bloom.png"],
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
    CITY_SHOWN
    ? "Your whole day, in bloom: a daily planner with guilt-free fresh starts and AI capture, habits that grow into a living garden, notes and a journal, and Kairo City, a street of gardens you share with friends."
    : "Your whole day, in bloom: a daily planner with guilt-free fresh starts and AI capture, habits that grow into a living garden, and notes.",
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

/* The four parts of Kairo, each drawn to the same 24px grid. */
const Stroke = ({ children }: { children: React.ReactNode }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const PlanIcon = () => (
  <Stroke>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4M9 14.5l2 2 4-4" />
  </Stroke>
);
const GrowIcon = () => (
  <Stroke>
    <path d="M12 21v-9" />
    <path d="M12 12c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5zM12 14.5C12 11.5 9.5 9.5 6 9.5c0 3 2.5 5 6 5z" />
    <path d="M7 21h10" />
  </Stroke>
);
const WriteIcon = () => (
  <Stroke>
    <path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5z" />
    <path d="M14 3.5V8h4M9 12h6M9 15.5h4" />
  </Stroke>
);
const CityIcon = () => (
  <Stroke>
    <path d="M3 20.5h18M5 20.5V11l4-3 4 3v9.5M13 20.5V8.5l3.5-3 3.5 3v12" />
    <path d="M8 14h2M16 11.5h1M16 15h1" />
  </Stroke>
);

const PILLARS = [
  { id: "plan", icon: <PlanIcon />, tint: "bg-sun/12 text-sun-deep", title: "Plan", body: "A day with edges. Three that matter, and a clean slate every morning." },
  { id: "grow", icon: <GrowIcon />, tint: "bg-moss/12 text-moss", title: "Grow", body: "Habits that get stronger each time, and a garden that shows it." },
  { id: "write", icon: <WriteIcon />, tint: "bg-lilac/12 text-lilac", title: "Write", body: "Notes for everything else, and a journal for the day itself." },
  { id: "city", icon: <CityIcon />, tint: "bg-sky/12 text-sky", title: "Kairo City", body: "Your garden on a street of real ones. Friends move in next door." },
].filter((p) => p.id !== "city" || CITY_SHOWN);

/** A numbered chapter heading: the page tells the story in four parts. */
function Chapter({ id, n, kicker, title, body }: { id: string; n: string; kicker: string; title: React.ReactNode; body: string }) {
  return (
    <header id={id} className="mx-auto max-w-2xl scroll-mt-28 px-5 pt-20 text-center sm:pt-28">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
        <span className="tabular-nums text-sun-deep">{n}</span> <span aria-hidden>/</span> {kicker}
      </p>
      <h2 className="font-display mt-3 text-4xl leading-[1.05] tracking-tight sm:text-6xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-lg text-[16px] leading-7 text-ink-soft">{body}</p>
    </header>
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
    <section className="mx-auto grid max-w-5xl items-center gap-8 px-5 py-10 sm:py-14 lg:grid-cols-2 lg:gap-14">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-sun-deep">{eyebrow}</p>
        <h3 className="font-display mt-2 text-3xl leading-tight tracking-tight sm:text-4xl">
          {title}
        </h3>
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

const CITY_POINTS = [
  { title: "Visit any garden", body: "Walk the street and look over the fence. Every plant there was grown by a real habit." },
  { title: "Cheer in one tap", body: "A little sunshine for a friend's good day. No comments, no pressure." },
  { title: "Save the plot next door", body: "Invite a friend by link or email, and their garden grows beside yours." },
];

const EXTRAS = [
  { title: "Focus timer", body: "Press play on a task. It keeps counting even with the app closed." },
  { title: "Week and month", body: "A calendar with a colour for every list. Drag a task to another day." },
  { title: "PIN-locked lists", body: "Lock a list, or all of Kairo. Locked tasks vanish from everywhere." },
  { title: "Recurring tasks", body: "Daily, weekly, or monthly. Miss one and it just moves on." },
  { title: "Reminders that arrive", body: "Real notifications for tasks and habits, even with the app closed." },
  { title: "Light, dark, anywhere", body: "Follows your system, and installs like a real app on any phone." },
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
  // Guests walk the city from the front door, which is the product in guest
  // mode; "/" would bounce a signed-in visitor to /today and drop the query.
  const cityHref = signedIn ? "/today?city=open" : "/?city=open";

  const primary = signedIn ? (
    <Link
      href="/today"
      className="rounded-full bg-sun px-8 py-4 text-base font-semibold text-on-accent shadow-xl shadow-sun/25 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-sun/30 active:translate-y-0"
    >
      Open Kairo →
    </Link>
  ) : (
    <a
      href="/api/auth/google"
      data-track="signin-google"
      className="flex items-center gap-3 rounded-full bg-sun py-2.5 pl-2.5 pr-8 text-base font-semibold text-on-accent shadow-xl shadow-sun/25 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-sun/30 active:translate-y-0"
    >
      <GoogleBadge size={34} /> Start free with Google
    </a>
  );

  return (
    // overflow-x on main would make it a scroll container and quietly kill
    // the sticky nav; the body already clips horizontal overflow
    <main className="mesh flex-1">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* nav */}
      <nav
        aria-label="Main"
        className="glass sticky top-4 z-40 mx-auto mt-4 flex w-[min(94%,56rem)] items-center justify-between rounded-full px-4 py-2.5 shadow-lg shadow-ink/5 sm:px-5"
      >
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Mark size={20} className="text-sun" /> kairo
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {PILLARS.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink md:block"
            >
              {p.title}
            </a>
          ))}
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
              data-track="signin-google"
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
            ) : auth_error === "signin_again" ? (
              <>
                <b>That session pointed at an account that no longer exists.</b> Sign in again and
                you&apos;ll be right back in.
              </>
            ) : auth_error === "signout_first" ? (
              <>
                <b>You&apos;re already signed in on this browser.</b> That sign-in link is for a
                different account. Sign out first, or open the link in a private window.
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
      <section aria-label="Intro" className="mx-auto max-w-5xl px-5 pb-8 pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          {CITY_SHOWN && (
          <a
            href="#city"
            className="glass mx-auto mb-6 flex w-max max-w-full items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <span className="rounded-full bg-sky px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span>
            Kairo City is open. Come see the gardens
          </a>
          )}
          <h1 className="font-display mx-auto text-6xl leading-[0.98] tracking-tight sm:text-8xl">
            Your whole day, in{" "}
            <em className="bg-gradient-to-r from-sun via-moss to-sky bg-clip-text pr-[0.12em] -mr-[0.08em] text-transparent">bloom</em>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            Tasks, habits and notes in one calm place. Plan a day you&apos;ll actually finish, and keep habits that grow into a garden you can see.
            {CITY_SHOWN ? " Then move in next door to your friends in Kairo City." : ""}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {primary}
            {CITY_SHOWN && (
            <a
              href={cityHref}
              className="glass flex items-center gap-2 rounded-full px-6 py-4 text-base font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="text-sky">
                <CityIcon />
              </span>
              Walk around Kairo City
            </a>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            {signedIn ? "You're signed in." : "Free to start. No card, and your days stay yours."}
          </p>
        </div>

        <div className="mt-12 sm:mt-14">
          <HeroGarden />
        </div>
      </section>

      {/* the four parts */}
      <section aria-label="What's inside" className="mx-auto max-w-5xl px-5 pt-10">
        <div className={`grid gap-3 sm:grid-cols-2 ${PILLARS.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {PILLARS.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className="glass group rounded-3xl p-5 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-ink/5"
            >
              <span className={`grid size-10 place-items-center rounded-2xl ${p.tint}`}>{p.icon}</span>
              <h2 className="mt-4 text-base font-semibold">
                {p.title}
                <span className="ml-1 inline-block text-ink-faint transition-transform group-hover:translate-x-1" aria-hidden>
                  →
                </span>
              </h2>
              <p className="mt-1 text-[13px] leading-6 text-ink-soft">{p.body}</p>
            </a>
          ))}
        </div>
      </section>

      {/* 01 plan */}
      <Chapter
        id="plan"
        n="01"
        kicker="Plan"
        title={
          <>
            A day you can <em className="text-sun">finish</em>
          </>
        }
        body="Say what's on your mind, pick the few that matter, and let yesterday go gently. Nothing in Kairo ever turns red."
      />

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
        eyebrow="Today"
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
        eyebrow="Fresh start"
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

      {/* 02 grow */}
      <Chapter
        id="grow"
        n="02"
        kicker="Grow"
        title={
          <>
            Habits you can <em className="text-moss">see</em>
          </>
        }
        body="Every habit is a plant. Do it and it grows. Miss a day and it wilts a little, then springs back the moment you water it. A plant never dies."
      />

      <Feature
        eyebrow="Habits"
        title={<>Stronger every time, not all or nothing</>}
        body="Pick one from the ideas or write your own. Kairo tracks how strong it's getting, not just how long the streak is."
        points={[
          "Two taps to start a habit, with ideas ready to go.",
          "Every day, weekdays, or a few times a week.",
          "Dew drops cover a missed day, so one slip keeps the streak.",
        ]}
        demo={<HabitsDemo />}
      />

      <section aria-label="Garden levels" className="mx-auto max-w-5xl px-5 py-8">
        <div className="glass rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-moss">Your garden levels up</p>
              <h3 className="font-display mt-1 text-2xl tracking-tight sm:text-3xl">From a bare plot to a legendary garden</h3>
            </div>
            <p className="max-w-xs text-[13px] leading-6 text-ink-soft">Your five strongest habits set the level. Each one adds something new.</p>
          </div>
          <ol className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {GARDEN_LEVELS.map((l) => (
              <li
                key={l.level}
                className={`rounded-2xl p-3 ${l.level === GARDEN_LEVELS.length ? "bg-gradient-to-br from-[#f7d774]/35 to-[#e0a93b]/25 ring-1 ring-[#e0a93b]/40" : "bg-card/70"}`}
              >
                <span className="mb-2 flex h-14 items-end" aria-hidden>
                  <Plant species="apple" stage={l.level - 1} ripe={l.level === 7 ? 3 : 0} golden={l.level === 7 ? 2 : 0} size={44} sway={false} ground="none" fit="tight" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Level {l.level}</span>
                <span className="mt-0.5 block text-[13px] font-semibold leading-5">{l.name}</span>
                <span className="mt-1 block text-[12px] leading-5 text-ink-soft">{l.adds}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 03 write */}
      <Chapter
        id="write"
        n="03"
        kicker="Write"
        title={
          <>
            Room for every <em className="text-lilac">thought</em>
          </>
        }
        body="Trip plans, meeting notes, the list of books to read. And a journal for how the day actually went."
      />

      <Feature
        eyebrow="Notes and journal"
        title={<>Pages inside pages</>}
        body="Write the way you think. Headings, checklists and pages nested inside each other, a slash away."
        points={[
          "Type / for headings, lists, checklists and more.",
          "Nest pages as deep as the idea goes.",
          "A daily journal with a prompt when the page is blank.",
        ]}
        demo={<NotesDemo />}
        flip
      />

      {/* 04 city */}
      {CITY_SHOWN && (
      <>
      <Chapter
        id="city"
        n="04"
        kicker="Together"
        title={
          <>
            Welcome to <em className="text-sky">Kairo City</em>
          </>
        }
        body="Every gardener gets a plot on one shared street. Keep your habits, watch your garden grow, and move your friends in next door."
      />

      <section aria-label="Kairo City" className="mx-auto max-w-6xl px-3 pt-10 sm:px-5">
        <CityBand />
        <div className="mx-auto mt-4 grid max-w-5xl gap-3 sm:grid-cols-3">
          {CITY_POINTS.map((c) => (
            <div key={c.title} className="glass rounded-3xl p-5">
              <h3 className="text-sm font-semibold">{c.title}</h3>
              <p className="mt-1 text-[13px] leading-6 text-ink-soft">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <a
            href={cityHref}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-base font-semibold text-paper shadow-xl shadow-ink/15 transition-all hover:-translate-y-0.5 hover:shadow-2xl"
          >
            Walk around Kairo City →
          </a>
          <p className="max-w-sm text-xs leading-5 text-ink-faint">
            Only gardeners who join show up on the street. Habits you wrote yourself keep their names private.
          </p>
        </div>
      </section>
      </>
      )}

      <Feature
        eyebrow="Shared lists"
        title={<>Share a list. Assign the work.</>}
        body="Invite someone by email and you share the list. Your own Today stays yours."
        points={[
          "Shared lists for home, work, anything.",
          "Assign a task and they get a ping.",
          "Or send one task across on its own.",
        ]}
        demo={<ShareDemo />}
      />

      {/* everything else */}
      <section aria-label="More features" className="mx-auto max-w-5xl px-5 py-12">
        <h2 className="font-display text-center text-3xl tracking-tight sm:text-4xl">
          And the rest of it
        </h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {EXTRAS.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span className="size-1.5 rounded-full bg-sun" aria-hidden />
                {f.title}
              </h3>
              <p className="mt-1 text-[13px] leading-6 text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* comparison */}
      <section aria-label="Why Kairo" className="mx-auto max-w-4xl px-5 py-10">
        <div className="glass rounded-[2rem] p-8 shadow-lg shadow-ink/5 sm:p-10">
          <h2 className="font-display text-center text-3xl tracking-tight sm:text-4xl">
            Other apps track your days. <span className="text-sun">Kairo helps them grow.</span>
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Every other app
              </h3>
              <ul className="space-y-2.5 text-sm text-ink-soft">
                {[
                  "62 overdue tasks glowing red",
                  "One missed day and the streak is gone",
                  "Habit charts that feel like homework",
                  "A planner, a tracker and notes in three apps",
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
                  "Plants that wilt a little, and never die",
                  "A garden you actually want to visit",
                  "Plan, grow, write, together. One app",
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
      <section aria-label="Get started" className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2 className="font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
          Grow a good day.
          <br />
          <em className="bg-gradient-to-r from-sun via-moss to-sky bg-clip-text pr-2 text-transparent">Starting today.</em>
        </h2>
        <p className="mx-auto mt-5 max-w-md text-ink-soft">
          Plan three things, water one habit, and watch the first sprout come up.
        </p>
        <div className="mt-8 flex justify-center">{primary}</div>
      </section>

      <footer className="border-t border-line/60 px-5 py-8 text-center text-xs leading-6 text-ink-faint">
        <Mark size={12} className="inline text-sun" /> kairo. your whole day, in bloom
        {" · "}
        <Link href="/support" className="underline underline-offset-2 hover:text-ink-soft">
          Help
        </Link>
        {" · "}
        <Link href="/blog" className="underline underline-offset-2 hover:text-ink-soft">
          Blog
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
