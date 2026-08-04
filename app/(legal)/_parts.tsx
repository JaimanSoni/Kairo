import { SUPPORT_EMAIL } from "@/lib/site";

/** Shared bits for the policy pages, so they read as one document set. */

export function PageHead({ title, updated }: { title: string; updated: string }) {
  return (
    <>
      <h1 className="font-display text-4xl tracking-tight">{title}</h1>
      <p className="mt-2 text-xs text-ink-faint">Last updated {updated}</p>
    </>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display mt-9 text-2xl tracking-tight">{children}</h2>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15px] leading-7 text-ink-soft">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mt-3 space-y-2">{children}</ul>;
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[15px] leading-7 text-ink-soft">
      <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-sun/60" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

export function Mail() {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      className="font-medium text-sun-deep underline decoration-sun/40 underline-offset-2 hover:decoration-sun"
    >
      {SUPPORT_EMAIL}
    </a>
  );
}
