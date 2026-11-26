import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateReview, deleteReview } = vi.hoisted(function () {
    return { updateReview: vi.fn(), deleteReview: vi.fn() };
});

vi.mock("@/components/reviews/reviews-api", function () {
    return { updateReview, deleteReview };
});

import ReviewItem from "@/components/reviews/review-item";
import type { Review } from "@/components/reviews/types";

const review: Review = {
    id: 1,
    user_id: 7,
    item_id: 5,
    rating: 4,
    review_text: "Great one",
    created_at: "2026-11-25T10:00:00Z",
    updated_at: "2026-11-25T10:00:00Z",
};

const updatedReview: Review = {
    ...review,
    rating: 2,
    review_text: "Changed my mind",
};

function renderItem(isOwn = true) {
    const onUpdated = vi.fn();
    const onDeleted = vi.fn();

    render(
        <ul>
            <ReviewItem
                review={review}
                isOwn={isOwn}
                onUpdated={onUpdated}
                onDeleted={onDeleted}
            />
        </ul>,
    );

    return { onUpdated, onDeleted };
}

describe("ReviewItem editing", function () {
    beforeEach(function () {
        updateReview.mockResolvedValue(updatedReview);
        deleteReview.mockResolvedValue(undefined);
    });

    it("opens the edit form filled with the current rating and text", async function () {
        const user = userEvent.setup();
        renderItem();

        await user.click(screen.getByRole("button", { name: "Edit" }));

        expect(screen.getByLabelText("4")).toBeChecked();
        expect(screen.getByLabelText("Review (optional)")).toHaveValue("Great one");
    });

    it("saves changes using the review id and reports the updated review", async function () {
        const user = userEvent.setup();
        const { onUpdated } = renderItem();

        await user.click(screen.getByRole("button", { name: "Edit" }));
        await user.click(screen.getByLabelText("2"));
        await user.clear(screen.getByLabelText("Review (optional)"));
        await user.type(
            screen.getByLabelText("Review (optional)"),
            "Changed my mind",
        );
        await user.click(screen.getByRole("button", { name: "Save changes" }));

        expect(updateReview).toHaveBeenCalledWith(1, {
            rating: 2,
            review_text: "Changed my mind",
        });
        expect(onUpdated).toHaveBeenCalledWith(updatedReview);
        expect(
            screen.queryByRole("button", { name: "Save changes" }),
        ).not.toBeInTheDocument();
    });

    it("sends null when the review text is cleared", async function () {
        const user = userEvent.setup();
        renderItem();

        await user.click(screen.getByRole("button", { name: "Edit" }));
        await user.clear(screen.getByLabelText("Review (optional)"));
        await user.click(screen.getByRole("button", { name: "Save changes" }));

        expect(updateReview).toHaveBeenCalledWith(1, {
            rating: 4,
            review_text: null,
        });
    });

    it("discards changes when cancelled", async function () {
        const user = userEvent.setup();
        const { onUpdated } = renderItem();

        await user.click(screen.getByRole("button", { name: "Edit" }));
        await user.click(screen.getByLabelText("1"));
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(updateReview).not.toHaveBeenCalled();
        expect(onUpdated).not.toHaveBeenCalled();
        expect(screen.getByText("Great one")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "4 out of 5 stars" })).toBeInTheDocument();
    });

    it("stays in edit mode and shows the message when saving fails", async function () {
        const user = userEvent.setup();
        const { onUpdated } = renderItem();

        updateReview.mockRejectedValue(new Error("The server is unavailable"));

        await user.click(screen.getByRole("button", { name: "Edit" }));
        await user.click(screen.getByLabelText("3"));
        await user.click(screen.getByRole("button", { name: "Save changes" }));

        expect(
            await screen.findByText("The server is unavailable"),
        ).toBeInTheDocument();
        expect(onUpdated).not.toHaveBeenCalled();
        expect(screen.getByLabelText("3")).toBeChecked();
        expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    });

    it("shows a generic message when the failure is not an Error", async function () {
        const user = userEvent.setup();
        renderItem();

        updateReview.mockRejectedValue("boom");

        await user.click(screen.getByRole("button", { name: "Edit" }));
        await user.click(screen.getByRole("button", { name: "Save changes" }));

        expect(
            await screen.findByText("Something went wrong. Please try again."),
        ).toBeInTheDocument();
    });
});

describe("ReviewItem deleting", function () {
    beforeEach(function () {
        deleteReview.mockResolvedValue(undefined);
    });

    it("asks for confirmation before deleting and lets the user back out", async function () {
        const user = userEvent.setup();
        const { onDeleted } = renderItem();

        await user.click(screen.getByRole("button", { name: "Delete" }));

        expect(screen.getByText("Delete this review?")).toBeInTheDocument();
        expect(deleteReview).not.toHaveBeenCalled();

        await user.click(screen.getByRole("button", { name: "Keep it" }));

        expect(screen.queryByText("Delete this review?")).not.toBeInTheDocument();
        expect(onDeleted).not.toHaveBeenCalled();
    });

    it("deletes by review id after confirmation", async function () {
        const user = userEvent.setup();
        const { onDeleted } = renderItem();

        await user.click(screen.getByRole("button", { name: "Delete" }));
        await user.click(screen.getByRole("button", { name: "Yes, delete" }));

        expect(deleteReview).toHaveBeenCalledWith(1);
        expect(onDeleted).toHaveBeenCalledWith(1);
    });

    it("keeps the review and shows the message when deleting fails", async function () {
        const user = userEvent.setup();
        const { onDeleted } = renderItem();

        deleteReview.mockRejectedValue(new Error("The server is unavailable"));

        await user.click(screen.getByRole("button", { name: "Delete" }));
        await user.click(screen.getByRole("button", { name: "Yes, delete" }));

        expect(
            await screen.findByText("The server is unavailable"),
        ).toBeInTheDocument();
        expect(onDeleted).not.toHaveBeenCalled();
        expect(screen.getByText("Great one")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Yes, delete" })).toBeEnabled();
    });

    it("shows no edit or delete controls on someone else's review", function () {
        renderItem(false);

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
});