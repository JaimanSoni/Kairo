import Link from "next/link";
import type { Metadata } from "next";
import { Mark } from "@/components/mark";

export const metadata: Metadata = {
  title: { default: "Kairo Blog", template: "%s" },
  description:
    "Guides, honest comparisons, and planning methods from Kairo, the daily planner that forgives.",
};

/**
 * The blog reads like the rest of the marketing site, not like the app:
 * same header shape as support, a persistent way home, and a footer that
 * links the reader onward. Readers arrive from search engines signed out,
 * so the CTA points at the landing page, never at a login wall.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
          <Link
            href="/blog"
            className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold tracking-tight"
          >
            <Mark size={17} className="text-sun" />
            kairo
            <span className="font-normal text-ink-faint">blog</span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Link
              href="/support"
              className="hidden text-xs font-medium text-ink-soft hover:text-ink sm:block"
            >
              Help
            </Link>
            <Link
              href="/pricing"
              className="hidden text-xs font-medium text-ink-soft hover:text-ink sm:block"
            >
              Pricing
            </Link>
            <Link
              href="/"
              className="whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper transition-opacity hover:opacity-90 sm:px-3.5"
            >
              Try Kairo free
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line/80 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-ink-faint sm:px-5">
          <span>
            <Mark size={12} className="inline text-sun" /> kairo, a daily planner that forgives
          </span>
          <span className="flex flex-wrap gap-4">
            <Link href="/blog" className="hover:text-ink-soft">
              All posts
            </Link>
            <Link href="/" className="hover:text-ink-soft">
              Home
            </Link>
            <Link href="/pricing" className="hover:text-ink-soft">
              Pricing
            </Link>
            <Link href="/support" className="hover:text-ink-soft">
              Help
            </Link>
            <Link href="/terms" className="hover:text-ink-soft">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-ink-soft">
              Privacy
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
