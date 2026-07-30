import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getBillingSettings, TRIAL_DAYS } from "@/lib/billing";
import { listSellablePlans } from "@/lib/plans";
import {
  billingMode,
  razorpayConfigured,
  razorpayKeyMode,
  webhookConfigured,
} from "@/lib/razorpay";
import { PaymentsToggle } from "@/components/admin-billing";
import { money, PageHead } from "@/components/admin/ui";

export const metadata: Metadata = {
  title: "Settings · Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line py-2.5 first:border-t-0">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className={`text-sm font-medium ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

export default async function AdminSettings() {
  await requireAdmin();

  const [settings, sellable] = await Promise.all([getBillingSettings(), listSellablePlans()]);
  const keyMode = razorpayKeyMode();
  const cheapest = sellable[0];
  const dearest = sellable[sellable.length - 1];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHead title="Settings">
        The master switch, and what Razorpay is currently wired up to do.
      </PageHead>

      <PaymentsToggle
        enabled={settings.paymentsEnabled}
        configured={razorpayConfigured()}
        webhookReady={webhookConfigured()}
        price={
          sellable.length === 0
            ? "nothing"
            : cheapest.key === dearest.key
              ? money(cheapest.priceMinor, cheapest.currency)
              : `${money(cheapest.priceMinor, cheapest.currency)}–${money(dearest.priceMinor, dearest.currency)}`
        }
        trialDays={TRIAL_DAYS}
        mode={billingMode()}
        keyMode={keyMode}
      />

      <section className="mt-6 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm font-semibold">Razorpay</h2>
        <div className="mt-2">
          <Row
            label="Keys"
            value={keyMode === "unset" ? "not set" : keyMode === "live" ? "live" : "test"}
            tone={keyMode === "live" ? "text-moss" : keyMode === "test" ? "text-clay" : "text-ink-faint"}
          />
          <Row
            label="Webhook secret"
            value={webhookConfigured() ? "set" : "not set"}
            tone={webhookConfigured() ? "text-moss" : "text-clay"}
          />
          <Row
            label="Charge shape"
            value={billingMode() === "subscription" ? "recurring subscription" : "one month at a time"}
          />
          <Row label="Free trial" value={`${TRIAL_DAYS} days, full access`} />
          <Row
            label="Plans on sale"
            value={sellable.length === 0 ? "none" : sellable.map((p) => p.name).join(", ")}
            tone={sellable.length === 0 ? "text-clay" : undefined}
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-ink-faint">
          Keys and the webhook secret come from the environment, so changing them means editing the
          deployment and redeploying — they can&apos;t be edited here on purpose. The trial length is{" "}
          <code>TRIAL_DAYS</code>, and it applies from each account&apos;s signup date the moment it
          changes.
        </p>
      </section>

      {settings.updatedBy && (
        <p className="mt-4 text-xs text-ink-faint">
          Payments last switched {settings.paymentsEnabled ? "on" : "off"} by {settings.updatedBy}
          {settings.updatedAt ? ` on ${new Date(settings.updatedAt).toLocaleString("en-GB")}` : ""}.
        </p>
      )}
    </div>
  );
}
