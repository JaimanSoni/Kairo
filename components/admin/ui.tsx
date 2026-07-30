/**
 * The furniture every admin page shares.
 *
 * Pulled out when the single dashboard became five pages — the alternative was
 * five copies of the same date formatter drifting apart.
 */

/** "12 Mar 2026" — unambiguous, and stable regardless of the viewer's locale. */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Coarse "how long ago" — enough to spot who's active at a glance. */
export function since(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function money(minor: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export function PageHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
      {children && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{children}</p>}
    </div>
  );
}

export function Stats({ items }: { items: { label: string; value: string | number; tone?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="rounded-2xl border border-line bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {s.label}
          </div>
          <div className={`font-display mt-1 text-2xl tabular-nums sm:text-3xl ${s.tone ?? ""}`}>
            {typeof s.value === "number" ? s.value.toLocaleString("en-IN") : s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
      {children}
    </p>
  );
}

/** A scrollable table shell. Wide tables must scroll themselves, not the page. */
export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th className={`whitespace-nowrap px-4 py-2.5 font-semibold ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

export function Avatar({ name, picture }: { name: string; picture?: string }) {
  if (picture) {
    return (
      // referrerPolicy is load-bearing: Google rejects lh3.googleusercontent
      // requests carrying a Referer, and Chrome's opaque-response blocking then
      // kills the reply outright (ERR_BLOCKED_BY_ORB) — a blank avatar.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={picture}
        alt=""
        width={32}
        height={32}
        referrerPolicy="no-referrer"
        className="size-8 shrink-0 rounded-full bg-paper-deep object-cover"
      />
    );
  }
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sun-soft text-xs font-bold text-sun-deep">
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}
