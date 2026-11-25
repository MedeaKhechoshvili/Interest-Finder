import { describe, it, expect } from "vitest";
import { getReturnPath } from "@/lib/return-path";

describe("return navigation", function () {
  it.each([
    undefined,
    null,
    12,
    "",
    "https://other.example",
    "//other.example",
    "/\\other.example",
    "/\t/other.example",
    "/\nother.example",
    "/api/auth/logout",
    "/login",
    "/register",
    "/",
    "/folder/../login",
  ])("rejects unsafe or looping destination %s", function (value) {
    expect(getReturnPath(value)).toBe("/account");
  });

  it("rejects repeated query parameters", function () {
    expect(getReturnPath(["/discover", "//other.example"])).toBe("/account");
  });

  it("preserves a local page with search state and a fragment", function () {
    expect(getReturnPath("/discover?category=books#results")).toBe(
      "/discover?category=books#results",
    );
  });
});
