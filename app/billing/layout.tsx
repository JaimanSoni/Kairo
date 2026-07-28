import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * Billing sits outside the app shell on purpose.
 *
 * The paywall replaces everything inside (app) once access lapses — which is
 * exactly when someone wants to see what they paid and when. Keeping this
 * route out of that group means the answer is always reachable.
 */
export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-line/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/today" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <span className="text-sun text-lg leading-none" aria-hidden>✱</span> kairo
          </Link>
          <nav className="flex items-center gap-4 text-xs text-ink-soft">
            <Link href="/pricing" className="hover:text-ink">Pricing</Link>
            <Link href="/refunds" className="hover:text-ink">Refunds</Link>
            <Link
              href="/today"
              className="rounded-full border border-line bg-card px-3 py-1.5 font-semibold hover:border-sun hover:text-sun-deep"
            >
              Back to app
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
