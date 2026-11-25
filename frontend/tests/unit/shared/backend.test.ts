// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { backendError, backendRequest, isSameOrigin } from "@/lib/backend";
import { goToPage } from "@/lib/navigation";

describe("server request helpers", function () {
  it("uses the configured base URL and forwards credentials only as a header", async function () {
    vi.stubEnv("BACKEND_API_URL", "http://api.example/api/v1/");
    const fetcher = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetcher);
    await backendRequest("/auth/me", "GET", undefined, "test-token");
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("http://api.example/api/v1/auth/me");
    expect(options.headers.get("Authorization")).toBe("Bearer test-token");
    expect(options.cache).toBe("no-store");
    expect(options.redirect).toBe("error");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("supports the default URL and form-data login", async function () {
    vi.stubEnv("BACKEND_API_URL", "");
    const fetcher = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetcher);
    await backendRequest(
      "/auth/login",
      "POST",
      "username=reader",
      undefined,
      "application/x-www-form-urlencoded",
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8000/api/v1/auth/login",
    );
    expect(fetcher.mock.calls[0][1].headers.get("Content-Type")).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(fetcher.mock.calls[0][1].headers.has("Authorization")).toBe(false);
  });

  it("extracts safe errors and handles malformed responses", async function () {
    expect(
      await backendError(
        Response.json({ error: { message: "Incorrect password" } }),
      ),
    ).toBe("Incorrect password");
    expect(await backendError(Response.json({}))).toBe(
      "The service could not complete the request.",
    );
    expect(await backendError(new Response("not json"))).toBe(
      "The service could not complete the request.",
    );
  });

  it("rejects missing or foreign origins and cross-site requests", function () {
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    expect(isSameOrigin(new Request("http://localhost:3000/"))).toBe(false);
    expect(
      isSameOrigin(
        new Request("http://localhost:3000/", {
          headers: { origin: "https://other.example" },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOrigin(
        new Request("http://localhost:3000/", {
          headers: {
            origin: "http://localhost:3000",
            "sec-fetch-site": "cross-site",
          },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOrigin(
        new Request("http://localhost:3000/", {
          headers: { origin: "http://localhost:3000" },
        }),
      ),
    ).toBe(true);
  });

  it("uses the request origin when no app origin is configured", function () {
    vi.stubEnv("APP_ORIGIN", "");
    expect(
      isSameOrigin(
        new Request("http://localhost:3001/", {
          headers: { origin: "http://localhost:3001" },
        }),
      ),
    ).toBe(true);
  });

  it("performs a full navigation after auth changes", function () {
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace: replace } });
    goToPage("/account");
    expect(replace).toHaveBeenCalledWith("/account");
  });
});
