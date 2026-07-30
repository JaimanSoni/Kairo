import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin/nav";

export const metadata: Metadata = {
  title: "Admin",
  // belt-and-braces with robots.ts — this must never be indexed
  robots: { index: false, follow: false, nocache: true },
};

/** Never prerender or cache an authorised surface. */
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // gate the whole segment, not just the page — every future admin route
  // inherits this, so a new page can't ship unprotected by omission
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <span className="text-sun text-lg leading-none" aria-hidden>
              ✱
            </span>
            kairo
            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-paper">
              admin
            </span>
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-xs text-ink-faint sm:block">{admin.email}</span>
            <Link
              href="/today"
              className="whitespace-nowrap rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:border-sun hover:text-sun-deep"
            >
              Back to app
            </Link>
          </div>
        </div>
      </header>

      <AdminNav />

      <main className="flex-1">{children}</main>
    </div>
  );
}
