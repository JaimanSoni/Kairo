import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getLeadStats, listLeads, type GtmLead } from "@/lib/leads";
import { Empty, PageHead, Stats, TableShell, Th } from "@/components/admin/ui";
import { LeadActions } from "@/components/admin/lead-actions";

export const metadata: Metadata = {
  title: "GTM Leads · Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SENTIMENT_COLORS: Record<string, string> = {
  angry: "bg-clay-soft text-clay",
  furious: "bg-clay-soft text-clay",
  frustrated: "bg-clay-soft text-clay",
  "insightful-frustrated": "bg-clay-soft text-clay",
  searching: "bg-sun-soft text-sun-deep",
  seeking: "bg-sun-soft text-sun-deep",
  evaluating: "bg-sun-soft text-sun-deep",
  uncertain: "bg-sun-soft text-sun-deep",
  torn: "bg-sun-soft text-sun-deep",
  restless: "bg-sun-soft text-sun-deep",
  overwhelmed: "bg-clay-soft text-clay",
  disappointed: "bg-clay-soft text-clay",
  exhausted: "bg-clay-soft text-clay",
  dissatisfied: "bg-clay-soft text-clay",
  underwhelmed: "bg-clay-soft text-clay",
  "moved-on": "bg-moss-soft text-moss",
  "moved-on-but-unsatisfied": "bg-sun-soft text-sun-deep",
  abandoned: "bg-clay-soft text-clay",
  "price-sensitive": "bg-sun-soft text-sun-deep",
  skeptical: "bg-sun-soft text-sun-deep",
  confused: "bg-sun-soft text-sun-deep",
  mismatched: "bg-sun-soft text-sun-deep",
  builder: "bg-moss-soft text-moss",
  "builder-frustrated": "bg-sun-soft text-sun-deep",
  analytical: "bg-moss-soft text-moss",
  "content-but-open": "bg-sun-soft text-sun-deep",
  "philosophical-disagreement": "bg-sun-soft text-sun-deep",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-sun-soft text-sun-deep",
  contacted: "bg-sun-soft text-sun-deep",
  replied: "bg-moss-soft text-moss",
  converted: "bg-moss-soft text-moss",
  declined: "bg-clay-soft text-clay",
  invalid: "bg-clay-soft text-clay",
};

function sentimentLabel(s: string): string {
  return SENTIMENT_COLORS[s] ?? "bg-paper-deep text-ink-soft";
}

function statusLabel(s: string | undefined): string {
  return s ? (STATUS_COLORS[s] ?? "bg-paper-deep text-ink-soft") : "bg-paper-deep text-ink-soft";
}

