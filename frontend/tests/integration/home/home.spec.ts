import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fixture from "../../fixtures/home/response.json";

test.beforeEach(async function ({ page }) {
  // only artwork is served locally; catalog data still goes through fastapi
  await page.route("**/__test/home-images/*.webp", async function (route) {
    const filename = path.basename(new URL(route.request().url()).pathname);
    await route.fulfill({
      path: path.join(process.cwd(), "tests/fixtures/home/images", filename),
      contentType: "image/webp",
    });
  });
});

test("home loads the real api response and follows the desktop and mobile design", async function ({
  page,
  request,
}, testInfo) {
  if (testInfo.project.name === "mobile") {
    await page.setViewportSize({ width: 394, height: 844 });
  } else {
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  const responsePromise = page.waitForResponse("**/api/backend/home");
  await page.goto("/");
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const home = await response.json();
  expect(home.data).toEqual(fixture.data);
  const direct = await request.get("http://127.0.0.1:8001/api/v1/home");
  expect(direct.status()).toBe(200);
  expect((await direct.json()).data).toEqual(home.data);
  await expect(page.getByRole("article")).toHaveCount(8);
  await expect(
    page.getByRole("heading", { name: "Popular Right Now" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recommended for You" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View details for The Silent Forest" }),
  ).toHaveAttribute("href", "/items/books/books-home-1");
  const fits = await page.evaluate(function () {
    return document.documentElement.scrollWidth <= window.innerWidth;
  });
  expect(fits).toBe(true);
  for (const image of await page.locator(".home-item-picture img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty("complete", true);
    await expect(image).not.toHaveJSProperty("naturalWidth", 0);
  }
  await page.evaluate(function () {
    document.querySelectorAll(".home-card-grid").forEach(function (grid) {
      grid.scrollLeft = 0;
    });
    window.scrollTo(0, 0);
  });
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: test.info().outputPath("home-design.png"),
    fullPage: true,
    scale: "css",
    animations: "disabled",
  });
});

test("search and browse links lead to supported discover parameters", async function ({
  page,
}, testInfo) {
  await page.goto("/");
  await page.getByRole("searchbox").fill("quiet forest");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/discover\?q=quiet\+forest$/);
  await page.goto("/");
  await expect(page.getByRole("article")).toHaveCount(8);
  await expect(
    page.locator(".home-categories a").filter({ hasText: "Movies" }),
  ).toHaveAttribute("href", "/discover?category=movies");
  await expect(
    page.locator(".home-categories a").filter({ hasText: "Music" }),
  ).toHaveAttribute("href", "/discover?category=music");
  await expect(
    page.locator(".home-categories a").filter({ hasText: "Attractions" }),
  ).toHaveAttribute("href", "/discover?category=attractions");
  if (testInfo.project.name === "desktop") {
    await page
      .getByRole("navigation", { name: "Browse by category" })
      .getByRole("link", { name: "Books" })
      .click();
    await expect(page).toHaveURL(/\/discover\?category=books$/);
  } else {
    await page
      .getByRole("region", { name: "Popular Right Now" })
      .getByRole("link", { name: "View all", exact: true })
      .click();
    await expect(page).toHaveURL(/\/discover$/);
  }
});

test("missing artwork has a stable accessible fallback", async function ({
  page,
}) {
  await page.route(
    "**/__test/home-images/movies-1.webp",
    async function (route) {
      await route.fulfill({ status: 404, body: "not found" });
    },
  );
  await page.goto("/");
  const card = page.getByRole("article", { name: "Cure for Wellness" });
  await expect(
    card.getByRole("img", { name: "No image available for Cure for Wellness" }),
  ).toBeVisible();
  await expect(
    card.getByRole("link", { name: "View details for Cure for Wellness" }),
  ).toHaveAttribute("href", "/items/movies/movies-home-1");
});

test("home bookmarks prompt guests, then save to my lists after real login", async function ({
  page,
  request,
}) {
  const email = "home-" + randomUUID() + "@example.com";
  const password = randomUUID() + "-password";
  const registration = await request.post("/api/auth/register", {
    headers: { Origin: "http://localhost:3001" },
    data: {
      full_name: "Home Reader",
      email: email,
      password: password,
      confirm_password: password,
      terms_accepted: true,
    },
  });
  expect(registration.status()).toBe(201);
  await page.goto("/");
  const bookmark = page.getByRole("button", {
    name: "Save The Silent Forest",
    exact: true,
  });
  await expect(bookmark).toBeEnabled();
  await bookmark.click();
  const prompt = page.getByRole("dialog", { name: "Join InterestFinder" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("link", { name: "Log In", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  const emailInput = page.getByLabel("Email Address");
  await expect(emailInput).toBeEditable();
  await emailInput.fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await expect(emailInput).toHaveValue(email);
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3001/");
  expect((await page.request.get("/api/auth/session")).status()).toBe(200);

  // signed in users save through the real detail and saved-items routes
  await expect(bookmark).toBeEnabled();
  await expect(bookmark).toHaveAttribute("aria-pressed", "false");
  await bookmark.click();
  await expect(page.getByText("Added to your Planned list.")).toBeVisible();
  await expect(bookmark).toHaveAttribute("aria-pressed", "true");
  await expect(bookmark).toBeDisabled();
  await expect(
    page.getByRole("dialog", { name: "Join InterestFinder" }),
  ).toHaveCount(0);

  await page.goto("/my-lists");
  await expect(page.getByText("The Silent Forest").first()).toBeVisible();

  // a fresh visit shows the saved state from the user's list
  await page.goto("/");
  await expect(bookmark).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Save Lost In Stone", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("home remains usable at phone and tablet widths", async function ({
  page,
}) {
  await page.goto("/");
  await expect(page.getByRole("article")).toHaveCount(8);
  for (const width of [320, 768]) {
    await page.setViewportSize({ width: width, height: 900 });
    await expect(page.getByRole("searchbox")).toBeVisible();
    const fits = await page.evaluate(function () {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(fits).toBe(true);
  }
});
