import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { KINDS, POSTS, faqsOf, findPost, plain, readingMinutes } from "@/lib/blog/content";
import { SITE_URL } from "@/lib/site";
import { BlogBlockView } from "@/components/blog/prose";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

/** A closed URL space: unknown slugs 404 instead of soft-rendering junk. */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.metaTitle,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.metaTitle,
      description: post.description,
      type: "article",
      url: `/blog/${post.slug}`,
      publishedTime: post.published,
      modifiedTime: post.updated,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Kairo, where good days grow" }],
    },
  };
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) notFound();

  const kind = KINDS.find((k) => k.kind === post.kind);
  const related = post.related
    .map((s) => findPost(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const faqs = faqsOf(post);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    dateModified: post.updated,
    keywords: post.keywords.join(", "),
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    image: `${SITE_URL}/og.png`,
    author: { "@type": "Person", name: "Jaiman Soni", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Kairo",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.svg` },
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Kairo Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 2, name: post.title, item: `${SITE_URL}/blog/${post.slug}` },
    ],
  };

  // Built from the exact FAQ array the page renders, never a second copy.
  const faqLd =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: plain(f.a) },
          })),
        }
      : null;

  const ld = (data: object) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(articleLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(breadcrumbLd)} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={ld(faqLd)} />}

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5 sm:py-14">
        <article>
          <nav
            aria-label="Breadcrumb"
            className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint"
          >
            <Link href="/blog" className="hover:text-ink-soft">
              Blog
            </Link>
            <span aria-hidden>/</span>
            <span className="text-ink-soft">{kind?.name}</span>
          </nav>

          <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-base leading-7 text-ink-soft">{post.description}</p>
          <p className="mt-4 text-xs text-ink-faint">
            Updated <time dateTime={post.updated}>{DATE_FMT.format(new Date(post.updated))}</time>
            {" · "}
            {readingMinutes(post)} min read
          </p>

          {post.sections.length > 2 && (
            <details className="mt-6 rounded-2xl border border-line bg-card px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">On this page</summary>
              <ul className="mt-2 space-y-1.5">
                {post.sections.map((s) => (
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
            {post.sections.map((section) => (
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
                    <BlogBlockView key={i} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {related.length > 0 && (
            <div className="mt-12 border-t border-line pt-6">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Keep reading
              </h2>
              <ul className="grid gap-3 sm:grid-cols-3">
                {related.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/blog/${p.slug}`}
                      className="flex h-full flex-col rounded-2xl border border-line bg-card p-4 transition-colors hover:border-sun/60"
                    >
                      <span className="text-sm font-semibold leading-5">{p.title}</span>
                      <span className="mt-1.5 text-xs leading-5 text-ink-faint">
                        {readingMinutes(p)} min read
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </div>
    </>
  );
}
