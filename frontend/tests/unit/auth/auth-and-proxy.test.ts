// @vitest-environment node
import {
  GET as proxyGet,
  POST as proxyPost,
  PATCH as proxyPatch,
  DELETE as proxyDelete,
} from "@/app/api/backend/[...path]/route";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";
import {
  getCurrentUser,
  getSessionSeconds,
  setSessionCookie,
} from "@/lib/session";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as session } from "@/app/api/auth/session/route";

const { cookieGet } = vi.hoisted(function () {
  return { cookieGet: vi.fn() };
});
vi.mock("next/headers", function () {
  return {
    cookies: async function () {
      return { get: cookieGet };
    },
  };
});
vi.mock("@/lib/backend", async function (importOriginal) {
  const original = await importOriginal<typeof import("@/lib/backend")>();
  return { ...original, backendRequest: vi.fn() };
});
const upstream = vi.mocked(backendRequest);
const user = {
  id: 1,
  full_name: "Reader",
  email: "reader@example.com",
  is_active: true,
};
const registration = {
  full_name: " Reader ",
  email: " READER@example.com ",
  password: "valid-password",
  confirm_password: "valid-password",
  terms_accepted: true,
};

function token(exp = Math.floor(Date.now() / 1000) + 1800) {
  return (
    "header." +
    Buffer.from(JSON.stringify({ exp: exp })).toString("base64url") +
    ".signature"
  );
}
function request(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/auth", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(function () {
  upstream.mockReset();
  cookieGet.mockReset();
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
});

describe("server session", function () {
  it("requires a cookie and verifies the user with the backend", async function () {
    expect(await getCurrentUser()).toBeNull();
    expect(upstream).not.toHaveBeenCalled();
    cookieGet.mockReturnValue({ value: "test-token" });
    upstream.mockResolvedValue(Response.json(user));
    expect(await getCurrentUser()).toEqual(user);
    expect(upstream).toHaveBeenCalledWith(
      "/auth/me",
      "GET",
      undefined,
      "test-token",
    );
  });

  it("rejects invalid tokens and inactive accounts", async function () {
    cookieGet.mockReturnValue({ value: "invalid" });
    upstream
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ ...user, is_active: false }));
    expect(await getCurrentUser()).toBeNull();
    expect(await getCurrentUser()).toBeNull();
  });

  it("distinguishes unavailable services from invalid credentials", async function () {
    cookieGet.mockReturnValue({ value: "token" });
    upstream.mockResolvedValue(new Response(null, { status: 503 }));
    await expect(getCurrentUser()).rejects.toThrow("unavailable");
  });

  it("uses token expiry and rejects malformed or expired tokens", function () {
    expect(getSessionSeconds(token())).toBeGreaterThan(1790);
    expect(function () {
      getSessionSeconds(token(1));
    }).toThrow("expired");
    expect(function () {
      getSessionSeconds(token(Number.NaN));
    }).toThrow("expiry");
    expect(function () {
      getSessionSeconds("malformed");
    }).toThrow();
  });

  it("sets protected cookies with secure enabled in production", function () {
    vi.stubEnv("NODE_ENV", "production");
    const response = NextResponse.json({});
    setSessionCookie(response, "token", 60);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });
});

