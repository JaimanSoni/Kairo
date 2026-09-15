import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { visitGarden } from "@/lib/city";
import { GARDEN_LEVELS, utcToday } from "@/lib/habits-shared";
import { PublicGarden } from "@/components/garden/city/public-garden";
import { getSession } from "@/lib/session";

/**
 * A garden in Kairo City, shared by its owner. Open to anyone with the link,
 * and only ever a garden that joined the city: a hidden or unknown one is a
 * plain 404, with nothing to say whether it exists.
 */

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const garden = await visitGarden(null, id, utcToday());
  if (!garden) return { title: "Kairo City", robots: { index: false } };
  const title = `${garden.name}'s garden · Kairo City`;
  const description = `A Level ${garden.level} ${GARDEN_LEVELS[garden.level - 1].name}, grown by real habits. Can yours grow a better one?`;
  return {
    title,
    description,
    alternates: { canonical: `/g/${id}` },
    robots: { index: false, follow: true },
    openGraph: { title, description, type: "website", siteName: "Kairo", url: `/g/${id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedGardenPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  // seen by someone signed in, the garden knows whose it is and where the two of them stand
  const garden = await visitGarden(session ? new ObjectId(session.userId) : null, id, utcToday());
  if (!garden) notFound();
  return <PublicGarden garden={garden} signedIn={Boolean(session)} />;
}
