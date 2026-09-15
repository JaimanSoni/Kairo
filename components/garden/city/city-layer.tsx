"use client";

import { useSearchParams } from "next/navigation";
import { KairoCity, useCityView } from "./city";
import { ClaimSheet } from "./claim";

/**
 * Kairo City over whatever page is open: the city at ?city=open, and a plot
 * to claim at ?claim=<code>. Mounted once for the whole app, so a link into
 * the city lands the same on Today, Habits, or the signed-out front door.
 */
export default function CityLayer() {
  const params = useSearchParams();
  const { open, hide } = useCityView();
  const claim = params.get("claim");
  const code = claim && /^[a-f0-9]{10}$/.test(claim) ? claim : null;
  return (
    <>
      {open && <KairoCity onClose={hide} />}
      {code && (
        <ClaimSheet
          key={code}
          code={code}
          onClose={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete("claim");
            window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
          }}
        />
      )}
    </>
  );
}
