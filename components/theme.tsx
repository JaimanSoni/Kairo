"use client";

import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";

function resolve(pref: ThemePref): "light" | "dark" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      try {
        const stored = localStorage.getItem("kairo-theme") as ThemePref | null;
        if (stored === "light" || stored === "dark" || stored === "system") setPref(stored);
      } catch {}
    });
  }, []);

  /* follow OS changes while on "system" */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      let p: ThemePref = "system";
      try {
        p = (localStorage.getItem("kairo-theme") as ThemePref) || "system";
      } catch {}
      if (p === "system") document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
    };
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const setTheme = (p: ThemePref) => {
    setPref(p);
    try {
      localStorage.setItem("kairo-theme", p);
    } catch {}
    document.documentElement.dataset.theme = resolve(p);
  };

  return { pref, setTheme, mounted };
}

const OPTIONS: { value: ThemePref; label: string; icon: React.ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M13.5 9.5A6 6 0 016.5 2.5a6 6 0 107 7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "Auto",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3" width="13" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

/** Three-way theme switch: Light / Dark / Auto. */
export function ThemeToggle() {
  const { pref, setTheme, mounted } = useTheme();

  return (
    <div className="flex rounded-full border border-line bg-paper-deep p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => setTheme(o.value)}
          aria-label={`${o.label} theme`}
          title={`${o.label} theme`}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
            mounted && pref === o.value
              ? "bg-card text-ink shadow-sm"
              : "text-ink-faint hover:text-ink-soft"
          }`}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
