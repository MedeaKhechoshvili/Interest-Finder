import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("guest prompt opens from a page and returns there after real login", async ({
  page,
  request,
}) => {
  const email = "prompt-" + randomUUID() + "@example.com";
  const password = randomUUID() + "-password";
  const registration = await request.post("/api/auth/register", {
    headers: { Origin: "http://localhost:3001" },
    data: {
      full_name: "Prompt Reader",
      email: email,
      password: password,
      confirm_password: password,
      terms_accepted: true,
    },
  });
  expect(registration.status()).toBe(201);

  await page.goto("/auth-prompt-demo");
  const trigger = page.getByRole("button", { name: "Try private action" });
  await expect(trigger).toHaveCSS("color", "rgb(255, 255, 255)");
  await trigger.click();
  const prompt = page.getByRole("dialog", { name: "Join InterestFinder" });
  await expect(prompt).toBeVisible();
  await expect(
    prompt.getByRole("link", { name: "Log In", exact: true }),
  ).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(
    prompt.getByRole("link", { name: "Create Account" }),
  ).toHaveAttribute(
    "href",
    "/register?next=%2Fauth-prompt-demo%3Freturned%3D1",
  );
  const bounds = await prompt.boundingBox();
  expect(bounds).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (bounds && viewport) {
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  }
  await page.screenshot({ path: test.info().outputPath("guest-prompt.png") });

  await page.keyboard.press("Escape");
  await expect(prompt).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await prompt.getByRole("link", { name: "Create Account" }).click();
  await expect(page).toHaveURL(
    /\/register\?next=%2Fauth-prompt-demo%3Freturned%3D1$/,
  );

  await page.goto("/auth-prompt-demo");
  await trigger.click();
  await prompt.getByRole("link", { name: "Log In", exact: true }).click();
  await expect(page).toHaveURL(
    /\/login\?next=%2Fauth-prompt-demo%3Freturned%3D1$/,
  );
  const emailInput = page.getByLabel("Email Address");
  await expect(emailInput).toBeEditable();
  await emailInput.fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await expect(emailInput).toHaveValue(email);
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await expect(page).toHaveURL(/\/auth-prompt-demo\?returned=1$/);
  await trigger.click();
  await expect(prompt).not.toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "You are logged in. The private action can continue.",
  );
  expect((await page.request.get("/api/auth/session")).status()).toBe(200);
});

test("guest navigation matches the design without private list controls", async ({
  page,
}, testInfo) => {
  await page.goto("/discover");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const menu = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(
      menu.getByRole("link", { name: "Home", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("link", { name: "Discover", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("link", { name: "Log In", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("link", { name: "Sign Up", exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "My Lists", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "My Lists", exact: true }),
  ).toHaveCount(0);
});
