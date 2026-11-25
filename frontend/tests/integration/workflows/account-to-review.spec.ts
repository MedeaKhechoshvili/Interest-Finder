import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const origin = "http://localhost:3001";
const api = "http://127.0.0.1:8001/api/v1";

test("register, log in, save, complete, review, and log out through the real API", async ({
  page,
  context,
  request,
}) => {
  const email = "integration-" + randomUUID() + "@example.com";
  const password = randomUUID() + "-password";

  await page.goto("/register");
  await expect(page.getByLabel("Full Name")).toBeEditable();
  await page.getByLabel("Full Name").fill("Integration Reader");
  const emailInput = page.getByLabel("Email Address");
  await expect(emailInput).toBeEditable();
  await emailInput.fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password").fill(password);
  await page.locator("#terms").check();
  await page.getByRole("button", { name: "Sign Up", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/);
  await expect(
    page.getByRole("status").filter({ hasText: "Your account is ready" }),
  ).toBeVisible();

  await expect(emailInput).toBeEditable();
  await emailInput.fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await expect(emailInput).toHaveValue(email);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(password);
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Integration Reader",
  );

  const cookies = await context.cookies();
  const session = cookies.find(function (cookie) {
    return cookie.name === "interestfinder_standard_session";
  });
  expect(session).toBeDefined();
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  expect(
    await page.evaluate(function () {
      return document.cookie;
    }),
  ).not.toContain("interestfinder_standard_session");

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Integration Reader",
  );
  const currentUser = await context.request.get("/api/auth/session");
  expect(currentUser.status()).toBe(200);
  const user = (await currentUser.json()).user;
  expect(user.email).toBe(email);

  // a direct backend login confirms that the browser registered a real account
  const backendLogin = await request.post(api + "/auth/login", {
    form: { username: email, password: password },
  });
  expect(backendLogin.status()).toBe(200);
  const token = (await backendLogin.json()).access_token;
  const backendUser = await request.get(api + "/auth/me", {
    headers: { Authorization: "Bearer " + token },
  });
  expect((await backendUser.json()).id).toBe(user.id);

  // these feature screens are placeholders, so exercise their real proxy routes
  const savedResponse = await context.request.post(
    "/api/backend/saved-items/",
    {
      headers: { Origin: origin },
      data: { item_id: 101 },
    },
  );
  expect(savedResponse.status()).toBe(201);
  const saved = await savedResponse.json();
  expect(saved.status).toBe("planned");
  expect(saved.user_id).toBe(user.id);
  const completed = await context.request.patch(
    "/api/backend/saved-items/" + saved.id,
    {
      headers: { Origin: origin },
      data: { status: "completed" },
    },
  );
  expect(completed.status()).toBe(200);
  expect((await completed.json()).completed_at).not.toBeNull();

  const reviewResponse = await context.request.post("/api/backend/reviews/", {
    headers: { Origin: origin },
    data: {
      item_id: 101,
      rating: 5,
      review_text: "Created through the frontend proxy.",
    },
  });
  expect(reviewResponse.status()).toBe(201);
  const review = await reviewResponse.json();
  const storedReview = await request.get(api + "/reviews/" + review.id);
  expect(storedReview.status()).toBe(200);
  expect(await storedReview.json()).toMatchObject({
    user_id: user.id,
    item_id: 101,
    rating: 5,
  });
  const storedSaves = await request.get(api + "/saved-items/", {
    headers: { Authorization: "Bearer " + token },
  });
  expect(await storedSaves.json()).toEqual([
    expect.objectContaining({ id: saved.id, status: "completed" }),
  ]);

  await page.getByRole("button", { name: "Log Out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Welcome Back",
  );
  expect((await context.request.get("/api/auth/session")).status()).toBe(401);
  expect(
    (await context.cookies()).some(function (cookie) {
      return cookie.name === "interestfinder_standard_session";
    }),
  ).toBe(false);
});
