import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { inviteInfo } from "@/lib/city";
import { getSession } from "@/lib/session";
import { utcToday } from "@/lib/habits-shared";
import { InviteLanding } from "@/components/garden/city/invite-landing";

/**
 * A plot in Kairo City, saved by a friend for whoever has this link. Anyone
 * can open it; claiming it needs signing in, which comes straight back to
 * the claim. An unknown code is a plain 404.
 */

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const info = await inviteInfo(null, code, utcToday());
  if (!info) return { title: "Kairo City", robots: { index: false } };
  const who = info.inviterName ?? "A friend";
  const title = `${who} saved you a plot in Kairo City`;
  const description = "It's right next to their garden. Build habits, and your garden grows beside theirs.";
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: "Kairo", url: `/i/${code}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function InvitePage({ params }: Props) {
  const { code } = await params;
  const session = await getSession();
  const info = await inviteInfo(session ? new ObjectId(session.userId) : null, code, utcToday());
  if (!info) notFound();
  return <InviteLanding code={code} status={info.status} inviter={info.inviter} inviterName={info.inviterName} signedIn={Boolean(session)} />;
}