function PainBar({ title, rows, total }: { title: string; rows: { _id: string; count: number }[]; total: number }) {
  const max = rows[0]?.count ?? 1;
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink-faint">No data yet</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r._id} className="text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{r._id}</span>
                <span className="shrink-0 tabular-nums text-ink-soft">
                  {r.count}
                  <span className="ml-1.5 text-[11px] text-ink-faint">
                    {Math.round((r.count / total) * 100)}%
                  </span>
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

const PER_PAGE = 200;

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [stats, { leads, total }] = await Promise.all([
    getLeadStats(),
    listLeads({ sort: "score", limit: PER_PAGE, offset: (page - 1) * PER_PAGE, hideInvalid: true }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHead title="GTM Leads">
        Real people harvested from public complaint threads: Reddit, Product Hunt reviews, and
        Hacker News. Every row is a verified username with a link to their actual post. Sorted by
        fit score; work the hot tier first.
      </PageHead>

      <Stats
        items={[
          { label: "Total leads", value: total },
          { label: "High fit (80+)", value: stats.byScore.high },
          { label: "Medium fit", value: stats.byScore.medium },
          { label: "New leads", value: stats.byStatus.find((s) => s._id === "new")?.count ?? 0 },
        ]}
      />

      {/* ---------------------------------------------- competitors + pain */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PainBar title="By Competitor" rows={stats.byCompetitor} total={total} />
        <PainBar title="Top Pain Points" rows={stats.topPainPoints} total={total} />
        <PainBar
          title="By Sentiment"
          rows={stats.bySentiment.map((s) => ({ _id: String(s._id ?? "unknown"), count: s.count }))}
          total={total}
        />
        <PainBar
          title="By Status"
          rows={stats.byStatus.map((s) => ({ _id: String(s._id ?? "new"), count: s.count }))}
          total={total}
        />
      </div>

      {/* --------------------------------------------------------- leads table */}
      <div className="mt-8">
        {leads.length === 0 ? (
          <Empty>No leads found. Run the seed script to populate the database.</Empty>
        ) : (
          <div className="hidden lg:block">
            <TableShell>
              <thead className="border-b border-line bg-paper-deep/40 text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <Th>Lead</Th>
                  <Th>Competitor</Th>
                  <Th>Pain Points</Th>
                  <Th>Score</Th>
                  <Th>Sentiment</Th>
                  <Th>Status</Th>
                  <Th>Contact</Th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={`${lead.username}-${lead.platform}`} className="border-t border-line/70">
                    <td className="px-4 py-2.5 max-w-[240px]">
                      <div>
                        <span className="block truncate text-sm font-medium">
                          {lead.username || lead.name || "Anonymous"}
                        </span>
                        <span className="block text-[11px] text-ink-faint">
                          {lead.platform}
                          {lead.profile_url && (
                            <>
                              {" · "}
                              <a
                                href={lead.profile_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-ink"
                              >
                                profile
                              </a>
                            </>
                          )}
                          {lead.post_url && (
                            <>
                              {" · "}
                              <a
                                href={lead.post_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-ink"
                              >
                                post
                              </a>
                            </>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-[13px]">{lead.competitor}</td>
                    <td className="px-4 py-2.5 max-w-[260px]">
                      <div className="flex flex-wrap gap-1">
                        {lead.pain_points.slice(0, 3).map((p) => (
                          <span
                            key={p}
                            className="rounded-full bg-paper-deep px-2 py-0.5 text-[11px] text-ink-soft"
                          >
                            {p}
                          </span>
                        ))}
                        {lead.pain_points.length > 3 && (
                          <span className="text-[11px] text-ink-faint">
                            +{lead.pain_points.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold tabular-nums ${
                          lead.estimated_fit_score >= 80
                            ? "bg-moss-soft text-moss"
                            : lead.estimated_fit_score >= 60
                              ? "bg-sun-soft text-sun-deep"
                              : "bg-paper-deep text-ink-soft"
                        }`}
                      >
                        {lead.estimated_fit_score}
                      </span>
                      {lead.notes?.startsWith("Tier: hot") && (
                        <span className="ml-1.5 rounded-full bg-clay-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-clay">
                          hot
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${sentimentLabel(lead.sentiment)}`}
                      >
                        {lead.sentiment}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusLabel(lead.status)}`}
                      >
                        {lead.status ?? "new"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <LeadActions lead={lead} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </div>
        )}

        {/* ------------------------------------------- mobile cards */}
        <ul className="mt-6 space-y-3 lg:hidden">
          {leads.slice(0, 50).map((lead) => (
            <li
              key={`${lead.username}-${lead.platform}`}
              className="rounded-2xl border border-line bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {lead.username || lead.name || "Anonymous"}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {lead.platform} · {lead.competitor}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft line-clamp-2">
                    {lead.review_summary}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        lead.estimated_fit_score >= 80
                          ? "bg-moss-soft text-moss"
                          : lead.estimated_fit_score >= 60
                            ? "bg-sun-soft text-sun-deep"
                            : "bg-paper-deep text-ink-soft"
                      }`}
                    >
                      Score: {lead.estimated_fit_score}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sentimentLabel(lead.sentiment)}`}
                    >
                      {lead.sentiment}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusLabel(lead.status)}`}
                    >
                      {lead.status ?? "new"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {lead.pain_points.slice(0, 3).map((p) => (
                      <span
                        key={p}
                        className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] text-ink-soft"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  {lead.suggested_personalized_outreach && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] font-medium text-sun-deep">
                        Outreach copy →
                      </summary>
                      <p className="mt-1 rounded-lg bg-paper-deep p-2 text-[11px] leading-relaxed text-ink-soft">
                        {lead.suggested_personalized_outreach}
                      </p>
                    </details>
                  )}
                </div>
                <LeadActions lead={lead} />
              </div>
            </li>
          ))}
          {leads.length > 50 && (
            <p className="text-center text-xs text-ink-faint">
              Showing 50 of {leads.length} leads. Use desktop for the full table.
            </p>
          )}
        </ul>

        {/* ------------------------------------------------- pagination */}
        {pages > 1 && (
          <div className="mt-6 flex items-center justify-between text-sm">
            {page > 1 ? (
              <a href={`?page=${page - 1}`} className="font-medium underline underline-offset-2 hover:text-ink">
                Previous
              </a>
            ) : (
              <span />
            )}
            <span className="text-xs text-ink-faint">
              Page {page} of {pages} · {total} leads
            </span>
            {page < pages ? (
              <a href={`?page=${page + 1}`} className="font-medium underline underline-offset-2 hover:text-ink">
                Next
              </a>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
