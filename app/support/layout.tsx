import Link from "next/link";
import type { Metadata } from "next";
import { SupportSearch, SearchTrigger } from "@/components/support/search";
import { CoffeeButton } from "@/components/coffee";
import { Mark } from "@/components/mark";

export const metadata: Metadata = {
  title: { default: "Kairo Help", template: "%s · Kairo Help" },
  description:
    "Guides and answers for Kairo, capture, planning, focus timer, reminders, sharing, locks, and accounts.",
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
          <Link
            href="/support"
            className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold tracking-tight"
          >
            <Mark size={17} className="text-sun" />
            kairo
            <span className="font-normal text-ink-faint">help</span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SearchTrigger />
            <Link
              href="/today"
              className="whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper transition-opacity hover:opacity-90 sm:px-3.5"
            >
              Open <span className="hidden sm:inline">Kairo</span>
              <span className="sm:hidden">app</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line/80 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-ink-faint sm:px-5">
          <span>
            <Mark size={12} className="inline text-sun" /> kairo, where good days grow
          </span>
          <span className="flex gap-4">
            <Link href="/support" className="hover:text-ink-soft">
              All articles
            </Link>
            <Link href="/support/contact" className="hover:text-ink-soft">
              Contact
            </Link>
            <Link href="/pricing" className="hover:text-ink-soft">
              Pricing
            </Link>
            <Link href="/terms" className="hover:text-ink-soft">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-ink-soft">
              Privacy
            </Link>
            <Link href="/today" className="hover:text-ink-soft">
              Open app
            </Link>
            <CoffeeButton />
          </span>
        </div>
      </footer>

      <SupportSearch />
    </div>
  );
}
