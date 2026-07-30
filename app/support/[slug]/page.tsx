import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ARTICLES, CATEGORIES } from "@/lib/support/content";
import { BlockView } from "@/components/support/prose";
import { Toc } from "@/components/support/toc";
import { SupportSidebar } from "@/components/support/sidebar";
import { Feedback } from "@/components/support/feedback";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) return { title: "Not found" };
  return {
    title: article.title,
    description: article.summary,
    keywords: article.keywords,
    alternates: {
      canonical: `/support/${article.slug}`,
      // advertises the plain-text twin, so an agent reading the page can fetch
      // the markdown instead of scraping the HTML
      types: { "text/markdown": `/support/${article.slug}.md` },
    },
    openGraph: {
      title: `${article.title} · Kairo Help`,
      description: article.summary,
      type: "article",
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();

  const category = CATEGORIES.find((c) => c.id === article.categoryId);
  const index = ARTICLES.findIndex((a) => a.slug === article.slug);
  const prev = ARTICLES[index - 1];
  const next = ARTICLES[index + 1];
  const related = ARTICLES.filter(
    (a) => a.categoryId === article.categoryId && a.slug !== article.slug
  ).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: article.title,
    description: article.summary,
    articleSection: category?.name,
    keywords: article.keywords.join(", "),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 sm:py-12">
        <div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_12rem]">
          {/* category nav */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">
              <SupportSidebar />
            </div>
          </aside>

          <article className="min-w-0 max-w-2xl">
            <nav
              aria-label="Breadcrumb"
              className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint"
            >
              <Link href="/support" className="hover:text-ink-soft">
                Help
              </Link>
              <span aria-hidden>/</span>
              <span className="text-ink-soft">{category?.name}</span>
            </nav>

            <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              {article.title}
            </h1>
            <p className="mt-3 text-base leading-7 text-ink-soft">{article.summary}</p>

            {/* compact contents for narrow screens */}
            {article.sections.length > 2 && (
              <details className="mt-6 rounded-2xl border border-line bg-card px-4 py-3 xl:hidden">
                <summary className="cursor-pointer text-sm font-medium">On this page</summary>
                <ul className="mt-2 space-y-1.5">
                  {article.sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="text-[13px] text-ink-soft hover:text-sun-deep">
                        {s.heading}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mt-10 space-y-12">
              {article.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="mb-4 text-lg font-semibold tracking-tight">
                    <a href={`#${section.id}`} className="group inline-flex items-baseline gap-2">
                      {section.heading}
                      <span
                        className="text-sm text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      >
                        #
                      </span>
                    </a>
                  </h2>
                  <div className="space-y-4">
                    {section.blocks.map((block, i) => (
                      <BlockView key={i} block={block} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <Feedback slug={article.slug} title={article.title} />

            {related.length > 0 && (
              <div className="mt-10 border-t border-line pt-6">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  Related
                </h2>
                <ul className="space-y-1.5">
                  {related.map((a) => (
                    <li key={a.slug}>
                      <Link
                        href={`/support/${a.slug}`}
                        className="text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-sun-deep hover:decoration-sun/50"
                      >
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row">
              {prev && (
                <Link
                  href={`/support/${prev.slug}`}
                  className="min-w-0 flex-1 rounded-xl border border-line bg-card px-4 py-3 transition-colors hover:border-ink-faint/60"
                >
                  <span className="block text-[10px] uppercase tracking-wide text-ink-faint">
                    ← Previous
                  </span>
                  <span className="block truncate text-sm font-medium">{prev.title}</span>
                </Link>
              )}
              {next && (
                <Link
                  href={`/support/${next.slug}`}
                  className="min-w-0 flex-1 rounded-xl border border-line bg-card px-4 py-3 transition-colors hover:border-ink-faint/60 sm:text-right"
                >
                  <span className="block text-[10px] uppercase tracking-wide text-ink-faint">
                    Next →
                  </span>
                  <span className="block truncate text-sm font-medium">{next.title}</span>
                </Link>
              )}
            </div>
          </article>

          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <Toc sections={article.sections} />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
