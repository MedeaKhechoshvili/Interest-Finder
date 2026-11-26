import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(function () {
    return { apiRequest: vi.fn() };
});

vi.mock("@/lib/api", function () {
    return { apiRequest };
});

import ReviewForm from "@/components/reviews/review-form";

const createdReview = {
    id: 10,
    user_id: 7,
    item_id: 5,
    rating: 5,
    review_text: "Loved it",
    created_at: "2026-11-25T10:00:00Z",
    updated_at: "2026-11-25T10:00:00Z",
};

function renderForm(onCreated = vi.fn()) {
    render(<ReviewForm itemId={5} onCreated={onCreated} />);
    return onCreated;
}

describe("ReviewForm", function () {
    beforeEach(function () {
        apiRequest.mockResolvedValue(createdReview);
    });

    it("asks for a rating and sends nothing when none is chosen", async function () {
        const user = userEvent.setup();
        const onCreated = renderForm();

        await user.click(screen.getByRole("button", { name: "Post review" }));

        expect(
            screen.getByText("Please choose a rating from 1 to 5."),
        ).toBeInTheDocument();
        expect(apiRequest).not.toHaveBeenCalled();
        expect(onCreated).not.toHaveBeenCalled();
    });

    it("posts the catalog id, rating and trimmed text, then resets the form", async function () {
        const user = userEvent.setup();
        const onCreated = renderForm();

        await user.click(screen.getByLabelText("5"));
        await user.type(screen.getByLabelText("Review (optional)"), "  Loved it  ");
        await user.click(screen.getByRole("button", { name: "Post review" }));

        expect(apiRequest).toHaveBeenCalledWith("/reviews", "POST", {
            item_id: 5,
            rating: 5,
            review_text: "Loved it",
        });
        expect(onCreated).toHaveBeenCalledWith(createdReview);
        expect(screen.getByLabelText("Review (optional)")).toHaveValue("");
        expect(screen.getByLabelText("5")).not.toBeChecked();
    });

    it("sends null review text when only a rating is given", async function () {
        const user = userEvent.setup();
        renderForm();

        await user.click(screen.getByLabelText("3"));
        await user.click(screen.getByRole("button", { name: "Post review" }));

        expect(apiRequest).toHaveBeenCalledWith("/reviews", "POST", {
            item_id: 5,
            rating: 3,
            review_text: null,
        });
    });

    it("shows the backend message and keeps what was typed when the request fails", async function () {
        const user = userEvent.setup();
        const onCreated = renderForm();

        apiRequest.mockRejectedValue(
            new Error("Save this item and mark it completed before reviewing it"),
        );

        await user.click(screen.getByLabelText("4"));
        await user.type(screen.getByLabelText("Review (optional)"), "Nice");
        await user.click(screen.getByRole("button", { name: "Post review" }));

        expect(
            await screen.findByText(
                "Save this item and mark it completed before reviewing it",
            ),
        ).toBeInTheDocument();
        expect(onCreated).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Review (optional)")).toHaveValue("Nice");
        expect(screen.getByLabelText("4")).toBeChecked();
        expect(screen.getByRole("button", { name: "Post review" })).toBeEnabled();
    });

    it("shows a generic message when the failure is not an Error", async function () {
        const user = userEvent.setup();
        renderForm();

        apiRequest.mockRejectedValue("boom");

        await user.click(screen.getByLabelText("2"));
        await user.click(screen.getByRole("button", { name: "Post review" }));

        expect(
            await screen.findByText("Could not save your review. Please try again."),
        ).toBeInTheDocument();
    });

    it("blocks a second submit while the first is still pending", async function () {
        const user = userEvent.setup();
        let finish!: (value: unknown) => void;

        apiRequest.mockImplementation(function () {
            return new Promise(function (resolve) {
                finish = resolve;
            });
        });

        const onCreated = renderForm();

        await user.click(screen.getByLabelText("5"));
        await user.click(screen.getByRole("button", { name: "Post review" }));

        const pending = screen.getByRole("button", { name: "Saving..." });
        expect(pending).toBeDisabled();

        await user.click(pending);
        expect(apiRequest).toHaveBeenCalledTimes(1);

        finish(createdReview);
        await vi.waitFor(function () {
            expect(onCreated).toHaveBeenCalledTimes(1);
        });
    });

    it("shows a live character count", async function () {
        const user = userEvent.setup();
        renderForm();

        expect(screen.getByText("0 / 2000")).toBeInTheDocument();

        await user.type(screen.getByLabelText("Review (optional)"), "Hello");

        expect(screen.getByText("5 / 2000")).toBeInTheDocument();
    });
});