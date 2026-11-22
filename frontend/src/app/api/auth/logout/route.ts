import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/backend";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { message: "This request is not allowed." },
      { status: 403 },
    );
  }

  // a zero lifetime tells the browser to remove the cookie
  const response = NextResponse.json({ message: "You have logged out." });
  setSessionCookie(response, "", 0);
  response.headers.set("Cache-Control", "no-store");

  return response;
}
