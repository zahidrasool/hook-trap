import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ status: "logged_out" });
  response.cookies.delete("session_token");
  return response;
}
