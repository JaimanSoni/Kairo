import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { GuestExperience } from "@/components/guest-mode";

/**
 * The front door opens into the product.
 *
 * Sixty visits and zero signups taught us that a landing page asking for
 * Google before showing anything converts nobody. Now "/" is the real Today
 * view running in guest mode: tasks live in localStorage, the invitation to
 * sign in arrives after the fifth task, and GuestSync carries everything into
 * the account. The marketing story lives on at /home.
 */

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  title: "Kairo, where good days grow",
  description:
    "Start right now, no account needed. Plan a day you'll actually finish, grow habits into a garden you can see, and walk around Kairo City. Sign in later and everything follows you.",
  openGraph: {
    title: "Kairo, where good days grow",
    description: "Plan the day, grow your habits into a garden, and walk Kairo City. Try it instantly, no sign-up.",
    type: "website",
    siteName: "Kairo",
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Kairo, where good days grow" }],
  },
};

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/today");

  const { auth_error } = await searchParams;
  return <GuestExperience authError={auth_error} />;
}
