"use client";

import { useEffect, useState } from "react";

/**
 * App-level error boundary. The most common production error is a stale tab
 * talking to a newer build — one automatic reload fixes that invisibly.
 * Anything persistent gets a calm recovery screen.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [autoReloading, setAutoReloading] = useState(true);

  useEffect(() => {
    try {
      const key = "kairo-error-reload";
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        return;
      }
    } catch {}
    queueMicrotask(() => setAutoReloading(false));
  }, []);

  if (autoReloading) return null;

  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 text-center shadow-lg">
        <div className="text-4xl">🫧</div>
        <h1 className="font-display mt-3 text-3xl">Something hiccuped</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Usually this just means the app updated underneath you. Your tasks are safe.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[10px] text-ink-faint">ref: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-sun px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25"
          >
            Reload
          </button>
          <button
            onClick={reset}
            className="rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink-soft hover:border-ink-faint"
          >
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
