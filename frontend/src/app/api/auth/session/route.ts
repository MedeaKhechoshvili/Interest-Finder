import { NextResponse } from "next/server";
import { getCurrentUser, setSessionCookie } from "@/lib/session";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      const response = NextResponse.json({ user: null }, { status: 401 });
      response.headers.set("Cache-Control", "no-store");
      setSessionCookie(response, "", 0);
      return response;
    }

    const response = NextResponse.json({ user: user });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json(
      { message: "The account service is unavailable." },
      { status: 503 },
    );
  }
}
