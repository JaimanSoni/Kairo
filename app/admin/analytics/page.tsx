import { loadAnalytics } from "@/lib/analytics";
import { Empty, PageHead, Stats, TableShell, Th } from "@/components/admin/ui";

export const metadata = { title: "Analytics · Admin" };

/** One small ranked table; the whole dashboard is a grid of these. */
function Top({ title, rows, total }: { title: string; rows: { name: string; count: number }[]; total?: number }) {
  const max = rows[0]?.count ?? 1;
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink-faint">Nothing yet</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.name} className="text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{r.name}</span>
                <span className="shrink-0 tabular-nums text-ink-soft">
                  {r.count.toLocaleString("en-IN")}
                  {total ? (
                    <span className="ml-1.5 text-[11px] text-ink-faint">
                      {Math.round((r.count / total) * 100)}%
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-paper-deep">
                <div className="h-full rounded-full bg-sun/70" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function AnalyticsPage() {
  const a = await loadAnalytics(30);
  const maxDay = Math.max(1, ...a.daily.map((d) => d.visits));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHead title="Analytics">
        First-party events from the site and the app, last {a.days} days. Uniques are anonymous
        browser ids, not accounts; the admin area is never counted.
      </PageHead>

      <Stats
        items={[
          { label: "Uniques · 30d", value: a.totalUniques },
          { label: "Visits · 30d", value: a.totalVisits },
          { label: "Uniques · today", value: a.todayUniques },
          { label: "Visits · today", value: a.todayVisits },
        ]}
      />

      {/* ------------------------------------------------------ daily trend */}
      <div className="mt-6">
        {a.daily.length === 0 ? (
          <Empty>No page views recorded yet. They start counting the moment this deploy is live.</Empty>
        ) : (
          <TableShell>
            <thead className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
              <tr>
                <Th>Day</Th>
                <Th right>Uniques</Th>
                <Th right>Visits</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {[...a.daily].reverse().map((d) => (
                <tr key={d.day} className="border-b border-line/60 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums">{d.day}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.uniques.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.visits.toLocaleString("en-IN")}</td>
                  <td className="w-1/3 px-4 py-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-paper-deep">
                      <div className="h-full rounded-full bg-sun/70" style={{ width: `${(d.visits / maxDay) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </div>

      {/* ------------------------------------------------- what and wherefrom */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Top title="Events" rows={a.events} />
        <Top title="Referrers" rows={a.referrers} />
        <Top title="UTM sources" rows={a.sources} />
        <Top title="UTM campaigns" rows={a.campaigns} />
        <Top title="Countries" rows={a.countries} total={a.totalVisits} />
        <Top title="Devices" rows={a.devices} total={a.totalVisits} />
      </div>
    </div>
  );
}
