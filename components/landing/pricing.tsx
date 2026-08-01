import Link from "next/link";
import { listSellablePlans } from "@/lib/plans";
import { FEATURES, FEATURE_KEYS } from "@/lib/features";
import { TRIAL_DAYS } from "@/lib/access";

/**
 * The price, on the landing page.
 *
 * Reads the plans out of the database — the same rows the checkout charges
 * against — so a price edited in the admin changes here without a deploy, and
 * the headline figure can never drift from what someone is actually billed.
 */

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export async function Pricing({ signedIn }: { signedIn: boolean }) {
  const plans = await listSellablePlans();
  if (plans.length === 0) return null;

  const dearest = plans.reduce((a, b) => (b.priceMinor > a.priceMinor ? b : a));
  const cta = signedIn ? "/today" : "/api/auth/google";

  return (
    <section aria-label="Pricing" className="mx-auto max-w-4xl px-5 py-16 sm:py-20">
      <h2 className="font-display text-center text-4xl tracking-tight sm:text-5xl">
        Simple pricing. <em className="text-sun">No surprises.</em>
      </h2>
      <p className="mx-auto mt-3 max-w-md text-center text-[15px] leading-7 text-ink-soft">
        {TRIAL_DAYS} days free with everything unlocked, no card. Then pick what you need. Nothing
        renews by itself.
      </p>

      <div className={`mx-auto mt-10 grid gap-4 ${plans.length > 1 ? "sm:grid-cols-2" : "max-w-md"}`}>
        {plans.map((plan) => {
          const featured = plan.key === dearest.key && plans.length > 1;
          return (
            <div
              key={plan.key}
              className={`glass relative flex flex-col rounded-[1.75rem] p-7 shadow-lg shadow-ink/5 ${
                featured ? "ring-2 ring-sun" : ""
              }`}
            >
              {featured && (
                <span className="absolute -top-3 left-7 rounded-full bg-sun px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-accent">
                  Everything
                </span>
              )}
              <div className="text-sm font-semibold">{plan.name}</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-display text-5xl tracking-tight">
                  {money(plan.priceMinor, plan.currency)}
                </span>
                <span className="text-sm text-ink-soft">/ month</span>
              </div>
              {plan.tagline && (
                <p className="mt-2 text-[13px] leading-6 text-ink-soft">{plan.tagline}</p>
              )}

              <ul className="mt-5 flex-1 space-y-2">
                <li className="flex gap-2.5 text-sm leading-6 text-ink-soft">
                  <span className="text-moss" aria-hidden>
                    ✓
                  </span>
                  <span>Capture, Today, the morning reset, focus timer, calendar, sharing</span>
                </li>
                <li className="flex gap-2.5 text-sm leading-6 text-ink-soft">
                  <span className="text-moss" aria-hidden>
                    ✓
                  </span>
                  <span>Lock any list with a PIN</span>
                </li>
                {FEATURE_KEYS.map((key) => {
                  const on = plan.features.includes(key);
                  return (
                    <li
                      key={key}
                      className={`flex gap-2.5 text-sm leading-6 ${on ? "text-ink-soft" : "text-ink-faint"}`}
                    >
                      <span className={on ? "text-moss" : "text-ink-faint/70"} aria-hidden>
                        {on ? "✓" : ""}
                      </span>
                      <span className={on ? "" : "line-through decoration-ink-faint/40"}>
                        {FEATURES[key].name}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <a
                href={cta}
                className={`mt-6 block rounded-full px-6 py-3 text-center text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                  featured
                    ? "bg-sun text-on-accent shadow-xl shadow-sun/25"
                    : "border border-line bg-card text-ink hover:border-sun"
                }`}
              >
                {signedIn ? "Open Kairo →" : `Start ${TRIAL_DAYS} days free →`}
              </a>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-ink-faint">
        Card handled by Razorpay, it never touches Kairo. Refunded in full within 7 days, no reason
        needed.{" "}
        <Link href="/pricing" className="underline underline-offset-2 hover:text-ink-soft">
          Full pricing details
        </Link>
      </p>
    </section>
  );
}
