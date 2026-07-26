"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * "Was this helpful?" — deliberately local. Nothing is transmitted; a thumbs-down
 * simply routes to the contact page carrying the article, which is where a real
 * answer can happen.
 */
export function Feedback({ slug, title }: { slug: string; title: string }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  return (
    <div className="mt-12 rounded-2xl border border-line bg-card px-5 py-4">
      {vote === null && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium">Was this page helpful?</span>
          <span className="flex gap-2">
            <button
              onClick={() => setVote("up")}
              className="rounded-full border border-line px-4 py-1.5 text-sm transition-colors hover:border-moss hover:bg-moss-soft hover:text-moss"
            >
              Yes
            </button>
            <button
              onClick={() => setVote("down")}
              className="rounded-full border border-line px-4 py-1.5 text-sm transition-colors hover:border-clay hover:bg-clay-soft hover:text-clay"
            >
              Not really
            </button>
          </span>
        </div>
      )}

      {vote === "up" && (
        <p className="text-sm text-ink-soft">
          Good — thanks for letting us know. <span aria-hidden>🌱</span>
        </p>
      )}

      {vote === "down" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            Sorry — that&apos;s our gap to close. Tell us what was missing?
          </p>
          <Link
            href={`/support/contact?article=${encodeURIComponent(title)}&from=${slug}`}
            className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
          >
            Tell us
          </Link>
        </div>
      )}
    </div>
  );
}
