import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "kairo_session";
const PROTECTED = ["/today", "/calendar", "/lists", "/log", "/admin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
    "/admin/:path*",
  ],
};
