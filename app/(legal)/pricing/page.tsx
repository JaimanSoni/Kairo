import type { Metadata } from "next";
import Link from "next/link";
import { listSellablePlans } from "@/lib/plans";
import { FEATURES, FEATURE_KEYS } from "@/lib/features";
import { TRIAL_DAYS } from "@/lib/access";
import { B, H2, LI, Mail, P, PageHead, UL } from "../_parts";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const plans = await listSellablePlans();
  const cheapest = plans[0];
  return {
    title: "Pricing · Kairo",
    description: cheapest
      ? `Kairo starts at ${money(cheapest.priceMinor, cheapest.currency)} a month, paid a month at a time, after a ${TRIAL_DAYS}-day free trial. No auto-renewal.`
      : "Kairo pricing.",
    alternates: { canonical: "/pricing" },
  };
}

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

/** On every plan, so it belongs above the comparison rather than inside it. */
const ALWAYS_INCLUDED = [
  "Voice and typed capture, with the day, time, estimate and list parsed from what you wrote",
  "A bounded Today, with an honest capacity line",
  "The morning reset, yesterday's leftovers, one decision each, never turning red",
  "Focus timer, with reminders that arrive even when the app is closed",
  "Recurring tasks, deadlines, and steps you can plan onto their own days",
  "Week and month calendar views, colour-coded per list",
  "Shared lists, task assignment, and sending a task to someone",
  "A PIN lock on any individual list",
  "Light and dark, and it installs to your home screen",
];

export default async function PricingPage() {
  const plans = await listSellablePlans();

  return (
    <article>
      <PageHead title="Pricing" updated="30 July 2026" />

      <P>
        Free for the first <B>{TRIAL_DAYS} days</B> with everything unlocked, and no card asked for.
        After that, pick the plan that fits. Every plan is <B>charged one month at a time</B> it
        does not renew by itself, so you are never billed for a month you forgot you were paying
        for.
      </P>

      {plans.length === 0 ? (
        <P>No plans are on sale right now. Please check back shortly.</P>
      ) : (
        <div className={`mt-8 grid gap-4 ${plans.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {plans.map((plan) => (
            <div key={plan.key} className="rounded-2xl border border-line bg-card p-6">
              <div className="text-sm font-semibold">{plan.name}</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                {plan.anchorMinor && (
                  <span className="text-lg font-medium text-ink-faint line-through decoration-ink-faint/60">
                    {money(plan.anchorMinor, plan.currency)}
                  </span>
                )}
                <span className="font-display text-4xl tracking-tight">
                  {money(plan.priceMinor, plan.currency)}
                </span>
                <span className="text-sm text-ink-soft">per month</span>
              </div>
              {plan.tagline && (
                <p className="mt-2 text-[15px] leading-7 text-ink-soft">{plan.tagline}</p>
              )}
              <ul className="mt-4 space-y-1.5">
                {FEATURE_KEYS.map((key) => {
                  const on = plan.features.includes(key);
                  return (
                    <li key={key} className="flex gap-2 text-sm leading-6">
                      <span className={on ? "text-moss" : "text-ink-faint"} aria-hidden>
                        {on ? "✓" : ""}
                      </span>
                      <span className={on ? "text-ink-soft" : "text-ink-faint"}>
                        {FEATURES[key].name}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Link
          href="/today"
          className="inline-flex rounded-full bg-sun px-6 py-3 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99]"
        >
          Start free
        </Link>
      </div>

      <H2>On every plan</H2>
      <UL>
        {ALWAYS_INCLUDED.map((line) => (
          <LI key={line}>{line}</LI>
        ))}
      </UL>

      <H2>What differs</H2>
      <UL>
        {FEATURE_KEYS.map((key) => (
          <LI key={key}>
            <B>{FEATURES[key].name}.</B> {FEATURES[key].description}
          </LI>
        ))}
      </UL>

      <H2>How paying works</H2>
      <UL>
        <LI>
          Payment goes through <B>Razorpay</B>. Card details are entered there and never reach
          Kairo.
        </LI>
        <LI>
          Paying twice stacks rather than overlaps, a second month is added to the end of the
          first, so nothing is wasted.
        </LI>
        <LI>
          Moving to a dearer plan takes effect on the payment, and the month you buy runs from the
          end of the one you already have.
        </LI>
        <LI>
          Everything you have written stays yours whether you pay or not. Access ends; your data
          does not disappear.
        </LI>
      </UL>

      <H2>Refunds</H2>
      <P>
        Ask within 7 days of a payment and you get it back in full, no reason needed. The details
        are on the{" "}
        <Link
          href="/refunds"
          className="font-medium text-sun-deep underline decoration-sun/40 underline-offset-2"
        >
          Refund Policy
        </Link>
        .
      </P>

      <H2>Questions</H2>
      <P>
        Anything at all: <Mail />.
      </P>
    </article>
  );
}
