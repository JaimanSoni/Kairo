"use client";

import type { GtmLead } from "@/lib/leads";

export function LeadActions({ lead }: { lead: GtmLead }) {
  const contacts: { label: string; url?: string }[] = [];

  if (lead.profile_url && lead.platform === "Reddit")
    contacts.push({ label: "Reddit DM", url: `https://www.reddit.com/message/compose/?to=${lead.username.replace("u/", "")}` });
  if (lead.twitter) contacts.push({ label: "X", url: `https://x.com/${lead.twitter.replace("@", "")}` });
  if (lead.linkedin) contacts.push({ label: "LinkedIn", url: lead.linkedin });
  if (lead.github) contacts.push({ label: "GitHub", url: `https://github.com/${lead.github}` });
  if (lead.website) contacts.push({ label: "Web", url: lead.website });
  if (lead.contact_email) contacts.push({ label: "Email", url: `mailto:${lead.contact_email}` });
  if (lead.newsletter) contacts.push({ label: "Newsletter", url: lead.newsletter });

  if (contacts.length === 0 && lead.best_contact_method) {
    contacts.push({ label: lead.best_contact_method });
  }

  if (contacts.length === 0) return <span className="text-[11px] text-ink-faint">—</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {contacts.slice(0, 3).map((c) =>
        c.url ? (
          <a
            key={c.label}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line bg-card px-2.5 py-0.5 text-[11px] font-medium text-ink-soft transition-colors hover:border-sun hover:text-sun-deep"
          >
            {c.label}
          </a>
        ) : (
          <span
            key={c.label}
            className="rounded-full bg-paper-deep px-2.5 py-0.5 text-[11px] text-ink-faint"
          >
            {c.label}
          </span>
        )
      )}
      {contacts.length > 3 && (
        <span className="text-[10px] text-ink-faint">+{contacts.length - 3}</span>
      )}
    </div>
  );
}
