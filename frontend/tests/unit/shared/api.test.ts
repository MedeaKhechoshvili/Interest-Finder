// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { goToPage } from "@/lib/navigation";

vi.mock("@/lib/navigation", function () {
  return { goToPage: vi.fn() };
});

describe("browser api helper", function () {
  it("sends JSON through the frontend with cookie credentials", async function () {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 7 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await apiRequest("/saved-items/", "POST", { item_id: 101 })).toEqual(
      { id: 7 },
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/backend/saved-items/",
      expect.objectContaining({
        method: "POST",
        body: '{"item_id":101}',
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
  });

  it("handles a successful delete with no response body", async function () {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    expect(await apiRequest("/reviews/1", "DELETE")).toBeNull();
  });

  it.each(["https://other.example", "//other.example", "items"])(
    "rejects nonlocal API path %s",
    async function (path) {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      await expect(apiRequest(path)).rejects.toThrow("relative backend path");
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("returns the backend error message", async function () {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: "Already saved" }, { status: 409 }),
        ),
    );
    await expect(apiRequest("/saved-items/", "POST", {})).rejects.toThrow(
      "Already saved",
    );
  });

  it("returns to login after session expiry and preserves the page", async function () {
    vi.stubGlobal("window", {
      location: { pathname: "/my-lists", search: "?status=planned" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    await expect(apiRequest("/saved-items/")).rejects.toThrow("Please log in");
    expect(goToPage).toHaveBeenCalledWith(
      "/login?expired=1&next=%2Fmy-lists%3Fstatus%3Dplanned",
    );
  });

  it("propagates connection failures", async function () {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(apiRequest("/home")).rejects.toThrow("offline");
  });
});
