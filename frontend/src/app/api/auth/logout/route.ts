import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // localStorage is cleared client-side in useAuth.logout()
  return NextResponse.json({ status: "logged_out" });
}
