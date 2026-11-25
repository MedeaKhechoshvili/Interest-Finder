import { test, expect } from "@playwright/test";

test("auth forms fit the viewport and the mobile sheet navigates correctly", async ({
  page,
}, testInfo) => {
  for (const route of ["/login", "/register"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const fits = await page.evaluate(function () {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(fits).toBe(true);
  }
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Log In", exact: true })
      .click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
});
