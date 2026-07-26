"use client";

import { useEffect, useState } from "react";
import type { Section } from "@/lib/support/types";

/** Sticky table of contents with scroll-spy highlighting. */
export function Toc({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        let current = sections[0]?.id ?? "";
        for (const s of sections) {
          const el = document.getElementById(s.id);
          if (el && el.getBoundingClientRect().top <= 120) current = s.id;
        }
        setActive(current);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  if (sections.length < 2) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        On this page
      </div>
      <ul className="space-y-0.5 border-l border-line">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={`-ml-px block border-l py-1 pl-3 text-[13px] leading-snug transition-colors ${
                active === s.id
                  ? "border-sun font-medium text-sun-deep"
                  : "border-transparent text-ink-faint hover:text-ink-soft"
              }`}
            >
              {s.heading}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
