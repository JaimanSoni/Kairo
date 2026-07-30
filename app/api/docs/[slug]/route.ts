import { ARTICLES } from "@/lib/support/content";
import { articleToMarkdownFile } from "@/lib/support/markdown";
import { SITE_URL } from "@/lib/site";

/**
 * The Markdown mirror of a help article, served at `/support/<slug>.md` by the
 * rewrite in next.config.ts. This path is the rewrite target, not the address
 * anyone links to.
 *
 * A `rel="canonical"` header points at the HTML page: the two say the same
 * thing, and without it a search engine has to guess which is the original.
 * Language models get the plain text; Google keeps indexing the page.
 */

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export const dynamicParams = false;

export async function GET(_request: Request, ctx: RouteContext<"/api/docs/[slug]">) {
  const { slug } = await ctx.params;
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) {
    return new Response("Not found\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(articleToMarkdownFile(article), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Link: `<${SITE_URL}/support/${article.slug}>; rel="canonical"`,
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
