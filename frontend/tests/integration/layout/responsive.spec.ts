import { test, expect } from "@playwright/test";

test("auth pages follow the guest desktop and mobile layouts", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile";
  for (const route of ["/login", "/register"]) {
    if (mobile) {
      await page.setViewportSize({ width: 390, height: 844 });
    } else {
      let height = 1218;
      if (route === "/register") {
        height = 1372;
      }
      await page.setViewportSize({ width: 1440, height: height });
    }
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel("Email Address")).toBeEditable();
    await expect(
      page.getByRole("link", { name: "My Lists", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "My Lists", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("checkbox", { name: /show password/i }),
    ).toHaveCount(0);
    const fits = await page.evaluate(function () {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(fits).toBe(true);
    if (mobile) {
      await expect(page.locator(".site-footer")).toBeHidden();
      if (route === "/login") {
        await expect(
          page.getByText("Your lists and reviews stay yours."),
        ).toBeVisible();
      } else {
        await expect(page.locator(".mobile-copy")).toBeVisible();
        await expect(page.locator(".header-content")).toBeHidden();
      }
    } else {
      await expect(
        page.getByRole("navigation", { name: "Main navigation" }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Account navigation" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Explore", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Platform", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Legal", exact: true }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: test.info().outputPath(route.slice(1) + "-design.png"),
      fullPage: true,
      animations: "disabled",
      scale: "css",
    });
  }
  if (mobile) {
    await page.goto("/login");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "My Lists", exact: true }),
    ).toHaveCount(0);
    await dialog.getByRole("link", { name: "Log In", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(dialog).not.toBeVisible();
  }
});
