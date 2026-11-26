
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const origin = "http://localhost:3001";

async function registerAndLogIn(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/register");

  await expect(page.getByLabel("Full Name")).toBeEditable();

  await page.getByLabel("Full Name").fill("My Lists Integration User");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password").fill(password);
  await page.locator("#terms").check();

  await page.getByRole("button", { name: "Sign Up", exact: true }).click();

  await expect(page).toHaveURL(/\/login\?registered=1/);

  const emailInput = page.getByLabel("Email Address");

  await expect(emailInput).toBeEditable();

  await emailInput.fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);

  await page.getByRole("button", { name: "Log In", exact: true }).click();

  await expect(page).toHaveURL(/\/account$/);
}

test("guests are redirected away from My Lists", async ({ page, request }) => {
  await page.goto("/my-lists");

  await expect(page).toHaveURL(/\/login\?/);

  await expect(
    page.getByRole("heading", { name: "Welcome Back" }),
  ).toBeVisible();

  const response = await request.get("/api/backend/saved-items/");

  expect(response.status()).toBe(401);
});

test("an authenticated user sees the empty Planned and Completed lists", async ({
  page,
}) => {
  const email = `my-lists-empty-${randomUUID()}@example.com`;
  const password = `${randomUUID()}-password`;

  await registerAndLogIn(page, email, password);

  await page.goto("/my-lists");

  await expect(
    page.getByRole("heading", { name: "My Lists" }),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "No planned items yet" }),
  ).toBeVisible();

  await expect(
    page.getByRole("tab", { name: "Planned (0)" }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Completed (0)" }).click();

  await expect(
    page.getByRole("heading", { name: "No completed items yet" }),
  ).toBeVisible();
});

test("the My Lists page shows a loading error and recovers when the API returns", async ({
  page,
}) => {
  const email = `my-lists-retry-${randomUUID()}@example.com`;
  const password = `${randomUUID()}-password`;

  await registerAndLogIn(page, email, password);

  let requestIntercepted = false;

  const savedItemsRoute = (url: URL) =>
    url.pathname.includes("/saved-items");

  await page.route(savedItemsRoute, async (route) => {
    requestIntercepted = true;

    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Temporary test outage",
      }),
    });
  });

  await page.goto("/my-lists");

  await expect.poll(() => requestIntercepted).toBe(true);

  // Target the My Lists error container, not Next.js's route announcer.
  await expect(
    page.locator(".my-lists-alert.my-lists-error"),
  ).toContainText("Temporary test outage");

  await expect(
    page.getByRole("button", { name: "Try again" }),
  ).toBeVisible();

  // Remove the mock so the retry reaches the real backend.
  await page.unroute(savedItemsRoute);

  await page.getByRole("button", { name: "Try again" }).click();

  await expect(
    page.getByRole("heading", { name: "No planned items yet" }),
  ).toBeVisible();
});

test("saved items can be completed, moved back, removed, and remain removed after reload", async ({
  page,
  context,
}) => {
  const email = `my-lists-workflow-${randomUUID()}@example.com`;
  const password = `${randomUUID()}-password`;

  await registerAndLogIn(page, email, password);

  // Seed the test catalog item through the authenticated frontend proxy.
  const saveResponse = await context.request.post(
    "/api/backend/saved-items/",
    {
      headers: { Origin: origin },
      data: { item_id: 101 },
    },
  );

  expect(saveResponse.status()).toBe(201);

  const saved = await saveResponse.json();

  expect(saved.status).toBe("planned");
  expect(saved.catalog_item.title).toBe("Integration Test Book");

  await page.goto("/my-lists");

  await expect(
    page.getByRole("heading", { name: "Integration Test Book" }),
  ).toBeVisible();

  await expect(
    page.getByRole("tab", { name: "Planned (1)" }),
  ).toBeVisible();

  await expect(
    page.getByRole("tab", { name: "Completed (0)" }),
  ).toBeVisible();

  // Move the item to Completed.
  await page.getByRole("button", { name: "Mark as Completed" }).click();

  await expect(page.getByRole("status")).toContainText(
    "Item moved to Completed.",
  );

  await expect(
    page.getByRole("tab", { name: "Planned (0)" }),
  ).toBeVisible();

  await expect(
    page.getByRole("tab", { name: "Completed (1)" }),
  ).toBeVisible();

  // Open Completed and move the item back to Planned.
  await page.getByRole("tab", { name: "Completed (1)" }).click();

  await expect(
    page.getByRole("heading", { name: "Integration Test Book" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Move to Planned" }).click();

  await expect(page.getByRole("status")).toContainText(
    "Item moved to Planned.",
  );

  await expect(
    page.getByRole("tab", { name: "Planned (1)" }),
  ).toBeVisible();

  // Switch back to Planned before removing the item.
  await page.getByRole("tab", { name: "Planned (1)" }).click();

  await expect(
    page.getByRole("heading", { name: "Integration Test Book" }),
  ).toBeVisible();

  // Remove the item and accept the browser confirmation dialog.
  page.once("dialog", (dialog) => dialog.accept());

  await page.getByRole("button", { name: "Remove" }).click();

  await expect(page.getByRole("status")).toContainText(
    "Item removed from your lists.",
  );

  await expect(
    page.getByRole("heading", { name: "No planned items yet" }),
  ).toBeVisible();

  // Verify that the item remains deleted after refreshing.
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "No planned items yet" }),
  ).toBeVisible();

  const remaining = await context.request.get(
    "/api/backend/saved-items/",
  );

  expect(remaining.status()).toBe(200);
  expect(await remaining.json()).toEqual([]);
});
