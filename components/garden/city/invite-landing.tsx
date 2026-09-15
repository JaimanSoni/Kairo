"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import type { CityGarden } from "@/lib/habits-shared";
import { useClock } from "../fx";
import { phaseOf } from "../scene";
import { Balloon, hillsTile, LampPost, skylineTile, type CityPhase } from "./decor";
import { CityLot } from "./lot";

const noop = () => () => {};

const SKY: Record<CityPhase, string> = {
  night: "linear-gradient(180deg, #060e22 0%, #122445 50%, #25406a 100%)",
  dawn: "linear-gradient(180deg, #6d80d4 0%, #e6a7b0 55%, #ffd49c 100%)",
  day: "linear-gradient(180deg, #3aa1ea 0%, #8ad0f6 55%, #d8f2fb 100%)",
  golden: "linear-gradient(180deg, #e46f55 0%, #f5a65f 50%, #ffe09b 100%)",
  dusk: "linear-gradient(180deg, #211f5e 0%, #684b95 50%, #ec8b6e 100%)",
};

/**
 * The page a saved plot's link opens: the friend's garden on the street, the
 * plot beside it roped off for you, and one button to claim it (signing in on
 * the way, if need be).
 */
export function InviteLanding({
  code,
  status,
  inviter,
  inviterName,
  signedIn,
}: {
  code: string;
  status: "open" | "claimed" | "mine";
  inviter: CityGarden | null;
  inviterName: string | null;
  signedIn: boolean;
}) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const minute = useClock();
  const phase = phaseOf(minute) as CityPhase;
  const dark = phase === "night" || phase === "dusk";
  const who = inviterName ?? "A friend";
  const claimHref = `/today?claim=${code}`;

  if (!mounted) return <div className="fixed inset-0 bg-[linear-gradient(180deg,#3aa1ea_0%,#d8f2fb_60%,#6fb863_60%)]" aria-hidden />;

  return (
    <main className="city-root fixed inset-0 overflow-hidden" style={{ background: SKY[phase] }} data-invite-landing={code}>
      {[0, 1].map((i) => (
        <div key={i} className="gd-balloon absolute" style={{ left: `${18 + i * 58}%`, top: `${16 + i * 8}%`, width: 32 - i * 8, height: 46 - i * 10, animationDelay: `${-i * 5}s` }} aria-hidden>
          <Balloon colors={i ? ["#0c9384", "#8fe3d3"] : ["#ff6b6b", "#ffd166"]} />
        </div>
      ))}
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--road)+var(--lot-h)*0.42)] h-[min(34vh,300px)]" style={{ backgroundImage: skylineTile(phase), backgroundRepeat: "repeat-x", backgroundSize: "auto 100%", backgroundPositionY: "bottom" }} aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--road)+var(--lot-h)*0.2)] h-[min(18vh,150px)]" style={{ backgroundImage: hillsTile(phase), backgroundRepeat: "repeat-x", backgroundSize: "900px 100%" }} aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(var(--road)+var(--lot-h)*0.3)]" style={{ background: dark ? "#2a4a3c" : "#6fb863" }} aria-hidden />
      <div className="city-road pointer-events-none absolute inset-x-0 bottom-0 h-[var(--road)]" aria-hidden>
        <div className="absolute inset-x-0 top-0 h-[34%] bg-[#d9d4c7]" />
        <div className={`absolute inset-x-0 bottom-0 top-[34%] ${dark ? "bg-[#2b2f36]" : "bg-[#4a4f57]"}`}>
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2" style={{ backgroundImage: "repeating-linear-gradient(90deg, #f4d35e 0 36px, transparent 36px 72px)" }} />
        </div>
      </div>

      {/* their garden, and the plot beside it */}
      <div className="absolute inset-x-0 bottom-[calc(var(--road)*0.62)] flex items-end justify-center gap-2 overflow-hidden px-2 sm:gap-6">
        {inviter && (
          <div className="hidden sm:block">
            <CityLot item={{ kind: "garden", garden: inviter }} phase={phase} interactive={false} />
          </div>
        )}
        {inviter && (
          <div className="hidden h-[calc(var(--lot-h)*0.62)] w-10 items-end sm:flex" aria-hidden>
            <LampPost lit={dark} />
          </div>
        )}
        <CityLot item={{ kind: "free", claim: "reserved", code, forYou: status === "open" }} phase={phase} interactive={false} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#07142a]/50 to-transparent" aria-hidden />
      <header className="absolute inset-x-0 top-0 z-10 flex flex-col items-center px-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-center sm:pt-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/85">Kairo City</p>
        <h1 className="font-display mt-1 max-w-2xl text-3xl leading-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.35)] sm:text-5xl" data-invite-title>
          {status === "claimed" ? "This plot has been claimed" : status === "mine" ? "This is the plot you saved" : `${who} saved you a plot`}
        </h1>
        <p className="mt-2 max-w-md text-sm font-medium text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.4)] sm:text-base">
          {status === "claimed"
            ? "Someone has already moved in. There are free plots all over the city."
            : status === "mine"
              ? "Send this page to the friend you saved it for. It's theirs to claim."
              : `It's right next to ${inviter ? `${who}'s Level ${inviter.level} garden` : "their garden"}. Build habits, and your garden grows beside theirs.`}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {status === "open" &&
            (signedIn ? (
              <Link href={claimHref} className="flex h-12 items-center rounded-full bg-[#ffd166] px-7 text-base font-bold text-[#3b2a00] shadow-xl transition-transform hover:-translate-y-0.5" data-claim-link>
                Claim your plot
              </Link>
            ) : (
              <a
                href={`/api/auth/google?next=${encodeURIComponent(claimHref)}`}
                data-track="invite-signin"
                className="flex h-12 items-center rounded-full bg-[#ffd166] px-7 text-base font-bold text-[#3b2a00] shadow-xl transition-transform hover:-translate-y-0.5"
                data-claim-link
              >
                Claim your plot, free
              </a>
            ))}
          <Link href="/?city=open" className="gd-hud flex h-12 items-center rounded-full px-6 text-sm font-bold text-white transition-transform hover:-translate-y-0.5">
            Walk around Kairo City
          </Link>
        </div>
      </header>
    </main>
  );
}
