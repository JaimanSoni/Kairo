import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { loadAdminUsers } from "@/lib/users";
import { getBillingSettings, loadRevenue, TRIAL_DAYS } from "@/lib/billing";
import { listPlans } from "@/lib/plans";
import { razorpayConfigured, razorpayKeyMode, webhookConfigured } from "@/lib/razorpay";
import { money, PageHead, Stats } from "@/components/admin/ui";

export const metadata: Metadata = {
  title: "Overview · Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Anything that needs attention before it becomes a support email. */
function warnings(input: {
  paymentsEnabled: boolean;
  configured: boolean;
  keyMode: string;
  webhookReady: boolean;
  sellablePlans: number;
}): { tone: "bad" | "warn"; text: string }[] {
  const out: { tone: "bad" | "warn"; text: string }[] = [];
  if (input.paymentsEnabled && !input.configured) {
    out.push({ tone: "bad", text: "Payments are on but Razorpay isn't configured, nobody can pay." });
  }
  if (input.paymentsEnabled && input.keyMode === "test") {
    out.push({ tone: "bad", text: "Payments are on with test keys. Real cards will be declined." });
  }
  if (input.configured && !input.webhookReady) {
    out.push({
      tone: "warn",
      text: "No webhook secret. If a customer's browser dies after paying, the money arrives and their access doesn't.",
    });
  }
  if (input.paymentsEnabled && input.sellablePlans === 0) {
    out.push({ tone: "bad", text: "Payments are on but no plan is sellable, the paywall has nothing to offer." });
  }
  return out;
}

export default async function AdminOverview() {
  await requireAdmin();

  const [snapshot, settings, revenue, plans] = await Promise.all([
    loadAdminUsers(),
    getBillingSettings({ fresh: true }),
    loadRevenue(),
    listPlans({ fresh: true }),
  ]);
  const { users, activeWeek, newWeek, totalTasks, totalTasksDone, totalLists } = snapshot;
  const sellable = plans.filter((p) => p.active);
  const notes = warnings({
    paymentsEnabled: settings.paymentsEnabled,
    configured: razorpayConfigured(),
    keyMode: razorpayKeyMode(),
    webhookReady: webhookConfigured(),
    sellablePlans: sellable.length,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHead title="Overview">
        Kairo at a glance. {settings.paymentsEnabled ? "Payments are on" : "Payments are off, everyone is free"},
        with a {TRIAL_DAYS}-day trial.
      </PageHead>

      {notes.length > 0 && (
        <ul className="mb-6 space-y-2">
          {notes.map((n) => (
            <li
              key={n.text}
              className={`rounded-xl px-4 py-2.5 text-sm ${
                n.tone === "bad" ? "bg-clay-soft text-clay" : "bg-sun-soft text-sun-deep"
              }`}
            >
              {n.text}
            </li>
          ))}
        </ul>
      )}

      <Stats
        items={[
          { label: "Users", value: users.length },
          { label: "Active this week", value: activeWeek },
          { label: "New this week", value: newWeek },
          { label: "Deactivated", value: users.filter((u) => u.disabled).length },
        ]}
      />

      <div className="mt-3">
        <Stats
          items={[
            { label: "Revenue", value: money(revenue.totalMinor, revenue.currency) },
            { label: "This month", value: money(revenue.monthMinor, revenue.currency) },
            { label: "Have paid", value: revenue.payingUsers },
            { label: "Free list", value: users.filter((u) => u.comped).length },
          ]}
        />
      </div>

      <div className="mt-3">
        <Stats
          items={[
            { label: "Tasks", value: totalTasks },
            { label: "Tasks done", value: totalTasksDone },
            { label: "Lists", value: totalLists },
            { label: "Plans on sale", value: sellable.length },
          ]}
        />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/admin/users", title: "Users", body: "Activate, deactivate, comp, and move accounts between plans." },
          { href: "/admin/plans", title: "Plans", body: "Prices, and which features each plan unlocks." },
          { href: "/admin/payments", title: "Payments", body: "Every payment taken, with who and when." },
          { href: "/admin/settings", title: "Settings", body: "The payments master switch and Razorpay's state." },
        ].map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl border border-line bg-card p-4 transition-colors hover:border-sun"
          >
            <div className="text-sm font-semibold">{c.title} →</div>
            <p className="mt-1 text-xs leading-5 text-ink-soft">{c.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
