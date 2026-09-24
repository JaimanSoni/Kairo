import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CITY_SHOWN } from "@/lib/types";
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
  title: "Kairo. Your whole day, in bloom",
  description:
    CITY_SHOWN
      ? "Start right now, no account needed. Plan a day you'll actually finish, grow habits into a garden you can see, and walk around Kairo City. Sign in later and everything follows you."
      : "Start right now, no account needed. Plan a day you'll actually finish, grow habits into a garden you can see, and keep notes for everything else. Sign in later and everything follows you.",
  openGraph: {
    title: "Kairo. Your whole day, in bloom",
    description: CITY_SHOWN ? "Plan the day, grow your habits into a garden, and walk Kairo City. Try it instantly, no sign-up." : "Plan the day, grow your habits into a garden, and keep notes. Try it instantly, no sign-up.",
    type: "website",
    siteName: "Kairo",
    url: "/",
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
