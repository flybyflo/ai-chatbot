import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // healthcheck for Playwright
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  // Let ALL API routes pass; do real auth checks inside the handlers
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const hasSession = Boolean(getSessionCookie(request));

  // Public auth pages
  if (pathname === "/login" || pathname === "/register") {
    if (hasSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Everything else is protected
  if (!hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // run for all pages except API, static assets, and metadata
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
