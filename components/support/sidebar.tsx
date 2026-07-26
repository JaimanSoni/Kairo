"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ARTICLES, CATEGORIES } from "@/lib/support/content";

/** Persistent category → article nav. Desktop only; mobile uses breadcrumb + related. */
export function SupportSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Help topics" className="text-sm">
      {CATEGORIES.map((cat) => {
        const items = ARTICLES.filter((a) => a.categoryId === cat.id);
        if (items.length === 0) return null;
        return (
          <div key={cat.id} className="mb-6">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              {cat.name}
            </div>
            <ul className="space-y-px">
              {items.map((a) => {
                const active = pathname === `/support/${a.slug}`;
                return (
                  <li key={a.slug}>
                    <Link
                      href={`/support/${a.slug}`}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition-colors ${
                        active
                          ? "bg-sun-soft font-medium text-sun-deep"
                          : "text-ink-soft hover:bg-paper-deep/60 hover:text-ink"
                      }`}
                    >
                      {a.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
