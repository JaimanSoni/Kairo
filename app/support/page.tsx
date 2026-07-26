import Link from "next/link";
import type { Metadata } from "next";
import { ARTICLES, CATEGORIES, QUICK_START } from "@/lib/support/content";
import { SearchTrigger } from "@/components/support/search";

export const metadata: Metadata = {
  title: "Kairo Help — guides and answers",
  description:
    "Everything about Kairo: capture and AI parsing, planning your day, the focus timer, reminders and notifications, shared lists, PIN locks, multiple accounts, and troubleshooting.",
  alternates: { canonical: "/support" },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Kairo Help",
  description: "Guides and answers for the Kairo daily planner.",
};

export default function SupportIndex() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* hero */}
      <section className="mesh border-b border-line/70">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-20">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">How can we help?</h1>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-ink-soft">
            {ARTICLES.length} short guides covering every corner of Kairo — from your first capture
            to locks, sharing, and notifications.
          </p>
          <div className="mx-auto mt-7 max-w-md">
            <SearchTrigger full />
          </div>
        </div>
      </section>

      {/* quick start */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Start here
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_START.map((slug, i) => {
            const a = ARTICLES.find((x) => x.slug === slug);
            if (!a) return null;
            return (
              <Link
                key={slug}
                href={`/support/${a.slug}`}
                className="group rounded-2xl border border-line bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-sun/50 hover:shadow-lg hover:shadow-sun/5"
              >
                <div className="mb-3 grid size-8 place-items-center rounded-full bg-sun-soft text-xs font-bold tabular-nums text-sun-deep">
                  {i + 1}
                </div>
                <div className="text-sm font-semibold leading-snug">{a.title}</div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-soft">{a.summary}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* all categories */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
          {CATEGORIES.map((cat) => {
            const items = ARTICLES.filter((a) => a.categoryId === cat.id);
            if (items.length === 0) return null;
            return (
              <div key={cat.id}>
                <h2 className="font-display text-2xl tracking-tight">{cat.name}</h2>
                <p className="mb-3 mt-0.5 text-xs text-ink-soft">{cat.description}</p>
                <ul className="overflow-hidden rounded-2xl border border-line bg-card">
                  {items.map((a, i) => (
                    <li key={a.slug} className={i > 0 ? "border-t border-line" : ""}>
                      <Link
                        href={`/support/${a.slug}`}
                        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper-deep/40"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{a.title}</span>
                          <span className="block truncate text-xs text-ink-faint">{a.summary}</span>
                        </span>
                        <span
                          className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-sun"
                          aria-hidden
                        >
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-14 rounded-3xl border border-line bg-card p-8 text-center">
          <h2 className="font-display text-2xl tracking-tight">Still stuck?</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-ink-soft">
            If an answer isn&apos;t here, it&apos;s our gap to fix. Tell us what you were trying to
            do and we&apos;ll help — and write the missing guide.
          </p>
          <Link
            href="/support/contact"
            className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
          >
            Get in touch
          </Link>
        </div>
      </section>
    </>
  );
}
