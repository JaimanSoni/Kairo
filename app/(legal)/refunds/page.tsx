import type { Metadata } from "next";
import Link from "next/link";
import { B, H2, LI, Mail, P, PageHead, UL } from "../_parts";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy · Kairo",
  description: "How to cancel and how to get a refund from Kairo, a 7-day, no-argument policy.",
  alternates: { canonical: "/refunds" },
};

const UPDATED = "28 July 2026";

export default function RefundsPage() {
  return (
    <article>
      <PageHead title="Refund &amp; Cancellation Policy" updated={UPDATED} />

      <P>
        Kairo costs <B>₹299 for one month</B>, paid one month at a time. The short version: there
        is nothing to cancel, and if you want your money back within 7 days you can have it.
      </P>

      <H2>Cancelling</H2>
      <P>
        There is no subscription and no auto-renewal. A payment buys one month and then stops on
        its own, you are never charged again unless you choose to pay for another month. So there
        is no cancellation step, and no way to be billed by forgetting about us.
      </P>
      <P>
        Your <B>3-day free trial</B> needs no card and ends by itself. Nothing is taken when it
        does.
      </P>

      <H2>Refunds</H2>
      <UL>
        <LI>
          <B>Within 7 days of a payment,</B> email <Mail /> and we will refund it in full. You do
          not need to give a reason.
        </LI>
        <LI>
          <B>After 7 days,</B> that month is generally not refundable, you have had the use of
          it. If something went genuinely wrong at our end, tell us and we will make it right.
        </LI>
        <LI>
          <B>If Kairo was unusable</B> because of a fault on our side, we will refund that month
          regardless of when you tell us.
        </LI>
        <LI>
          <B>Charged by mistake?</B> Tell us and we will return it, whenever you noticed.
        </LI>
      </UL>

      <H2>How to ask</H2>
      <P>
        Email <Mail /> from the address on your Kairo account, and say roughly when you paid. No
        form to fill in.
      </P>

      <H2>How long it takes</H2>
      <P>
        We start refunds within <B>2 working days</B> of agreeing to one. Once sent, the money
        goes back to the original payment method via Razorpay, which typically takes{" "}
        <B>5 to 7 working days</B> to appear depending on your bank. We cannot make your bank
        faster, but we can tell you the day it left.
      </P>

      <H2>Your data after a refund</H2>
      <P>
        Refunding does not delete anything. Your tasks stay exactly where they are, and you keep
        access until the month you paid for runs out. If you want the account removed as well, say
        so in the same email, see the{" "}
        <Link href="/privacy" className="font-medium text-sun-deep underline decoration-sun/40 underline-offset-2">Privacy Policy</Link>.
      </P>

      <H2>Contact</H2>
      <P>
        Refunds and billing questions: <Mail />. Kairo is operated by Jaiman Soni.
      </P>
    </article>
  );
}
