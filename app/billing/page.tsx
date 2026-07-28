import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/users";
import { loadBillingView, TRIAL_DAYS, type UserBilling } from "@/lib/billing";
import { PRICE_LABEL, billingMode } from "@/lib/razorpay";
import { BillingActions } from "@/components/billing-actions";

export const metadata: Metadata = {
  title: "Billing · Kairo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

function daysUntil(ms: number, now: number): number {
  return Math.max(0, Math.ceil((ms - now) / 86_400_000));
}

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const user = await getUserById(session.userId);
  if (!user) redirect("/");

  const billing = (user as { billing?: UserBilling }).billing ?? {};
  const { access, payments, now } = await loadBillingView(session.userId, user.createdAt, billing);
  const mode = billingMode();

  /* One sentence that says exactly where this account stands. */
  const headline =
    !access.paymentsEnabled
      ? "Kairo is free right now"
      : billing.comped
        ? "You have free access"
        : access.reason === "trial"
          ? `Free trial — ${access.trialDaysLeft} ${access.trialDaysLeft === 1 ? "day" : "days"} left`
          : access.reason === "subscribed"
            ? "Active"
            : access.reason === "grace"
              ? "Paid — not renewing"
              : "Not active";

  const detail =
    !access.paymentsEnabled
      ? "Payments are switched off, so everyone has full access. Nothing is being charged."
      : billing.comped
        ? "Your account has been given Kairo for free. There's nothing to pay and nothing to renew."
        : access.reason === "trial"
          ? `Your ${TRIAL_DAYS}-day trial ends on ${fmtDate(access.trialEndsAt)}. No card is needed until then.`
          : access.allowed && access.currentPeriodEnd
            ? `Your access runs until ${fmtDate(access.currentPeriodEnd)}.`
            : "Your access has ended. Pay for a month to pick up where you left off.";

  /* In one-off mode nothing auto-charges, so this is a deadline, not a debit. */
  const renewBy = access.currentPeriodEnd ?? (access.reason === "trial" ? access.trialEndsAt : null);
  const tone =
    !access.allowed ? "border-clay/40 bg-clay-soft/40"
    : access.reason === "trial" ? "border-sun/40 bg-sun-soft/40"
    : "border-moss/40 bg-moss-soft/40";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 sm:px-6">
      <header className="anim-rise mb-6">
        <h1 className="font-display text-4xl">Billing</h1>
        <p className="mt-1 text-sm text-ink-soft">
          What you&apos;re paying, when it runs out, and every payment you&apos;ve made.
        </p>
      </header>

      {/* status */}
      <section className={`anim-rise rounded-2xl border p-5 ${tone}`}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Status</div>
        <div className="font-display mt-1 text-2xl tracking-tight">{headline}</div>
        <p className="mt-1.5 text-sm leading-6 text-ink-soft">{detail}</p>

        {access.paymentsEnabled && !billing.comped && (
          <dl className="mt-5 grid gap-4 border-t border-line/60 pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Price</dt>
              <dd className="mt-0.5 text-sm font-semibold">{PRICE_LABEL} / month</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {/* a date in the past isn't a deadline, it's a fact */}
                {!access.allowed ? "Ended" : mode === "subscription" ? "Next payment" : "Renew by"}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {renewBy ? fmtDate(renewBy) : "—"}
                {renewBy && access.allowed && (
                  <span className="ml-1.5 font-normal text-ink-faint">
                    ({daysUntil(renewBy, now)}d)
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Renewal</dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {mode === "subscription" ? "Automatic" : "Manual"}
              </dd>
            </div>
          </dl>
        )}

        {access.paymentsEnabled && !billing.comped && (
          <BillingActions
            mode={mode}
            price={PRICE_LABEL}
            user={{ name: session.name, email: session.email }}
            canCancel={mode === "subscription" && (access.status === "active" || access.status === "authenticated")}
          />
        )}
      </section>

      {access.paymentsEnabled && mode === "one-off" && !billing.comped && (
        <p className="mt-3 text-xs leading-6 text-ink-faint">
          Nothing renews on its own — you&apos;re never charged unless you choose to pay for
          another month. Paying early stacks: the month is added to the end of the one you have.
        </p>
      )}

      {/* receipts */}
      <section className="mt-8">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Payments {payments.length > 0 && `· ${payments.length}`}
        </h2>
        {payments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-ink-soft">
            No payments yet.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line bg-card">
            {payments.map((p, i) => (
              <li
                key={p.paymentId}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 ${
                  i > 0 ? "border-t border-line" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {fmtDate(Date.parse(p.paidAt))}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-ink-faint">
                    {p.paymentId}
                  </span>
                </span>
                {p.coversUntil && (
                  <span className="text-xs text-ink-faint">until {fmtDate(p.coversUntil)}</span>
                )}
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {fmtMoney(p.amount, p.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs leading-6 text-ink-faint">
          Need a refund or an invoice? See the{" "}
          <Link href="/refunds" className="underline underline-offset-2 hover:text-ink-soft">
            refund policy
          </Link>{" "}
          — or just email us and we&apos;ll sort it.
        </p>
      </section>
    </div>
  );
}
