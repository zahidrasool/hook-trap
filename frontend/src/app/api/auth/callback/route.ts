import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Redirect to a client-side page that stores the token in localStorage
  // We pass the token as a hash fragment (not visible to server, not logged)
  return NextResponse.redirect(
    new URL(`/auth/login?callback=true&token=${token}`, request.url)
  );
}
