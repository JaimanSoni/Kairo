import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "kairo_session";
const PROTECTED = ["/today", "/calendar", "/lists", "/log", "/journal", "/notes", "/habits", "/settings", "/admin", "/billing", "/upgrade"];

/** Callers that are never a browser page of ours, and carry their own proof: a signature, a secret, a bearer key. */
const CROSS_SITE_OK = [/^\/api\/billing\/webhook\/?$/, /^\/api\/cron\//, /^\/api\/mcp\/?$/, /^\/mcp\/?$/];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * Changes to anything only come from Kairo's own pages. The session cookie
   * is SameSite=Lax, which stops other sites — but not a sibling subdomain,
   * which counts as the same site. Browsers say where a request came from in
   * Sec-Fetch-Site; anything but our own origin (or the user typing the URL)
   * is turned away before a route runs. Tools without a browser don't send
   * the header, and don't carry anyone's cookie either.
   */
  if ((pathname.startsWith("/api/") || pathname === "/mcp") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none" && !CROSS_SITE_OK.some((re) => re.test(pathname))) {
      return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });
    }
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/") || pathname === "/mcp") return NextResponse.next();

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // Every redirect carries the query string with it: attribution arrives as
  // ?utm_... on whatever URL got shared, and a bare-URL bounce was silently
  // stripping it before the tracker ever ran.
  const to = (path: string) => {
    const url = new URL(path, request.url);
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  };

  // Optimistic check only — real verification happens server-side per request.
  if (PROTECTED.some((p) => pathname.startsWith(p)) && !hasSession) {
    return to("/");
  }

  // Never bounce someone who was sent here to READ something: an auth error
  // page that redirects away is how a stale cookie becomes a redirect loop.
  if (pathname === "/" && hasSession && !request.nextUrl.searchParams.has("auth_error")) {
    return to("/today");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/today/:path*",
    "/calendar/:path*",
    "/lists/:path*",
    "/log/:path*",
    "/journal/:path*",
    "/notes/:path*",
    "/habits/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/billing/:path*",
    "/upgrade/:path*",
    "/api/:path*",
    "/mcp",
  ],
};
