import Link from "next/link";
import type { Metadata } from "next";
import { SupportSearch, SearchTrigger } from "@/components/support/search";

export const metadata: Metadata = {
  title: { default: "Kairo Help", template: "%s · Kairo Help" },
  description:
    "Guides and answers for Kairo — capture, planning, focus timer, reminders, sharing, locks, and accounts.",
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3.5">
          <Link href="/support" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <span className="text-sun text-lg leading-none" aria-hidden>
              ✱
            </span>
            kairo
            <span className="font-normal text-ink-faint">help</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <SearchTrigger />
            <Link
              href="/today"
              className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper transition-opacity hover:opacity-90"
            >
              Open Kairo
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line/80 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-xs text-ink-faint">
          <span>
            <span className="text-sun" aria-hidden>
              ✱
            </span>{" "}
            kairo — a daily planner that forgives
          </span>
          <span className="flex gap-4">
            <Link href="/support" className="hover:text-ink-soft">
              All articles
            </Link>
            <Link href="/support/contact" className="hover:text-ink-soft">
              Contact
            </Link>
            <Link href="/today" className="hover:text-ink-soft">
              Open app
            </Link>
          </span>
        </div>
      </footer>

      <SupportSearch />
    </div>
  );
}
