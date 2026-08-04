import Link from "next/link";
import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact support",
  description: "Get help with Kairo, report a bug, or request a feature.",
  alternates: { canonical: "/support/contact" },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ article?: string; from?: string; q?: string }>;
}) {
  const { article, from, q } = await searchParams;

  const subject = article
    ? `Kairo help: ${article}`
    : q
      ? `Kairo help: ${q}`
      : "Kairo help";

  const body = [
    "What I was trying to do:",
    "",
    "",
    "What happened instead:",
    "",
    "",
    article ? `(Read: ${article}${from ? `/support/${from}` : ""})` : "",
    q ? `(Searched for: ${q})` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-5 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs text-ink-faint">
        <Link href="/support" className="hover:text-ink-soft">
          Help
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink-soft">Contact</span>
      </nav>

      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Get in touch</h1>
      <p className="mt-3 text-base leading-7 text-ink-soft">
        Kairo is built by one person, so you&apos;ll get a real reply from a real human, usually
        within a day or two.
      </p>

      {(article || q) && (
        <div className="mt-6 rounded-2xl border border-sun/30 bg-sun-soft/50 px-4 py-3 text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-sun-deep">
            We&apos;ll include this
          </div>
          <p className="mt-0.5 text-ink-soft">
            {article ? `Article: ${article}` : `Search: “${q}”, which found nothing`}
          </p>
        </div>
      )}

      <div className="mt-8 space-y-4">
        <a
          href={mailto}
          className="flex items-center justify-between rounded-2xl border border-line bg-card px-5 py-4 transition-colors hover:border-sun/60"
        >
          <span>
            <span className="block text-sm font-semibold">Email support</span>
            <span className="block text-xs text-ink-faint">{SUPPORT_EMAIL}</span>
          </span>
          <span className="text-ink-faint" aria-hidden>
            →
          </span>
        </a>
      </div>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">Make your message fast to answer</h2>
      <ul className="mt-3 space-y-2">
        {[
          "What you were trying to do, and what happened instead.",
          "Which device and browser, and whether Kairo is installed to your home screen.",
          "For sync or sharing questions: the email address of the other account.",
          "For a hiccup screen: the reference code shown under the message.",
        ].map((item) => (
          <li key={item} className="flex gap-3 text-[15px] leading-7 text-ink-soft">
            <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-sun/60" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-12 rounded-2xl border border-line bg-paper-deep/40 px-5 py-4">
        <h2 className="text-sm font-semibold">Before you write</h2>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          Two guides answer most incoming questions:{" "}
          <Link href="/support/notifications" className="font-medium text-sun-deep underline underline-offset-2">
            notifications not arriving
          </Link>{" "}
          and{" "}
          <Link href="/support/troubleshooting" className="font-medium text-sun-deep underline underline-offset-2">
            troubleshooting
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
