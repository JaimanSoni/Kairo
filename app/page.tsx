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
  title: "Kairo, a daily planner that forgives",
  description:
    "Start planning right now, no account needed. Type your day in one messy sentence, pick the 3 things that matter, and win the day. Sign in later and your tasks follow you.",
  openGraph: {
    title: "Kairo, a daily planner that forgives",
    description: "Try it instantly, no sign-up. Your to-do list shouldn't make you feel bad.",
    type: "website",
    siteName: "Kairo",
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Kairo, a daily planner that forgives" }],
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
