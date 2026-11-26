import { test, expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const origin = "http://localhost:3001";

async function registerAndLogIn(page: Page, email: string, password: string) {
    await page.goto("/register");
    await expect(page.getByLabel("Full Name")).toBeEditable();
    await page.getByLabel("Full Name").fill("Review Integration User");
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
    await expect(emailInput).toHaveValue(email);
    await page.getByRole("button", { name: "Log In", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
}

// desktop and mobile run against the same temporary database,
// so each project uses its own fixture item
function fixtureItem(projectName: string) {
    if (projectName === "mobile") {
        return "movies-home-2";
    }
    return "movies-home-1";
}

function reviewSection(page: Page) {
    return page.locator('section[aria-labelledby="reviews-heading"]');
}

async function storedReviews(context: BrowserContext, itemId: number) {
    const response = await context.request.get(
        "/api/backend/reviews?item_id=" + itemId,
    );
    expect(response.status()).toBe(200);
    return await response.json();
}

test("a user can post, edit and delete a review on a Detail page", async ({
    page,
    context,
}, testInfo) => {
    const externalId = fixtureItem(testInfo.project.name);
    const email = "reviews-" + randomUUID() + "@example.com";
    const password = randomUUID() + "-password";

    await registerAndLogIn(page, email, password);

    const sessionResponse = await context.request.get("/api/auth/session");
    expect(sessionResponse.status()).toBe(200);
    const user = (await sessionResponse.json()).user;

    // the detail endpoint stores the fixture item and returns its local catalog id
    const detail = await context.request.get(
        "/api/backend/items/movies/" + externalId,
    );
    expect(detail.status()).toBe(200);
    const catalogId = (await detail.json()).data.id;
    expect(typeof catalogId).toBe("number");

    const reviews = reviewSection(page);

    await page.goto("/items/movies/" + externalId);
    await expect(
        reviews.getByRole("heading", { name: "InterestFinder reviews" }),
    ).toBeVisible();
    await expect(reviews.getByText("No InterestFinder reviews yet.")).toBeVisible();

    // the backend refuses a review before the item is completed
    await reviews.getByLabel("5", { exact: true }).check();
    await reviews.getByRole("button", { name: "Post review" }).click();
    await expect(
        reviews.getByText("Save this item and mark it completed before reviewing it"),
    ).toBeVisible();
    expect(await storedReviews(context, catalogId)).toEqual([]);

    // save and complete the item through the real proxy
    const saved = await context.request.post("/api/backend/saved-items/", {
        headers: { Origin: origin },
        data: { item_id: catalogId },
    });
    expect(saved.status()).toBe(201);
    const savedItem = await saved.json();

    const completed = await context.request.patch(
        "/api/backend/saved-items/" + savedItem.id,
        {
            headers: { Origin: origin },
            data: { status: "completed" },
        },
    );
    expect(completed.status()).toBe(200);

    // post the review through the form (the rating from above is still chosen)
    await reviews
        .getByLabel("Review (optional)")
        .fill("Posted by the integration test.");
    await reviews.getByRole("button", { name: "Post review" }).click();

    await expect(reviews.getByText("Posted by the integration test.")).toBeVisible();
    await expect(
        reviews.getByText("You have already reviewed this item."),
    ).toBeVisible();

    const afterCreate = await storedReviews(context, catalogId);
    expect(afterCreate).toHaveLength(1);
    expect(afterCreate[0]).toMatchObject({
        user_id: user.id,
        item_id: catalogId,
        rating: 5,
        review_text: "Posted by the integration test.",
    });

    // the review is still there, with author controls, after a reload
    await page.reload();
    await expect(reviews.getByText("Posted by the integration test.")).toBeVisible();
    await expect(
        reviews.getByRole("button", { name: "Edit", exact: true }),
    ).toBeVisible();

    // edit
    await reviews.getByRole("button", { name: "Edit", exact: true }).click();
    await reviews.getByLabel("2", { exact: true }).check();
    await reviews
        .getByLabel("Review (optional)")
        .fill("Edited by the integration test.");
    await reviews.getByRole("button", { name: "Save changes" }).click();

    await expect(reviews.getByText("Edited by the integration test.")).toBeVisible();
    await expect(
        reviews.getByText("Posted by the integration test."),
    ).toHaveCount(0);

    const afterEdit = await storedReviews(context, catalogId);
    expect(afterEdit).toHaveLength(1);
    expect(afterEdit[0]).toMatchObject({
        id: afterCreate[0].id,
        rating: 2,
        review_text: "Edited by the integration test.",
    });

    // delete, with the confirmation step
    await reviews.getByRole("button", { name: "Delete", exact: true }).click();
    await reviews.getByRole("button", { name: "Yes, delete" }).click();

    await expect(reviews.getByText("No InterestFinder reviews yet.")).toBeVisible();
    await expect(reviews.getByText("Write a review")).toBeVisible();
    expect(await storedReviews(context, catalogId)).toEqual([]);
});

test("guests can read the review section but are asked to log in", async ({
    page,
}, testInfo) => {
    const externalId = fixtureItem(testInfo.project.name);
    const reviews = reviewSection(page);

    await page.goto("/items/movies/" + externalId);

    await expect(
        reviews.getByRole("heading", { name: "InterestFinder reviews" }),
    ).toBeVisible();
    await expect(reviews.getByText(/scale of 1 to 5/)).toBeVisible();
    await expect(reviews.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(
        reviews.getByRole("button", { name: "Post review" }),
    ).toHaveCount(0);

    // the review section must fit inside the screen on desktop and mobile
    const box = await reviews.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
});