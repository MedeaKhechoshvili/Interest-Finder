import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendRequest } from "./backend";

export const sessionCookie = "interestfinder_standard_session";

export interface User {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
}

// only the backend can decide whether a token belongs to a valid user
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(sessionCookie);

  if (!cookie) {
    return null;
  }

  const response = await backendRequest(
    "/auth/me",
    "GET",
    undefined,
    cookie.value,
  );

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("The account service is unavailable.");
  }

  const user: User = await response.json();

  if (!user.is_active) {
    return null;
  }

  return user;
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  seconds: number,
) {
  let secure = false;

  if (process.env.NODE_ENV === "production") {
    secure = true;
  }

  response.cookies.set(sessionCookie, token, {
    httpOnly: true,
    secure: secure,
    sameSite: "lax",
    path: "/",
    maxAge: seconds,
  });
}

// the login route checks this token with the backend before reading its expiry
export function getSessionSeconds(token: string) {
  const parts = token.split(".");
  const payloadText = Buffer.from(parts[1], "base64url").toString("utf8");
  const payload = JSON.parse(payloadText);

  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    throw new Error("The token has no expiry date.");
  }

  const currentSeconds = Math.floor(Date.now() / 1000);
  const remainingSeconds = Math.floor(payload.exp - currentSeconds);

  if (remainingSeconds <= 0) {
    throw new Error("The token has expired.");
  }

  return remainingSeconds;
}
