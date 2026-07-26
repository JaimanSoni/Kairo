import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "kairo_session";
const PROTECTED = ["/today", "/upcoming", "/lists", "/log", "/admin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // Optimistic check only — real verification happens server-side per request.
  if (PROTECTED.some((p) => pathname.startsWith(p)) && !hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/" && hasSession) {
    return NextResponse.redirect(new URL("/today", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/today/:path*",
    "/upcoming/:path*",
    "/lists/:path*",
    "/log/:path*",
    "/admin/:path*",
  ],
};
