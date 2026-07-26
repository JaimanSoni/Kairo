import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { loadAdminUsers } from "@/lib/users";

export const metadata: Metadata = {
  title: "Users · Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** "12 Mar 2026" — unambiguous, and stable regardless of the viewer's locale. */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Coarse "how long ago" — enough to spot who's active without a stats page. */
function since(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function Initial({ name, picture }: { name: string; picture?: string }) {
  if (picture) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={picture} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />;
  }
  return (
    <span className="grid size-8 place-items-center rounded-full bg-sun-soft text-xs font-bold text-sun-deep">
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export default async function AdminDashboard() {
  // the layout already gated this, but a page that authorises itself can't be
  // broken by someone later restructuring the segment
  await requireAdmin();

  const { users, activeWeek, newWeek, now } = await loadAdminUsers();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Users</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Everyone who has signed in to Kairo. Usage and payments will land here later.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total users", value: users.length },
          { label: "Signed in this week", value: activeWeek },
          { label: "New this week", value: newWeek },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-card p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              {s.label}
            </div>
            <div className="font-display mt-1 text-3xl tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      {users.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
          No users yet.
        </p>
      ) : (
        <>
          {/* cards on phones, a real table from sm up */}
          <ul className="mt-6 space-y-2 sm:hidden">
            {users.map((u) => (
              <li key={u.id} className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-center gap-3">
                  <Initial name={u.name} picture={u.picture} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{u.name}</div>
                    <div className="truncate text-xs text-ink-faint">{u.email}</div>
                  </div>
                  {u.appLocked && (
                    <span className="shrink-0 rounded-md bg-paper-deep px-1.5 py-0.5 text-[10px] text-ink-soft">
                      PIN
                    </span>
                  )}
                </div>
                <div className="mt-2.5 flex justify-between text-xs text-ink-faint">
                  <span>Joined {fmtDate(u.createdAt)}</span>
                  <span>Seen {since(u.lastLoginAt, now)}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden overflow-hidden rounded-2xl border border-line bg-card sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-paper-deep/40 text-[11px] uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">User</th>
                    <th className="px-4 py-2.5 font-semibold">Email</th>
                    <th className="px-4 py-2.5 font-semibold">Joined</th>
                    <th className="px-4 py-2.5 font-semibold">Last seen</th>
                    <th className="px-4 py-2.5 font-semibold">Lock</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-line/70">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2.5">
                          <Initial name={u.name} picture={u.picture} />
                          <span className="font-medium">{u.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft">{u.email}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">
                        {fmtDate(u.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">
                        {since(u.lastLoginAt, now)}
                      </td>
                      <td className="px-4 py-2.5 text-ink-faint">{u.appLocked ? "PIN" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
