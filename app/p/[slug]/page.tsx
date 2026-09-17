import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicNote } from "@/lib/notes";
import { coverCss } from "@/lib/notes-shared";
import { docToText, previewOf } from "@/lib/doc-model";
import { ReadOnlyDoc } from "@/components/notes/read-only";
import { PageIcon } from "@/components/notes/pickers";
import { Mark } from "@/components/mark";
import { SITE_NAME } from "@/lib/site";

/**
 * A page someone published, for anyone with the link.
 *
 * Read-only, and only ever the one page: no sub-pages, no tree, nothing about
 * the account behind it. An address nobody can guess, and search engines are
 * asked to leave it alone — a link shared with three people should not turn up
 * in a search for someone's name.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await publicNote(slug);
  if (!page) return { title: SITE_NAME, robots: { index: false, follow: false } };
  const title = page.title || "Untitled";
  const description = previewOf(docToText(page.doc), 160) || `A page shared from ${SITE_NAME}.`;
  return {
    title: `${title} · ${SITE_NAME}`,
    description,
    alternates: { canonical: `/p/${slug}` },
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "article", siteName: SITE_NAME, url: `/p/${slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedNotePage({ params }: Props) {
  const { slug } = await params;
  const page = await publicNote(slug);
  if (!page) notFound();
  const cover = coverCss(page.cover);
  const edited = new Date(page.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className={`min-h-dvh bg-paper ${page.smallText ? "nt-small" : ""} ${page.font === "serif" ? "nt-font-serif" : page.font === "mono" ? "nt-font-mono" : ""}`} data-public-note>
      {cover && <div className="h-40 w-full sm:h-56" style={{ background: cover }} aria-hidden />}
      <article className={`mx-auto w-full px-5 pb-24 sm:px-8 ${page.fullWidth ? "max-w-5xl" : "max-w-3xl"} ${cover ? "-mt-10" : "pt-14"}`}>
        {page.icon && (
          <div className="mb-3">
            <PageIcon icon={page.icon} size={52} />
          </div>
        )}
        <h1 className="nt-title font-display text-4xl leading-tight sm:text-5xl">{page.title || "Untitled"}</h1>
        <p className="mt-2 text-xs text-ink-faint">
          {page.words} {page.words === 1 ? "word" : "words"} · Last edited {edited}
        </p>
        <div className="mt-8">
          <ReadOnlyDoc doc={page.doc} />
        </div>
      </article>

      <footer className="border-t border-line/60 px-5 py-8 text-center">
        <p className="text-xs text-ink-faint">Shared from Kairo. Only this page, and only to read.</p>
        <Link href="/home" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-sun-deep hover:underline">
          <Mark size={13} className="text-sun" /> Write your own pages in Kairo
        </Link>
      </footer>
    </main>
  );
}
