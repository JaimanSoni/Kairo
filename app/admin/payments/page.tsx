import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { loadRevenue } from "@/lib/billing";
import { listPlans } from "@/lib/plans";
import { Empty, fmtDate, money, PageHead, Stats, TableShell, Th } from "@/components/admin/ui";

export const metadata: Metadata = {
  title: "Payments · Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPayments() {
  await requireAdmin();

  const [revenue, plans] = await Promise.all([loadRevenue(), listPlans({ fresh: true })]);
  const planName = (key?: string) => (key ? plans.find((p) => p.key === key)?.name ?? key : "—");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHead title="Payments">
        Every payment Kairo has taken. These figures come from our own records, written when a
        payment is confirmed — Razorpay&apos;s dashboard remains the final word.
      </PageHead>

      <Stats
        items={[
          { label: "Revenue", value: money(revenue.totalMinor, revenue.currency) },
          { label: "This month", value: money(revenue.monthMinor, revenue.currency) },
          { label: "Payments", value: revenue.payments.length },
          { label: "Have paid", value: revenue.payingUsers },
        ]}
      />

      <div className="mt-6">
        {revenue.payments.length === 0 ? (
          <Empty>No payments yet.</Empty>
        ) : (
          <TableShell>
            <thead className="border-b border-line bg-paper-deep/40 text-[11px] uppercase tracking-wide text-ink-faint">
              <tr>
                <Th>Who</Th>
                <Th>Plan</Th>
                <Th>Paid</Th>
                <Th>Covers until</Th>
                <Th>Payment id</Th>
                <Th right>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {revenue.payments.map((p) => (
                <tr key={p.paymentId} className="border-t border-line/70">
                  <td className="px-4 py-2.5">
                    <span className="block truncate font-medium">{p.name || "—"}</span>
                    <span className="block truncate text-xs text-ink-faint">{p.email}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">
                    {planName(p.planKey)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">{fmtDate(p.paidAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">
                    {p.coversUntil ? fmtDate(new Date(p.coversUntil).toISOString()) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-ink-faint">{p.paymentId}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {money(p.amount, p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </div>
    </div>
  );
}
