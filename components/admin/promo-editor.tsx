"use client";

import { useState } from "react";
import { Empty, TableShell, Th } from "./ui";

/** The wire shape: dates flattened to strings by the server page. */
type PromoRow = {
  id: string;
  code: string;
  percentOff: number;
  maxUses: number | null;
  usedCount: number;
  planKeys: string[] | null;
  expiresAt: string | null;
  active: boolean;
  note: string;
  createdAt: string;
};

/**
 * Create and manage promo codes. Everything here is bookkeeping; the money
 * math happens server-side at order time, so the worst a mistake on this
 * screen can do is offer a discount you didn't mean to.
 */
export function PromoEditor({
  initial,
  planKeys,
}: {
  initial: PromoRow[];
  planKeys: { key: string; name: string }[];
}) {
  const [promos, setPromos] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // the create form
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("50");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [scoped, setScoped] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim() || undefined,
          percentOff: Number(percent),
          maxUses: maxUses.trim() ? Number(maxUses) : null,
          planKeys: scoped.length > 0 ? scoped : null,
          expiresAt: expiresAt || null,
          note,
        }),
      });
      const data = (await res.json()) as { promo?: PromoRow & { expiresAt: string | Date | null; createdAt: string | Date }; error?: string };
      if (!res.ok || !data.promo) throw new Error(data.error ?? "Could not create the code");
      const p = data.promo;
      setPromos((rows) => [
        {
          ...p,
          expiresAt: p.expiresAt ? String(p.expiresAt).slice(0, 10) : null,
          createdAt: String(p.createdAt),
        },
        ...rows,
      ]);
      setCode("");
      setMaxUses("");
      setExpiresAt("");
      setScoped([]);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the code");
    }
    setBusy(false);
  };

  const patch = async (id: string, body: Record<string, unknown>, local: Partial<PromoRow>) => {
    setPromos((rows) => rows.map((r) => (r.id === id ? { ...r, ...local } : r)));
    const res = await fetch("/api/admin/promos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (!res.ok) setError("That change didn't save, reload and try again");
  };

  const remove = async (row: PromoRow) => {
    const res = await fetch(`/api/admin/promos?id=${row.id}`, { method: "DELETE" });
    const data = (await res.json()) as { deleted?: boolean };
    if (data.deleted) setPromos((rows) => rows.filter((r) => r.id !== row.id));
    else setPromos((rows) => rows.map((r) => (r.id === row.id ? { ...r, active: false } : r)));
  };

  return (
    <>
      {/* ---------------------------------------------------------- create */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          New code
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-ink-faint">Code (blank = generated)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="LAUNCH50"
              className="w-36 rounded-lg border border-line bg-paper px-3 py-1.5 font-mono text-sm uppercase"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-faint">% off</span>
            <input
              value={percent}
              onChange={(e) => setPercent(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              className="w-16 rounded-lg border border-line bg-paper px-3 py-1.5 text-right text-sm tabular-nums"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-faint">Max uses (blank = unlimited)</span>
            <input
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="∞"
              className="w-24 rounded-lg border border-line bg-paper px-3 py-1.5 text-right text-sm tabular-nums"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-faint">Expires (blank = never)</span>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
            />
          </label>
          <div className="block">
            <span className="mb-1 block text-xs text-ink-faint">Plans (none = all)</span>
            <div className="flex gap-1.5">
              {planKeys.map((p) => {
                const on = scoped.includes(p.key);
                return (
                  <button
                    key={p.key}
                    onClick={() =>
                      setScoped((s) => (on ? s.filter((k) => k !== p.key) : [...s, p.key]))
                    }
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      on ? "border-sun bg-sun-soft text-sun-deep" : "border-line bg-paper text-ink-soft"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block min-w-40 flex-1">
            <span className="mb-1 block text-xs text-ink-faint">Note (for you)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Product Hunt launch"
              className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={() => void create()}
            disabled={busy || !Number(percent)}
            className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create code"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-clay">{error}</p>}
      </div>

      {/* ------------------------------------------------------------ list */}
      <div className="mt-6">
        {promos.length === 0 ? (
          <Empty>No codes yet. The first one is one form away.</Empty>
        ) : (
          <TableShell>
            <thead className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
              <tr>
                <Th>Code</Th>
                <Th right>Off</Th>
                <Th right>Used</Th>
                <Th>Plans</Th>
                <Th>Expires</Th>
                <Th>Note</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className={`border-b border-line/60 last:border-0 ${p.active ? "" : "opacity-50"}`}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm font-semibold">
                    {p.code}
                    {!p.active && (
                      <span className="ml-2 rounded-md bg-paper-deep px-1.5 py-0.5 font-sans text-[10px] font-medium text-ink-soft">
                        off
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{p.percentOff}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.usedCount}
                    <span className="text-ink-faint"> / {p.maxUses ?? "∞"}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-soft">
                    {p.planKeys?.join(", ") ?? "all"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-ink-soft">
                    {p.expiresAt ?? "never"}
                  </td>
                  <td className="max-w-40 truncate px-4 py-2.5 text-xs text-ink-soft">{p.note}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <button
                      onClick={() => void patch(p.id, { active: !p.active }, { active: !p.active })}
                      className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium hover:border-sun hover:text-sun-deep"
                    >
                      {p.active ? "Turn off" : "Turn on"}
                    </button>
                    <button
                      onClick={() => void remove(p)}
                      className="ml-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-clay hover:border-clay"
                    >
                      {p.usedCount > 0 ? "Retire" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </div>
    </>
  );
}
