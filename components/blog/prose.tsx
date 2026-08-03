import Link from "next/link";
import type { Block as SupportBlock } from "@/lib/support/types";
import type { BlogBlock } from "@/lib/blog/types";
import { BlockView, InlineText } from "@/components/support/prose";

/**
 * Renders blog blocks. The kinds shared with support delegate to the support
 * renderer, so help articles and blog posts can never drift apart visually.
 * Only the three blog-specific blocks are styled here.
 */
export function BlogBlockView({ block }: { block: BlogBlock }) {
  switch (block.t) {
    case "wtable":
      return (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[24rem] border-collapse text-left">
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-line pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`border-b border-line py-2.5 pr-4 align-top text-sm ${
                        j === 0 ? "font-medium text-ink" : "text-ink-soft"
                      }`}
                    >
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "faq":
      return (
        <div className="space-y-3">
          {block.items.map((item, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-line bg-card px-4 py-3 open:pb-4"
            >
              <summary className="cursor-pointer list-none text-[15px] font-medium leading-6 text-ink [&::-webkit-details-marker]:hidden">
                <span className="mr-2 inline-block text-ink-faint transition-transform group-open:rotate-90" aria-hidden>
                  ›
                </span>
                {item.q}
              </summary>
              <p className="mt-2 pl-5 text-[15px] leading-7 text-ink-soft">
                <InlineText text={item.a} />
              </p>
            </details>
          ))}
        </div>
      );

    case "cta":
      return (
        <div className="rounded-2xl border border-sun/25 bg-sun-soft/40 p-5 sm:p-6">
          <h3 className="font-display text-xl tracking-tight">{block.heading}</h3>
          <p className="mt-1.5 text-sm leading-6 text-ink-soft">
            <InlineText text={block.text} />
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-sun px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99]"
            >
              Try Kairo free
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-sun-deep underline underline-offset-2"
            >
              See pricing
            </Link>
          </div>
        </div>
      );

    default:
      return <BlockView block={block as SupportBlock} />;
  }
}