describe("auth route handlers", function () {
  it("verifies login before setting a cookie and never returns the token", async function () {
    const jwt = token();
    upstream
      .mockResolvedValueOnce(
        Response.json({ access_token: jwt, token_type: "bearer" }),
      )
      .mockResolvedValueOnce(Response.json(user));
    const response = await login(
      request({ email: " READER@example.com ", password: "valid-password" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: user });
    expect(upstream.mock.calls[0][2]).toBe(
      "username=reader%40example.com&password=valid-password",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    {},
    null,
    { email: 1, password: "x" },
    { email: "", password: "x" },
    { email: "reader@example.com", password: "x".repeat(129) },
  ])("rejects invalid login data %j", async function (body) {
    expect((await login(request(body))).status).toBe(422);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects cross site requests and malformed JSON", async function () {
    expect((await login(request({}, "https://other.example"))).status).toBe(
      403,
    );
    const malformed = new Request("http://localhost:3000/", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      body: "{",
    });
    expect((await login(malformed)).status).toBe(400);
  });

  it("preserves rejected credentials without creating a cookie", async function () {
    upstream.mockResolvedValue(
      Response.json({ error: { message: "Wrong password" } }, { status: 401 }),
    );
    const response = await login(
      request({ email: "reader@example.com", password: "wrong" }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects malformed tokens, unverified users, and service failures", async function () {
    const body = { email: "reader@example.com", password: "password" };
    upstream.mockResolvedValueOnce(Response.json({ access_token: 1 }));
    expect((await login(request(body))).status).toBe(503);
    upstream
      .mockResolvedValueOnce(
        Response.json({ access_token: token(), token_type: "bearer" }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect((await login(request(body))).status).toBe(401);
    upstream.mockRejectedValueOnce(new Error("offline"));
    expect((await login(request(body))).status).toBe(503);
  });

  it("normalizes registration and sends only the backend fields", async function () {
    upstream.mockResolvedValue(Response.json(user, { status: 201 }));
    const response = await register(request(registration));
    expect(response.status).toBe(201);
    expect(JSON.parse(upstream.mock.calls[0][2]!)).toEqual({
      full_name: "Reader",
      email: "reader@example.com",
      password: "valid-password",
      terms_accepted: true,
    });
  });

  it.each([
    { full_name: " " },
    { email: "invalid" },
    { password: "short" },
    { confirm_password: "different" },
    { terms_accepted: false },
  ])("validates registration %j", async function (changes) {
    expect(
      (await register(request({ ...registration, ...changes }))).status,
    ).toBe(422);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("handles invalid registration bodies, duplicate accounts, and outages", async function () {
    expect((await register(request({}))).status).toBe(422);
    expect((await register(request({}, "https://other.example"))).status).toBe(
      403,
    );
    const malformed = new Request("http://localhost:3000/", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      body: "{",
    });
    expect((await register(malformed)).status).toBe(400);
    upstream.mockResolvedValueOnce(
      Response.json({ error: { message: "Already exists" } }, { status: 409 }),
    );
    expect((await register(request(registration))).status).toBe(409);
    upstream.mockRejectedValueOnce(new Error("offline"));
    expect((await register(request(registration))).status).toBe(503);
  });

  it("clears cookies on logout and rejects foreign requests", async function () {
    expect((await logout(request({}))).headers.get("set-cookie")).toContain(
      "Max-Age=0",
    );
    expect((await logout(request({}, "https://other.example"))).status).toBe(
      403,
    );
  });

  it("returns session state and clears invalid sessions", async function () {
    const absent = await session();
    expect(absent.status).toBe(401);
    expect(absent.headers.get("set-cookie")).toContain("Max-Age=0");
    cookieGet.mockReturnValue({ value: "token" });
    upstream.mockResolvedValueOnce(Response.json(user));
    expect((await session()).status).toBe(200);
    upstream.mockRejectedValueOnce(new Error("offline"));
    expect((await session()).status).toBe(503);
  });
});

function context(parts: string[]) {
  return { params: Promise.resolve({ path: parts }) };
}

describe("feature proxy", function () {
  it("forwards public search parameters without private credentials", async function () {
    cookieGet.mockReturnValue({ value: "old-token" });
    upstream.mockResolvedValue(Response.json({ data: [] }));
    const response = await proxyGet(
      new Request("http://localhost:3000/api/backend/items?q=book"),
      context(["items"]),
    );
    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledWith(
      "/items?q=book",
      "GET",
      undefined,
      undefined,
    );
  });

  it("rejects guests, unknown routes, traversal, and foreign writes", async function () {
    expect(
      (
        await proxyGet(
          new Request("http://localhost:3000/api/backend/saved-items"),
          context(["saved-items"]),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await proxyGet(
          new Request("http://localhost:3000/api/backend/unknown"),
          context(["unknown"]),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await proxyGet(
          new Request("http://localhost:3000/api/backend/items/books/a"),
          context(["items", "books", ".."]),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await proxyPost(
          request({}, "https://other.example"),
          context(["saved-items"]),
        )
      ).status,
    ).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards private writes and uses a trailing slash for collections", async function () {
    cookieGet.mockReturnValue({ value: "token" });
    upstream.mockResolvedValue(Response.json({ id: 7 }, { status: 201 }));
    expect(
      (await proxyPost(request({ item_id: 101 }), context(["saved-items"])))
        .status,
    ).toBe(201);
    expect(upstream).toHaveBeenCalledWith(
      "/saved-items/",
      "POST",
      '{"item_id":101}',
      "token",
    );
  });

  it("supports item details and individual public reviews", async function () {
    upstream.mockImplementation(async function () {
      return Response.json({ data: {} });
    });
    expect(
      (
        await proxyGet(
          new Request("http://localhost:3000/api/backend/items/books/abc"),
          context(["items", "books", "abc"]),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await proxyGet(
          new Request("http://localhost:3000/api/backend/reviews/1"),
          context(["reviews", "1"]),
        )
      ).status,
    ).toBe(200);
  });

  it("handles updates, empty deletes, and malformed write bodies", async function () {
    cookieGet.mockReturnValue({ value: "token" });
    upstream
      .mockResolvedValueOnce(Response.json({ status: "completed" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const patch = new Request(
      "http://localhost:3000/api/backend/saved-items/7",
      {
        method: "PATCH",
        headers: { Origin: "http://localhost:3000" },
        body: '{"status":"completed"}',
      },
    );
    expect(
      (await proxyPatch(patch, context(["saved-items", "7"]))).status,
    ).toBe(200);
    const remove = new Request("http://localhost:3000/api/backend/reviews/7", {
      method: "DELETE",
      headers: { Origin: "http://localhost:3000" },
    });
    const response = await proxyDelete(remove, context(["reviews", "7"]));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    const malformed = new Request("http://localhost:3000/", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      body: "{",
    });
    expect((await proxyPost(malformed, context(["reviews"]))).status).toBe(400);
  });

  it("clears rejected sessions and handles upstream failures", async function () {
    cookieGet.mockReturnValue({ value: "expired" });
    upstream.mockResolvedValueOnce(
      Response.json({ error: { message: "Expired" } }, { status: 401 }),
    );
    const response = await proxyGet(
      new Request("http://localhost:3000/"),
      context(["saved-items"]),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    upstream.mockRejectedValueOnce(new Error("offline"));
    expect(
      (await proxyGet(new Request("http://localhost:3000/"), context(["home"])))
        .status,
    ).toBe(503);
  });
});
