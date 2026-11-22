import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendError, backendRequest, isSameOrigin } from "@/lib/backend";
import { sessionCookie, setSessionCookie } from "@/lib/session";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

async function handleRequest(request: Request, context: RouteContext) {
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return NextResponse.json(
      { message: "This request is not allowed." },
      { status: 403 },
    );
  }

  const params = await context.params;
  const parts = params.path;
  const resource = parts[0];
  const method = request.method;
  let allowed = false;
  let privateRequest = false;
  let path = "";

  // only forward known feature routes to the backend
  if (parts.length === 1) {
    if (method === "GET" && ["health", "home", "items"].includes(resource)) {
      allowed = true;
    }

    if (
      ["saved-items", "reviews"].includes(resource) &&
      ["GET", "POST"].includes(method)
    ) {
      allowed = true;
    }
  }

  if (parts.length === 2 && /^[1-9][0-9]*$/.test(parts[1])) {
    if (
      ["saved-items", "reviews"].includes(resource) &&
      ["PATCH", "DELETE"].includes(method)
    ) {
      allowed = true;
    }

    if (resource === "reviews" && method === "GET") {
      allowed = true;
    }
  }

  if (parts.length === 3 && resource === "items" && method === "GET") {
    const categories = ["movies", "books", "music", "attractions"];

    if (categories.includes(parts[1])) {
      allowed = true;
    }
  }

  if (!allowed) {
    return NextResponse.json({ message: "Route not found." }, { status: 404 });
  }

  for (const part of parts) {
    if (
      part === "." ||
      part === ".." ||
      part.includes("/") ||
      part.includes("\\")
    ) {
      return NextResponse.json(
        { message: "Route not found." },
        { status: 404 },
      );
    }

    path = path + "/" + encodeURIComponent(part);
  }

  if (parts.length === 1 && ["saved-items", "reviews"].includes(resource)) {
    path = path + "/";
  }

  if (resource === "saved-items") {
    privateRequest = true;
  }

  if (resource === "reviews" && method !== "GET") {
    privateRequest = true;
  }

  const cookieStore = await cookies();
  const cookie = cookieStore.get(sessionCookie);
  let token;

  if (privateRequest) {
    if (!cookie) {
      return NextResponse.json(
        { message: "Please log in to continue." },
        { status: 401 },
      );
    }

    token = cookie.value;
  }

  let body;

  if (method === "POST" || method === "PATCH") {
    try {
      const data = await request.json();
      body = JSON.stringify(data);
    } catch {
      return NextResponse.json(
        { message: "The request body is not valid JSON." },
        { status: 400 },
      );
    }
  }

  try {
    const url = new URL(request.url);
    const response = await backendRequest(
      path + url.search,
      method,
      body,
      token,
    );

    if (!response.ok) {
      const message = await backendError(response);
      const result = NextResponse.json(
        { message: message },
        { status: response.status },
      );
      result.headers.set("Cache-Control", "no-store");

      if (response.status === 401) {
        setSessionCookie(result, "", 0);
      }

      return result;
    }

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await response.json();
    const result = NextResponse.json(data, { status: response.status });
    result.headers.set("Cache-Control", "no-store");
    return result;
  } catch {
    return NextResponse.json(
      { message: "Could not reach the backend. Please try again." },
      { status: 503 },
    );
  }
}

// each exported function handles one http method
export async function GET(request: Request, context: RouteContext) {
  return handleRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return handleRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return handleRequest(request, context);
}
