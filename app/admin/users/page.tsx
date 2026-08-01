import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { loadAdminUsers, type AdminUserRow } from "@/lib/users";
import { getBillingSettings, resolveAccess, TRIAL_DAYS } from "@/lib/billing";
import { listPlans } from "@/lib/plans";
import { CompToggle } from "@/components/admin-billing";
import { ActiveToggle, PlanPicker } from "@/components/admin/user-actions";
import { Avatar, Empty, fmtDate, PageHead, since, Stats, TableShell, Th } from "@/components/admin/ui";

export const metadata: Metadata = {
  title: "Users · Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** What this account is currently paying (or not) — at a glance. */
function BillingState({
  row,
  now,
  enabled,
  planName,
}: {
  row: AdminUserRow;
  now: number;
  enabled: boolean;
  planName: string | null;
}) {
  if (!enabled) return <span className="text-[11px] text-ink-faint">payments off</span>;
  if (row.comped) return <span className="text-[11px] text-moss">free forever</span>;

  const access = resolveAccess({
    createdAt: new Date(row.createdAt),
    billing: {
      status: (row.subStatus ?? undefined) as never,
      currentPeriodEnd: row.currentPeriodEnd ?? undefined,
    },
    settings: { paymentsEnabled: true },
    now,
  });

  const tone =
    access.reason === "subscribed" ? "text-moss"
    : access.reason === "trial" ? "text-sun-deep"
    : access.allowed ? "text-ink-soft"
    : "text-clay";
  const label =
    access.reason === "subscribed" ? (planName ?? row.subStatus)
    : access.reason === "trial" ? `trial · ${access.trialDaysLeft}/${TRIAL_DAYS}d`
    : access.reason === "grace" ? (planName ? `paid · ${planName}` : "paid through")
    : access.reason === "expired" ? (row.subStatus ?? "lapsed")
    : "no access";
  return <span className={`whitespace-nowrap text-[11px] ${tone}`}>{label}</span>;
}

export default async function AdminUsers() {
  const admin = await requireAdmin();
  const adminId = admin._id.toHexString();

  const [{ users, now }, settings, plans] = await Promise.all([
    loadAdminUsers(),
    getBillingSettings(),
    listPlans({ fresh: true }),
  ]);
  const planOptions = plans.map((p) => ({ key: p.key, name: p.name }));
  const planName = (key: string) => plans.find((p) => p.key === key)?.name ?? null;
  const week = 7 * 86_400_000;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHead title="Users">
        Everyone who has signed in. Deactivating keeps every task and list, it only stops the
        account being used, and it can be undone.
      </PageHead>

      <Stats
        items={[
          { label: "Users", value: users.length },
          {
            label: "Active this week",
            value: users.filter((u) => now - Date.parse(u.lastLoginAt) < week).length,
          },
          { label: "Free list", value: users.filter((u) => u.comped).length },
          { label: "Deactivated", value: users.filter((u) => u.disabled).length },
        ]}
      />

      {users.length === 0 ? (
        <div className="mt-6">
          <Empty>No users yet.</Empty>
        </div>
      ) : (
        <>
          {/* cards on phones, a real table from lg up */}
          <ul className="mt-6 space-y-2 lg:hidden">
            {users.map((u) => (
              <li
                key={u.id}
                className={`rounded-2xl border bg-card p-4 ${
                  u.disabled ? "border-clay/40 opacity-70" : "border-line"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} picture={u.picture} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{u.name}</div>
                    <div className="truncate text-xs text-ink-faint">{u.email}</div>
                  </div>
                  <ActiveToggle
                    userId={u.id}
                    email={u.email}
                    disabled={u.disabled}
                    isSelf={u.id === adminId}
                  />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-faint">
                  <span className="font-medium text-ink-soft">
                    {u.tasks} {u.tasks === 1 ? "task" : "tasks"}
                    {u.tasks > 0 && <span className="text-ink-faint"> · {u.tasksDone} done</span>}
                  </span>
                  <span className="font-medium text-ink-soft">
                    {u.lists} {u.lists === 1 ? "list" : "lists"}
                  </span>
                  {u.appLocked && <span>PIN</span>}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <CompToggle userId={u.id} comped={u.comped} email={u.email} />
                  <PlanPicker userId={u.id} planKey={u.planKey} plans={planOptions} />
                  <BillingState
                    row={u}
                    now={now}
                    enabled={settings.paymentsEnabled}
                    planName={planName(u.planKey)}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-ink-faint">
                  <span>Joined {fmtDate(u.createdAt)}</span>
                  <span>Seen {since(u.lastLoginAt, now)}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden lg:block">
            <TableShell>
              <thead className="border-b border-line bg-paper-deep/40 text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <Th>User</Th>
                  <Th right>Tasks / done</Th>
                  <Th right>Lists</Th>
                  <Th>Joined</Th>
                  <Th>Last seen</Th>
                  <Th>Plan</Th>
                  <Th>Billing</Th>
                  <Th>Account</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-t border-line/70 ${u.disabled ? "opacity-55" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={u.name} picture={u.picture} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{u.name}</span>
                          <span className="block truncate text-xs text-ink-faint">{u.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {u.tasks}
                      <span className="text-ink-faint"> / {u.tasksDone}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{u.lists}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">
                      {fmtDate(u.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">
                      {since(u.lastLoginAt, now)}
                    </td>
                    <td className="px-4 py-2.5">
                      <PlanPicker userId={u.id} planKey={u.planKey} plans={planOptions} />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        <CompToggle userId={u.id} comped={u.comped} email={u.email} />
                        <BillingState
                          row={u}
                          now={now}
                          enabled={settings.paymentsEnabled}
                          planName={planName(u.planKey)}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <ActiveToggle
                        userId={u.id}
                        email={u.email}
                        disabled={u.disabled}
                        isSelf={u.id === adminId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </div>
        </>
      )}
    </div>
  );
}
