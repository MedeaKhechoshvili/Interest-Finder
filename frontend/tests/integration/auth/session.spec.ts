import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const origin = "http://localhost:3001";

test("invalid credentials display the real backend error", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email Address")).toBeEditable();
  await page.getByLabel("Email Address").fill(randomUUID() + "@example.com");
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Incorrect email or password" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("guest pages and API calls are protected and cross-site writes are rejected", async ({
  page,
  request,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?/);
  expect((await request.get("/api/backend/saved-items/")).status()).toBe(401);
  const forbidden = await request.post("/api/auth/logout", {
    headers: { Origin: "https://other.example" },
  });
  expect(forbidden.status()).toBe(403);
});

test("an invalid cookie is rejected by FastAPI and cleared by the frontend", async ({
  context,
}) => {
  await context.addCookies([
    {
      name: "interestfinder_standard_session",
      value: "invalid.jwt.token",
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const response = await context.request.get("/api/backend/saved-items/");
  expect(response.status()).toBe(401);
  expect(
    (await context.cookies()).some(function (cookie) {
      return cookie.name === "interestfinder_standard_session";
    }),
  ).toBe(false);
});
