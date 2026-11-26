import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/reviews/reviews-api", () => ({
    updateReview: vi.fn(),
    deleteReview: vi.fn(),
}));

import ReviewList from "@/components/reviews/review-list";
import type { Review } from "@/components/reviews/types";

function makeReview(overrides: Partial<Review> = {}): Review {
    return {
        id: 1,
        user_id: 7,
        item_id: 5,
        rating: 4,
        review_text: "Great one",
        created_at: "2026-11-25T10:00:00Z",
        updated_at: "2026-11-25T10:00:00Z",
        ...overrides,
    };
}

function renderList(reviews: Review[], currentUserId: number | null) {
    return render(
        <ReviewList
            reviews={reviews}
            currentUserId={currentUserId}
            onUpdated={vi.fn()}
            onDeleted={vi.fn()}
        />,
    );
}

describe("ReviewList", function () {
    it("shows an empty state when there are no reviews", function () {
        renderList([], null);

        expect(
            screen.getByText("No InterestFinder reviews yet."),
        ).toBeInTheDocument();
    });

    it("shows the star rating and review text", function () {
        renderList([makeReview()], null);

        expect(screen.getByRole("img", { name: "4 out of 5 stars" })).toBeInTheDocument();
        expect(screen.getByText("Great one")).toBeInTheDocument();
    });

    it("shows a rating-only review without any text", function () {
        renderList([makeReview({ rating: 2, review_text: null })], null);

        expect(screen.getByRole("img", { name: "2 out of 5 stars" })).toBeInTheDocument();
        expect(screen.queryByText("Great one")).not.toBeInTheDocument();
    });

    it("labels the current user's review and shows edit and delete only on it", function () {
        renderList(
            [
                makeReview({ id: 1, user_id: 7 }),
                makeReview({ id: 2, user_id: 8, review_text: "Someone else" }),
            ],
            7,
        );

        expect(screen.getByText(/^You ·/)).toBeInTheDocument();
        expect(screen.getByText(/^Reader ·/)).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
        expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
    });

    it("shows no edit or delete controls to guests", function () {
        renderList([makeReview()], null);

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(screen.getByText(/^Reader ·/)).toBeInTheDocument();
    });

    it("renders review text as plain text, not HTML", function () {
        const risky = "<b>bold</b><script>alert(1)</script>";
        const { container } = renderList([makeReview({ review_text: risky })], null);

        expect(screen.getByText(risky)).toBeInTheDocument();
        expect(container.querySelector("b")).toBeNull();
        expect(container.querySelector("script")).toBeNull();
    });
});