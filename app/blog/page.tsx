import Link from "next/link";
import type { Metadata } from "next";
import { KINDS, POSTS, postsOf, readingMinutes, BLOG_UPDATED } from "@/lib/blog/content";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Kairo Blog: Planning Guides and Honest Comparisons",
  description:
    "Daily planning methods, deep work templates, and honest comparisons of AI planners like Motion, Sunsama, and Akiflow, from the team behind Kairo.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Kairo Blog: Planning Guides and Honest Comparisons",
    description:
      "Daily planning methods, deep work templates, and honest comparisons of AI planners.",
    type: "website",
    url: "/blog",
    images: [{ url: "/og-bloom.png", width: 1200, height: 630, alt: "Kairo. Your whole day, in bloom" }],
  },
};

export default function BlogIndex() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Kairo Blog",
    description:
      "Daily planning guides and honest comparisons of AI planners, from the team behind Kairo.",
    url: `${SITE_URL}/blog`,
    dateModified: BLOG_UPDATED,
    isPartOf: { "@type": "WebSite", name: "Kairo", url: SITE_URL },
    hasPart: POSTS.map((p) => ({
      "@type": "Article",
      headline: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-14">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
            Plan days you can actually finish
          </h1>
          <p className="mt-3 text-base leading-7 text-ink-soft">
            Planning methods that work with or without our app, and comparisons that tell you
            honestly when the other tool is the better pick. No listicle padding, no fake reviews.
          </p>
        </div>

        <div className="mt-12 space-y-14">
          {KINDS.map((k) => {
            const posts = postsOf(k.kind);
            return (
              <section key={k.kind} aria-labelledby={`kind-${k.kind}`}>
                <h2 id={`kind-${k.kind}`} className="font-display text-2xl tracking-tight">
                  {k.name}
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-ink-soft">{k.description}</p>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {posts.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/blog/${p.slug}`}
                        className="flex h-full flex-col rounded-2xl border border-line bg-card p-5 transition-colors hover:border-sun/60"
                      >
                        <span className="text-[15px] font-semibold leading-6">{p.title}</span>
                        <span className="mt-2 flex-1 text-[13px] leading-6 text-ink-soft">
                          {p.description}
                        </span>
                        <span className="mt-3 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                          {readingMinutes(p)} min read
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
