import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Keeps the per-user app surfaces out of search results.
//
// These routes returned HTTP 200 with no robots directive: the auth gate is
// client-side (`useAuth()` redirects after hydration), so a crawler receives
// the shell and indexes the URL. No user data leaks — the shell is empty until
// the client fetches — but the URLs are index bloat and dilute the public
// pages.
//
// This is a header rather than a `noindex` meta tag because the layouts for
// these routes are client components, which cannot export Next's `metadata`.
// The header is equivalent for crawlers and works regardless of rendering mode.
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/auth/:path*"],
};
