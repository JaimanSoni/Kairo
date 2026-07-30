import Link from "next/link";
import { PRICE_LABEL } from "@/lib/razorpay";
import { TRIAL_DAYS } from "@/lib/access";

/**
 * The price, on the landing page.
 *
 * Reads the same constants that charge the card and gate the app, so the
 * headline figure cannot drift from what someone is actually billed. One plan,
 * so there is nothing to compare — the job here is to answer "what does it cost
 * and what happens after the trial" without making anyone open another page.
 */

/** The three things people actually worry about before starting a trial. */
const REASSURANCES = [
  { icon: "✓", text: `${TRIAL_DAYS} days free, no card asked for.` },
  { icon: "↻", text: "Doesn't auto-renew. Pay again only if you want to." },
  { icon: "↩", text: "Refunded in full within 7 days, no reason needed." },
];

export function Pricing({ signedIn }: { signedIn: boolean }) {
  return (
    <section aria-label="Pricing" className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <h2 className="font-display text-center text-4xl tracking-tight sm:text-5xl">
        One price. <em className="text-sun">No surprises.</em>
      </h2>
      <p className="mx-auto mt-3 max-w-md text-center text-[15px] leading-7 text-ink-soft">
        Every feature, for everyone. No tiers, no per-seat maths, nothing held back to sell you
        later.
      </p>

      <div className="glass mx-auto mt-10 max-w-lg rounded-[2rem] p-8 text-center shadow-lg shadow-ink/5 sm:p-10">
        <div className="flex items-baseline justify-center gap-1.5">
          <span className="font-display text-6xl tracking-tight">{PRICE_LABEL}</span>
          <span className="text-base text-ink-soft">/ month</span>
        </div>
        <p className="mt-3 text-[15px] leading-7 text-ink-soft">
          Free for {TRIAL_DAYS} days, then {PRICE_LABEL} for a month — charged{" "}
          <b className="font-semibold text-ink">one month at a time</b>.
        </p>

        <ul className="mx-auto mt-7 max-w-sm space-y-3 text-left">
          {REASSURANCES.map((r) => (
            <li key={r.text} className="flex gap-3 text-sm leading-6 text-ink-soft">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sun-soft text-[11px] font-bold text-sun-deep" aria-hidden>
                {r.icon}
              </span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>

        {signedIn ? (
          <Link
            href="/today"
            className="mt-8 inline-flex rounded-full bg-sun px-8 py-3.5 text-base font-semibold text-on-accent shadow-xl shadow-sun/25 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-sun/30 active:translate-y-0"
          >
            Open Kairo →
          </Link>
        ) : (
          <a
            href="/api/auth/google"
            className="mt-8 inline-flex rounded-full bg-sun px-8 py-3.5 text-base font-semibold text-on-accent shadow-xl shadow-sun/25 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-sun/30 active:translate-y-0"
          >
            Start {TRIAL_DAYS} days free →
          </a>
        )}

        <p className="mt-4 text-xs text-ink-faint">
          Card handled by Razorpay — it never touches Kairo.{" "}
          <Link href="/pricing" className="underline underline-offset-2 hover:text-ink-soft">
            Full pricing details
          </Link>
        </p>
      </div>
    </section>
  );
}
