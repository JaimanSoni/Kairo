"use client";

import { useEffect, useState } from "react";

/**
 * The only moving part of the offline page.
 *
 * Nobody wants to sit on this screen deciding when to press a button, so the
 * page watches for the connection coming back and returns by itself. The
 * button is for the case the browser hasn't noticed yet — `online` fires on
 * having a network, not on that network reaching anything.
 */
export function Retry() {
  const [trying, setTrying] = useState(false);

  useEffect(() => {
    const back = () => window.location.reload();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, []);

  return (
    <button
      onClick={() => {
        setTrying(true);
        window.location.reload();
      }}
      className="mt-6 rounded-full bg-sun px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99]"
    >
      {trying ? "Trying…" : "Try again"}
    </button>
  );
}
