import type { Metadata } from "next";
import Link from "next/link";
import { PRICE_LABEL } from "@/lib/razorpay";
import { TRIAL_DAYS } from "@/lib/access";
import { B, H2, LI, Mail, P, PageHead, UL } from "../_parts";

export const metadata: Metadata = {
  title: "Pricing · Kairo",
  description: "Kairo costs ₹299 a month, paid a month at a time, after a 3-day free trial. No auto-renewal.",
  alternates: { canonical: "/pricing" },
};

/** Everything the paid product includes — one list, no tiers to compare. */
const INCLUDED = [
  "Voice and typed capture, with AI filling in the day, time, list and steps",
  "A bounded Today, with an honest capacity line",
  "The morning reset — yesterday's leftovers, one decision each, never turning red",
  "Focus timer with reminders that arrive even when the app is closed",
  "Recurring tasks, deadlines, and steps you can plan onto their own days",
  "Week and month calendar views, colour-coded per list",
  "Shared lists, task assignment, and sending a task to someone",
  "PIN locks per list or across the whole app",
  "Multiple accounts, light and dark, installs to your home screen",
];

export default function PricingPage() {
  return (
    <article>
      <PageHead title="Pricing" updated="28 July 2026" />

      <P>
        One price, everything included. No tiers, no per-seat maths, and nothing held back to sell
        you later.
      </P>

      <div className="mt-8 rounded-2xl border border-line bg-card p-6">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-4xl tracking-tight">{PRICE_LABEL}</span>
          <span className="text-sm text-ink-soft">per month</span>
        </div>
        <p className="mt-2 text-[15px] leading-7 text-ink-soft">
          Free for the first <B>{TRIAL_DAYS} days</B> — no card needed. After that it is{" "}
          {PRICE_LABEL} for a month, <B>charged one month at a time</B>. It does not renew by
          itself, so you are never billed for a month you forgot you were paying for.
        </p>
        <Link
          href="/today"
          className="mt-5 inline-flex rounded-full bg-sun px-6 py-3 text-sm font-semibold text-on-accent shadow-lg shadow-sun/25 transition-transform active:scale-[0.99]"
        >
          Start free
        </Link>
      </div>

      <H2>What you get</H2>
      <UL>
        {INCLUDED.map((line) => (
          <LI key={line}>{line}</LI>
        ))}
      </UL>

      <H2>How paying works</H2>
      <UL>
        <LI>
          Payment goes through <B>Razorpay</B>. Card details are entered there and never reach
          Kairo.
        </LI>
        <LI>
          Paying twice stacks rather than overlaps — a second month is added to the end of the
          first, so nothing is wasted.
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
        <Link href="/refunds" className="font-medium text-sun-deep underline decoration-sun/40 underline-offset-2">
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
