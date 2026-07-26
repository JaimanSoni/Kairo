import Link from "next/link";
import type { Block, Inline } from "@/lib/support/types";

/**
 * Renders the inline markup subset: **bold**, `code`, [label](/href).
 * Deliberately tiny — no markdown dependency, no dangerouslySetInnerHTML.
 */
export function InlineText({ text }: { text: Inline }) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {tokens.map((tok, i) => {
        if (!tok) return null;
        if (tok.startsWith("**") && tok.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-ink">
              {tok.slice(2, -2)}
            </strong>
          );
        }
        if (tok.startsWith("`") && tok.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded-md border border-line bg-paper-deep px-1.5 py-0.5 font-mono text-[0.85em] text-ink"
            >
              {tok.slice(1, -1)}
            </code>
          );
        }
        const link = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          const [, label, href] = link;
          const external = href.startsWith("http");
          return external ? (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sun-deep underline decoration-sun/40 underline-offset-2 hover:decoration-sun"
            >
              {label}
            </a>
          ) : (
            <Link
              key={i}
              href={href}
              className="font-medium text-sun-deep underline decoration-sun/40 underline-offset-2 hover:decoration-sun"
            >
              {label}
            </Link>
          );
        }
        return <span key={i}>{tok}</span>;
      })}
    </>
  );
}

const CALLOUT = {
  note: { ring: "border-line", bg: "bg-paper-deep/50", label: "Note", tone: "text-ink-soft" },
  tip: { ring: "border-sun/30", bg: "bg-sun-soft/50", label: "Good to know", tone: "text-sun-deep" },
  warn: { ring: "border-clay/30", bg: "bg-clay-soft/50", label: "Heads up", tone: "text-clay" },
} as const;

export function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case "p":
      return (
        <p className="text-[15px] leading-7 text-ink-soft">
          <InlineText text={block.text} />
        </p>
      );

    case "ul":
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-7 text-ink-soft">
              <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-sun/60" aria-hidden />
              <span>
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol className="space-y-3">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-7 text-ink-soft">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-paper-deep text-xs font-semibold tabular-nums text-ink-soft">
                {i + 1}
              </span>
              <span>
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ol>
      );

    case "note":
    case "tip":
    case "warn": {
      const c = CALLOUT[block.t];
      return (
        <aside className={`rounded-2xl border ${c.ring} ${c.bg} px-4 py-3`}>
          <div className={`mb-0.5 text-[11px] font-semibold uppercase tracking-wide ${c.tone}`}>
            {c.label}
          </div>
          <p className="text-sm leading-6 text-ink-soft">
            <InlineText text={block.text} />
          </p>
        </aside>
      );
    }

    case "keys":
      return (
        <div className="overflow-hidden rounded-2xl border border-line">
          {block.rows.map((row, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-4 py-2.5 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <kbd className="min-w-16 shrink-0 rounded-md border border-line bg-paper-deep px-2 py-1 text-center font-mono text-[11px] text-ink">
                {row.k}
              </kbd>
              <span className="text-sm text-ink-soft">
                <InlineText text={row.d} />
              </span>
            </div>
          ))}
        </div>
      );

    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left">
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
  }
}
