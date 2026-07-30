"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Microsoft Clarity (heatmaps, session replay) and Google Analytics (traffic).
 *
 * Both configurable via env, with the real ids as defaults so a deploy works
 * with no dashboard setup. Set either variable to an empty string to switch
 * that tracker off for an environment.
 */
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? "xskcn2ndap";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-TSZF6PXBK2";

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

  // The admin dashboard lists every user's name and email. Sending that to a
  // third-party recorder would hand over other people's data, so it is the
  // one place analytics must not run.
  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      {CLARITY_ID && (
        <Script id="ms-clarity" strategy="afterInteractive">
          {loader(CLARITY_ID)}
        </Script>
      )}
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
          </Script>
        </>
      )}
    </>
  );
}
