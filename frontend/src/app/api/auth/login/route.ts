import { NextResponse } from "next/server";
import { backendError, backendRequest, isSameOrigin } from "@/lib/backend";
import { getSessionSeconds, setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { message: "This request is not allowed." },
      { status: 403 },
    );
  }

  let data;

  try {
    data = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Enter your email and password." },
      { status: 400 },
    );
  }

  if (
    !data ||
    typeof data.email !== "string" ||
    typeof data.password !== "string"
  ) {
    return NextResponse.json(
      { message: "Enter your email and password." },
      { status: 422 },
    );
  }

  const email = data.email.trim().toLowerCase();
  const password = data.password;

  if (!email || !password || email.length > 254 || password.length > 128) {
    return NextResponse.json(
      { message: "Check your email and password." },
      { status: 422 },
    );
  }

  try {
    // fastapi login expects form data rather than json
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);

    const response = await backendRequest(
      "/auth/login",
      "POST",
      form.toString(),
      undefined,
      "application/x-www-form-urlencoded",
    );

    if (!response.ok) {
      const message = await backendError(response);
      return NextResponse.json(
        { message: message },
        { status: response.status },
      );
    }

    const login = await response.json();

    if (
      typeof login.access_token !== "string" ||
      login.token_type !== "bearer"
    ) {
      throw new Error("The login response is not valid.");
    }

    // check the token before saving it in the cookie
    const userResponse = await backendRequest(
      "/auth/me",
      "GET",
      undefined,
      login.access_token,
    );

    if (!userResponse.ok) {
      return NextResponse.json(
        { message: "Could not verify your account." },
        { status: userResponse.status },
      );
    }

    const user = await userResponse.json();
    const seconds = getSessionSeconds(login.access_token);
    const result = NextResponse.json({ user: user });
    result.headers.set("Cache-Control", "no-store");
    setSessionCookie(result, login.access_token, seconds);

    return result;
  } catch {
    return NextResponse.json(
      { message: "Could not reach the backend. Please try again." },
      { status: 503 },
    );
  }
}
