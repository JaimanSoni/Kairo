"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The admin's section nav.
 *
 * A client component only because the current section has to be highlighted,
 * which needs the pathname. Everything it links to is a server page.
 */
const SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/promos", label: "Promos" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const path = usePathname();

  return (
    <nav aria-label="Admin sections" className="border-b border-line bg-paper">
      {/* scrolls itself on a phone rather than wrapping into two rows */}
      <div className="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6">
        <ul className="flex min-w-max gap-1 py-1.5">
          {SECTIONS.map((s) => {
            // /admin matches exactly; the rest match their subtree
            const active = s.href === "/admin" ? path === "/admin" : path.startsWith(s.href);
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={active ? "page" : undefined}
                  className={`block whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-ink text-paper"
                      : "text-ink-soft hover:bg-paper-deep hover:text-ink"
                  }`}
                >
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
