import Link from "next/link";

export const metadata = { title: "Page not found · Kairo" };

/**
 * The 404, in the product's own voice: a tiny task list where showing this
 * page is the one item that didn't get done. Static on purpose — no session
 * read, so it stays prerendered and can never be the second thing to fail.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6 py-16 text-ink">
      <div className="w-full max-w-md">
        <div
          className="anim-rise mx-auto max-w-sm rounded-2xl border border-line bg-card p-2 shadow-sm"
          aria-hidden
        >
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-sun text-[11px] font-bold text-on-accent">
              ✓
            </span>
            <span className="text-sm text-ink-faint line-through decoration-ink-faint/50">
              Build a calm to-do app
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-sun text-[11px] font-bold text-on-accent">
              ✓
            </span>
            <span className="text-sm text-ink-faint line-through decoration-ink-faint/50">
              Launch it
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-paper-deep/60 px-3 py-2.5">
            <span className="size-5 shrink-0 rounded-full border-2 border-line" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              Show you the page you asked for
            </span>
            <span className="shrink-0 rounded-md bg-clay/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-clay">
              404
            </span>
          </div>
        </div>

        <div className="anim-rise mt-8 text-center" style={{ animationDelay: "80ms" }}>
          <h1 className="font-display text-4xl tracking-tight">
            This page isn&apos;t on the list
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-[15px] leading-7 text-ink-soft">
            Maybe the link is old, maybe it never existed. Either way there is
            nothing to do here, and skipping those is kind of our thing.
          </p>
        </div>

        <div
          className="anim-rise mt-8 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "160ms" }}
        >
          <Link
            href="/today"
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper shadow-lg shadow-ink/15 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
          >
            Open Kairo
          </Link>
          <Link
            href="/"
            className="rounded-full border border-line bg-card px-6 py-3 text-sm font-semibold text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
          >
            Go to the home page
          </Link>
        </div>
      </div>
    </main>
  );
}
