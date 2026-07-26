"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Microsoft Clarity — heatmaps and session replay.
 *
 * Configurable via NEXT_PUBLIC_CLARITY_ID, with the real project id as the
 * default so it works on a deploy with no dashboard setup. Set the variable to
 * an empty string to switch it off for an environment.
 */
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? "xskcn2ndap";

/** Clarity's own loader, unchanged apart from the id being injected. */
const loader = (id: string) => `(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${id}");`;

export function Analytics() {
  const pathname = usePathname();

  // Local runs would otherwise fill the recordings with development noise.
  if (process.env.NODE_ENV !== "production") return null;
  if (!CLARITY_ID) return null;

  // The admin dashboard lists every user's name and email. Replaying that into
  // a third-party recorder would hand over other people's data, so it is the
  // one place analytics must not run.
  if (pathname.startsWith("/admin")) return null;

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {loader(CLARITY_ID)}
    </Script>
  );
}
