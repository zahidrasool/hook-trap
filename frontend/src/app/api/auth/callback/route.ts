import { NextRequest, NextResponse } from "next/server";

/**
 * Landing point for the magic link. The backend validates the emailed token,
 * issues a session token, and redirects here; this hands the token to a client
 * page that can put it in localStorage.
 */

/**
 * Absolute base URL for redirects.
 *
 * `request.url` is the address Next.js was reached on, which behind a reverse
 * proxy is the container's own origin (http://localhost:3000). Redirecting
 * against that sends the browser to localhost. Prefer the forwarded headers
 * the proxy sets, and fall back to the request only for direct/local access.
 */
function externalOrigin(request: NextRequest): string {
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    request.nextUrl.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    request.headers.get("host") ||
    request.nextUrl.host;

  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const origin = externalOrigin(request);
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", origin));
  }

  return NextResponse.redirect(
    new URL(`/auth/login?callback=true&token=${encodeURIComponent(token)}`, origin)
  );
}
