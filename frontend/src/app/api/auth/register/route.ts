import { NextResponse } from "next/server";
import { backendError, backendRequest, isSameOrigin } from "@/lib/backend";

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
      { message: "Check the registration form." },
      { status: 400 },
    );
  }

  if (
    !data ||
    typeof data.full_name !== "string" ||
    typeof data.email !== "string" ||
    typeof data.password !== "string"
  ) {
    return NextResponse.json(
      { message: "Fill in all required fields." },
      { status: 422 },
    );
  }

  const name = data.full_name.trim();
  const email = data.email.trim().toLowerCase();
  const password = data.password;

  if (name.length < 2 || name.length > 100) {
    return NextResponse.json(
      { message: "Your name must have 2 to 100 characters." },
      { status: 422 },
    );
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return NextResponse.json(
      { message: "Enter a valid email address." },
      { status: 422 },
    );
  }

  if (password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { message: "Your password must have 8 to 128 characters." },
      { status: 422 },
    );
  }

  if (password !== data.confirm_password) {
    return NextResponse.json(
      { message: "Passwords do not match." },
      { status: 422 },
    );
  }

  if (data.terms_accepted !== true) {
    return NextResponse.json(
      { message: "Please accept the terms and privacy policy." },
      { status: 422 },
    );
  }

  try {
    // confirmation is checked here and is not sent to the backend
    const registration = {
      full_name: name,
      email: email,
      password: password,
      terms_accepted: true,
    };

    const response = await backendRequest(
      "/auth/register",
      "POST",
      JSON.stringify(registration),
    );

    if (!response.ok) {
      const message = await backendError(response);
      return NextResponse.json(
        { message: message },
        { status: response.status },
      );
    }

    return NextResponse.json(
      { message: "Your account is ready. You can log in." },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { message: "Could not reach the backend. Please try again." },
      { status: 503 },
    );
  }
}
