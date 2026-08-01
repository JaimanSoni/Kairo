import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { listPlans } from "@/lib/plans";
import { loadAdminUsers } from "@/lib/users";
import { FEATURES, FEATURE_KEYS } from "@/lib/features";
import { TRIAL_DAYS } from "@/lib/billing";
import { PlanEditor } from "@/components/admin/plan-editor";
import { PageHead, Stats } from "@/components/admin/ui";

export const metadata: Metadata = {
  title: "Plans · Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPlans() {
  await requireAdmin();

  const [plans, { users }] = await Promise.all([listPlans({ fresh: true }), loadAdminUsers()]);

  // how many accounts sit on each plan, so retiring one isn't a guess
  const holders = new Map<string, number>();
  for (const u of users) if (u.planKey) holders.set(u.planKey, (holders.get(u.planKey) ?? 0) + 1);

  const features = FEATURE_KEYS.map((key) => ({
    key,
    name: FEATURES[key].name,
    description: FEATURES[key].description,
    enforcedAt: FEATURES[key].enforcedAt,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHead title="Plans">
        What people can buy, and what each plan unlocks. Everyone gets the whole product free for
        the first {TRIAL_DAYS} days regardless, nobody upgrades for a feature they were never
        allowed to try.
      </PageHead>

      <Stats
        items={[
          { label: "Plans", value: plans.length },
          { label: "On sale", value: plans.filter((p) => p.active).length },
          { label: "Features", value: features.length },
          { label: "On a plan", value: [...holders.values()].reduce((a, b) => a + b, 0) },
        ]}
      />

      <div className="mt-6">
        <PlanEditor plans={plans} features={features} />
      </div>

      <section className="mt-10 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm font-semibold">Where these are enforced</h2>
        <p className="mt-1 text-xs leading-5 text-ink-soft">
          Features are defined in code, not here, a toggle that nothing reads would look like it
          worked and quietly sell someone nothing. Each one is checked on the server at the point
          below, so hiding a button is never the only thing standing in the way.
        </p>
        <ul className="mt-3 space-y-2">
          {features.map((f) => (
            <li key={f.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
              <span className="font-medium">{f.name}</span>
              <code className="rounded bg-paper-deep px-1.5 py-0.5 text-[11px] text-ink-faint">
                {f.enforcedAt}
              </code>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-ink-faint">
          Adding a fourth means adding it to <code>lib/features.ts</code> and a{" "}
          <code>requireFeature</code> call where the work happens. It then appears here on its own.
        </p>
      </section>

      {holders.size > 0 && (
        <section className="mt-6 rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold">Who is on what</h2>
          <ul className="mt-2 space-y-1 text-xs text-ink-soft">
            {plans.map((p) => (
              <li key={p.key} className="flex justify-between">
                <span>{p.name}</span>
                <span className="tabular-nums text-ink-faint">
                  {holders.get(p.key) ?? 0} {(holders.get(p.key) ?? 0) === 1 ? "account" : "accounts"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
