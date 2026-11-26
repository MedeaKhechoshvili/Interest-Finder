import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(function () {
    return { apiRequest: vi.fn() };
});

vi.mock("@/lib/api", function () {
    return { apiRequest };
});

import {
    deleteReview,
    fetchReviews,
    updateReview,
} from "@/components/reviews/reviews-api";

const review = {
    id: 1,
    user_id: 7,
    item_id: 5,
    rating: 4,
    review_text: "Great one",
    created_at: "2026-11-25T10:00:00Z",
    updated_at: "2026-11-25T10:00:00Z",
};

describe("reviews api helpers", function () {
    beforeEach(function () {
        apiRequest.mockReset();
    });

    it("fetches the reviews for a catalog item id", async function () {
        apiRequest.mockResolvedValue([review]);

        const result = await fetchReviews(5);

        expect(apiRequest).toHaveBeenCalledWith("/reviews?item_id=5");
        expect(result).toEqual([review]);
    });

    it("returns an empty list when the item has no reviews", async function () {
        apiRequest.mockResolvedValue([]);

        expect(await fetchReviews(5)).toEqual([]);
    });

    it("rejects a response that is not a list", async function () {
        apiRequest.mockResolvedValue({ data: [review] });

        await expect(fetchReviews(5)).rejects.toThrow(
            "The review list was not in the expected format.",
        );
    });

    it("passes request errors through to the caller", async function () {
        apiRequest.mockRejectedValue(new Error("The server is unavailable"));

        await expect(fetchReviews(5)).rejects.toThrow("The server is unavailable");
    });

    it("updates a review using the review id", async function () {
        const updated = { ...review, rating: 2 };
        apiRequest.mockResolvedValue(updated);

        const result = await updateReview(1, { rating: 2, review_text: null });

        expect(apiRequest).toHaveBeenCalledWith("/reviews/1", "PATCH", {
            rating: 2,
            review_text: null,
        });
        expect(result).toEqual(updated);
    });

    it("deletes a review using the review id", async function () {
        apiRequest.mockResolvedValue(null);

        await deleteReview(1);

        expect(apiRequest).toHaveBeenCalledWith("/reviews/1", "DELETE");
    });

    it("passes delete errors through to the caller", async function () {
        apiRequest.mockRejectedValue(new Error("Not allowed"));

        await expect(deleteReview(1)).rejects.toThrow("Not allowed");
    });
});