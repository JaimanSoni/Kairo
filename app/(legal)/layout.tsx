import Link from "next/link";
import { Mark } from "@/components/mark";

/**
 * Chrome for the public policy pages.
 *
 * Razorpay checks these during account activation, and people reasonably want
 * to read them before paying, so they sit outside the app and need no session.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-line/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <Mark size={17} className="text-sun" />
            kairo
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
            <Link href="/pricing" className="hover:text-ink">Pricing</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/refunds" className="hover:text-ink">Refunds</Link>
            <Link href="/support/contact" className="hover:text-ink">Contact</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:py-14">{children}</main>

      <footer className="border-t border-line/80 py-8">
        <div className="mx-auto max-w-3xl px-5 text-xs text-ink-faint">
          <Mark size={12} className="inline text-sun" /> Kairo — operated by Jaiman Soni.{" "}
          <a href="mailto:jaimansoni@gmail.com" className="underline underline-offset-2 hover:text-ink-soft">
            jaimansoni@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
}
