"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/plans";
import type { FeatureKey } from "@/lib/features";

/**
 * The plan editor: prices, and which features each plan grants.
 *
 * The feature list comes from the server, generated from the code registry, so
 * this can only ever offer entitlements something actually enforces. Prices are
 * held as text while typing and converted to minor units on save — money never
 * passes through a float.
 */

type FeatureMeta = { key: FeatureKey; name: string; description: string; enforcedAt: string };

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export function PlanEditor({ plans, features }: { plans: Plan[]; features: FeatureMeta[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (method: string, body: unknown, key: string, url = "/api/admin/plans") => {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; holders?: number; deleted?: boolean };
      if (!res.ok) throw new Error(data.error ?? "That didn't save");
      if (data.deleted === false && (data.holders ?? 0) > 0) {
        alert(
          `${data.holders} account${data.holders === 1 ? "" : "s"} still on this plan, so it has been retired instead of deleted — it can't be bought, and they keep what they paid for.`
        );
      }
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggleFeature = (plan: Plan, feature: FeatureKey) => {
    const next = plan.features.includes(feature)
      ? plan.features.filter((f) => f !== feature)
      : [...plan.features, feature];
    void call("PATCH", { id: plan.id, features: next }, `${plan.id}:${feature}`);
  };

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl bg-clay-soft px-4 py-2.5 text-sm text-clay">{error}</p>
      )}

      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          features={features}
          busy={busy}
          onSave={(patch) => call("PATCH", { id: plan.id, ...patch }, plan.id)}
          onToggle={(f) => toggleFeature(plan, f)}
          onDelete={async () => {
            if (
              !confirm(
                `Delete "${plan.name}"?\n\nIf anyone is on it, it will be retired instead — hidden from checkout, but still honoured for them.`
              )
            )
              return;
            await call("DELETE", null, plan.id, `/api/admin/plans?id=${plan.id}`);
          }}
        />
      ))}

      {creating ? (
        <NewPlan
          features={features}
          busy={busy === "new"}
          onCancel={() => setCreating(false)}
          onCreate={async (body) => {
            if (await call("POST", body, "new")) setCreating(false);
          }}
        />
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full rounded-2xl border border-dashed border-line py-4 text-sm font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
        >
          + Add a plan
        </button>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  features,
  busy,
  onSave,
  onToggle,
  onDelete,
}: {
  plan: Plan;
  features: FeatureMeta[];
  busy: string | null;
  onSave: (patch: Record<string, unknown>) => Promise<boolean>;
  onToggle: (f: FeatureKey) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(plan.name);
  const [tagline, setTagline] = useState(plan.tagline);
  const [price, setPrice] = useState((plan.priceMinor / 100).toString());
  const dirty =
    name !== plan.name ||
    tagline !== plan.tagline ||
    Math.round(Number(price) * 100) !== plan.priceMinor;

  const save = () => {
    const major = Number(price);
    if (!Number.isFinite(major) || major < 1) return;
    void onSave({ name, tagline, priceMinor: Math.round(major * 100) });
  };

  return (
    <div className={`rounded-2xl border bg-card p-5 ${plan.active ? "border-line" : "border-dashed border-line"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Plan name"
            className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-base font-semibold"
          />
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One line about who it's for"
            aria-label="Tagline"
            className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] text-ink-soft"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-ink-faint">{plan.currency}</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            aria-label="Price"
            className="w-24 rounded-lg border border-line bg-paper px-3 py-1.5 text-right font-semibold tabular-nums"
          />
          <span className="text-xs text-ink-faint">/mo</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <code className="rounded-md bg-paper-deep px-1.5 py-0.5 text-[11px] text-ink-faint">{plan.key}</code>
        {!plan.active && (
          <span className="rounded-md bg-paper-deep px-1.5 py-0.5 text-[11px] text-ink-soft">
            retired — not sellable
          </span>
        )}
        {/* only while editing — "₹199 saved" on a pricing page reads as a discount */}
        {dirty && (
          <span className="text-sun-deep">
            unsaved · currently {money(plan.priceMinor, plan.currency)}
          </span>
        )}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Includes
        </div>
        <ul className="space-y-2">
          {features.map((f) => {
            const on = plan.features.includes(f.key);
            return (
              <li key={f.key} className="flex items-start gap-3">
                <button
                  onClick={() => onToggle(f.key)}
                  disabled={busy === `${plan.id}:${f.key}`}
                  role="switch"
                  aria-checked={on}
                  aria-label={f.name}
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border text-[11px] font-bold transition-colors disabled:opacity-50 ${
                    on ? "border-moss bg-moss-soft text-moss" : "border-line bg-paper text-transparent"
                  }`}
                >
                  ✓
                </button>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{f.name}</span>
                  <span className="block text-xs leading-5 text-ink-faint">{f.description}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <button
          onClick={save}
          disabled={!dirty || busy === plan.id}
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy === plan.id ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
        <button
          onClick={() => void onSave({ active: !plan.active })}
          disabled={busy === plan.id}
          className="text-xs font-medium text-ink-faint underline underline-offset-2 hover:text-ink-soft disabled:opacity-50"
        >
          {plan.active ? "Retire" : "Make sellable"}
        </button>
        <button
          onClick={onDelete}
          disabled={busy === plan.id}
          className="ml-auto text-xs font-medium text-clay underline underline-offset-2 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function NewPlan({
  features,
  busy,
  onCancel,
  onCreate,
}: {
  features: FeatureMeta[];
  busy: boolean;
  onCancel: () => void;
  onCreate: (body: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [price, setPrice] = useState("");
  const [chosen, setChosen] = useState<FeatureKey[]>([]);

  const valid = name.trim().length > 0 && Number(price) >= 1;

  return (
    <div className="rounded-2xl border border-sun/40 bg-card p-5">
      <div className="text-sm font-semibold">New plan</div>
      <div className="mt-3 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name — e.g. Lite"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
        />
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="One line about who it's for"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-ink-faint">INR</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            placeholder="199"
            className="w-28 rounded-lg border border-line bg-paper px-3 py-2 text-right text-sm tabular-nums"
          />
          <span className="text-xs text-ink-faint">per month</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Includes
        </div>
        <div className="flex flex-wrap gap-2">
          {features.map((f) => {
            const on = chosen.includes(f.key);
            return (
              <button
                key={f.key}
                onClick={() =>
                  setChosen((c) => (on ? c.filter((x) => x !== f.key) : [...c, f.key]))
                }
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  on ? "border-moss bg-moss-soft text-moss" : "border-line bg-paper text-ink-soft"
                }`}
              >
                {on ? "✓ " : ""}
                {f.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() =>
            onCreate({
              name: name.trim(),
              tagline: tagline.trim(),
              priceMinor: Math.round(Number(price) * 100),
              features: chosen,
            })
          }
          disabled={!valid || busy}
          className="rounded-full bg-sun px-4 py-1.5 text-xs font-semibold text-on-accent disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create plan"}
        </button>
        <button onClick={onCancel} className="text-xs text-ink-faint underline underline-offset-2">
          Cancel
        </button>
      </div>
    </div>
  );
}
