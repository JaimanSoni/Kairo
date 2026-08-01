import type { Metadata } from "next";
import Link from "next/link";
import { B, H2, LI, Mail, P, PageHead, UL } from "../_parts";

export const metadata: Metadata = {
  title: "Privacy Policy · Kairo",
  description:
    "What Kairo stores, who it is shared with, and how to get it deleted. Written to match what the app actually does.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "31 July 2026";

export default function PrivacyPage() {
  return (
    <article>
      <PageHead title="Privacy Policy" updated={UPDATED} />

      <P>
        Kairo is a personal planner, so almost everything in it is something you wrote down. This
        page says exactly what is stored, what leaves our servers, and how to get rid of it. It
        describes what the software actually does, not what a template says it might.
      </P>

      <H2>What is stored</H2>
      <UL>
        <LI>
          <B>Your account.</B> Kairo only signs you in with Google. From that we keep your Google
          account id, email address, name, and profile picture URL. We never see or store your
          Google password.
        </LI>
        <LI>
          <B>Your content.</B> Tasks, notes, steps, lists, planned days and times, estimates,
          reminders, and which tasks you have finished or started.
        </LI>
        <LI>
          <B>Notification subscriptions.</B> If you turn on reminders, your browser&apos;s push
          endpoint and its encryption keys, so a notification can reach that device.
        </LI>
        <LI>
          <B>Billing state.</B> Whether you are on a trial, what you have paid for, and the
          Razorpay identifiers for those payments. <B>Card details never reach Kairo</B> they are
          entered on Razorpay&apos;s checkout and we never receive them.
        </LI>
        <LI>
          <B>PIN locks.</B> If you lock a list or the app, only a salted hash of the PIN is stored.
          The PIN itself is never written down and cannot be recovered from the hash.
        </LI>
      </UL>
      <P>
        All of this lives in a MongoDB Atlas database. Kairo is hosted on Vercel, which processes
        requests on our behalf.
      </P>

      <H2>What leaves our servers</H2>
      <P>
        Five third parties are involved, and only these five. None of them is paid for your data,
        and none of it is sold or used for advertising.
      </P>
      <UL>
        <LI>
          <B>Google</B> sign-in only. We receive your profile from Google; we send nothing back.
        </LI>
        <LI>
          <B>Ollama</B> (AI capture), when you capture a task, the sentence you typed or spoke
          (up to 2,000 characters), today&apos;s date, and the names of your{" "}
          <B>unlocked</B> lists are sent, so the day, time, estimate and list can be filled in.
          Nothing else goes with it: not your email, not your other tasks, not your notes. The
          names of locked lists are never included. If it fails or is switched off, Kairo falls
          back to parsing the sentence on its own.
        </LI>
        <LI>
          <B>Razorpay</B> payments. They receive your name and email to attach to the payment,
          and handle the card themselves.
        </LI>
        <LI>
          <B>Google Analytics</B> anonymous traffic measurement: which public pages are visited,
          roughly where from, and on what kind of device. It does not receive your tasks, your
          email, or anything you type. Most tracker-blocking extensions stop it, and Kairo works
          exactly the same without it.
        </LI>
        <LI>
          <B>Microsoft Clarity</B> anonymous analytics and session replay, used to see where the
          interface confuses people. It records how you move around the app, <B>which can include
          the text of tasks visible on screen</B>. It is disabled entirely on the admin pages. If
          you would rather not be recorded, most tracker-blocking extensions stop it, and we will
          honour a request to exclude you, just ask.
        </LI>
      </UL>

      <H2>What we do not do</H2>
      <UL>
        <LI>We do not sell or rent your data to anyone.</LI>
        <LI>We do not show ads, and we do not build advertising profiles.</LI>
        <LI>We do not read your tasks except where you have asked for support and shown us them.</LI>
        <LI>We do not email you marketing. Emails are limited to what you asked for.</LI>
      </UL>

      <H2>Sharing you choose</H2>
      <P>
        When you share a list, the people you invite by email can see and edit the tasks in{" "}
        <B>that list</B> and see your name and picture on it. They cannot see your other lists,
        your Today, or anything locked. Locked lists stay hidden from every view, including
        search, the calendar, and the AI, until unlocked on that device.
      </P>

      <H2>How long it is kept</H2>
      <P>
        Your content is kept until you delete it or ask for your account to be removed. Deleting a
        task removes it. Asking us to close your account removes the account and everything in it,
        normally within 7 days. Payment records are kept longer where tax and accounting rules
        require it.
      </P>

      <H2>Your choices</H2>
      <UL>
        <LI>
          <B>Get a copy, or have it deleted.</B> Email <Mail /> from your account address and we
          will send an export or delete everything.
        </LI>
        <LI>
          <B>Turn off reminders</B> in Settings, which deletes that device&apos;s push subscription.
        </LI>
        <LI>
          <B>Lock what is sensitive</B> with a PIN, per list or across the whole app.
        </LI>
      </UL>

      <H2>Children</H2>
      <P>Kairo is not intended for children under 13, and we do not knowingly collect their data.</P>

      <H2>Changes</H2>
      <P>
        If this policy changes in a way that affects what we collect or who receives it, the date
        at the top changes and the change is described here. Continuing to use Kairo after that
        means the updated policy applies.
      </P>

      <H2>Contact</H2>
      <P>
        Kairo is operated by Jaiman Soni. For anything about your data, privacy, or this policy,
        email <Mail />. See also our <Link href="/terms" className="font-medium text-sun-deep underline decoration-sun/40 underline-offset-2">Terms</Link> and{" "}
        <Link href="/refunds" className="font-medium text-sun-deep underline decoration-sun/40 underline-offset-2">Refund Policy</Link>.
      </P>
    </article>
  );
}
