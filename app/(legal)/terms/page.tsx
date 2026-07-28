import type { Metadata } from "next";
import Link from "next/link";
import { B, H2, LI, Mail, P, PageHead, UL } from "../_parts";

export const metadata: Metadata = {
  title: "Terms of Service · Kairo",
  description: "The agreement between you and Kairo: what you get, what it costs, and what is expected.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "28 July 2026";

export default function TermsPage() {
  return (
    <article>
      <PageHead title="Terms of Service" updated={UPDATED} />

      <P>
        These terms cover your use of Kairo, a daily planner available at kairo.jaimansoni.com and
        operated by Jaiman Soni (&ldquo;we&rdquo;, &ldquo;us&rdquo;). Using Kairo means you accept
        them. They are written to be read, not to be impressive.
      </P>

      <H2>Your account</H2>
      <UL>
        <LI>You sign in with Google. You are responsible for keeping that Google account secure.</LI>
        <LI>One person per account. You must be 13 or older.</LI>
        <LI>
          You may set a numeric PIN to lock lists or the whole app. That PIN cannot be recovered if
          you forget it — it is stored only as a hash.
        </LI>
      </UL>

      <H2>What you pay</H2>
      <UL>
        <LI>
          Kairo is free for <B>3 days</B> from the day you sign up. No card is needed to start.
        </LI>
        <LI>
          After that, access costs <B>₹299 per month</B>, charged as a single payment for one
          month. <B>It does not renew automatically</B> — nothing is taken from you again unless
          you choose to pay for another month.
        </LI>
        <LI>
          Payments are handled by Razorpay. We never receive or store your card details.
        </LI>
        <LI>
          Prices can change, but never for a month you have already paid for. We will say so
          clearly before a change applies to you.
        </LI>
        <LI>
          We may give free access to individual accounts at our discretion. That is a gift, not an
          entitlement, and can be withdrawn with notice.
        </LI>
      </UL>
      <P>
        See <Link href="/pricing" className="font-medium text-sun-deep underline decoration-sun/40 underline-offset-2">Pricing</Link> for
        what is included, and{" "}
        <Link href="/refunds" className="font-medium text-sun-deep underline decoration-sun/40 underline-offset-2">Refunds</Link> for
        how to get your money back.
      </P>

      <H2>Your content is yours</H2>
      <P>
        Everything you put into Kairo belongs to you. We claim no ownership of it. We store and
        display it so the service can work, and so people you deliberately share a list with can
        see that list. We do not sell it, publish it, or use it to train anything. See the{" "}
        <Link href="/privacy" className="font-medium text-sun-deep underline decoration-sun/40 underline-offset-2">Privacy Policy</Link> for
        the detail.
      </P>

      <H2>Fair use</H2>
      <P>Please do not:</P>
      <UL>
        <LI>Use Kairo to store or share anything unlawful, or to harass anyone you share a list with.</LI>
        <LI>Try to break, overload, or gain unauthorised access to the service or other accounts.</LI>
        <LI>Resell Kairo or pass one account around a team — share a list instead.</LI>
        <LI>Automate use in a way that puts unreasonable load on the service.</LI>
      </UL>
      <P>
        We may suspend an account that does these things. Where it is safe and fair to do so, we
        will tell you why first.
      </P>

      <H2>Availability</H2>
      <P>
        Kairo is a small, independently run product. We work to keep it up and your data safe, but
        we do not promise uninterrupted service, and features may change or be withdrawn. If we
        ever shut Kairo down, we will give reasonable notice and a way to export your data.
      </P>

      <H2>Liability</H2>
      <P>
        Kairo is provided as-is. To the extent the law allows, we are not liable for indirect or
        consequential loss — including anything you forgot, missed, or failed to do. It is a
        planner, not a guarantee. Where liability cannot be excluded, it is limited to the amount
        you paid us in the 12 months before the claim.
      </P>

      <H2>Ending it</H2>
      <P>
        You can stop using Kairo whenever you like and ask us to delete your account by emailing{" "}
        <Mail />. Because payment is one month at a time, there is no subscription to cancel. We
        may end an account for a serious or repeated breach of these terms.
      </P>

      <H2>Governing law</H2>
      <P>
        These terms are governed by the laws of India, and the courts of India have exclusive
        jurisdiction over any dispute.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about these terms: <Mail />.
      </P>
    </article>
  );
}
