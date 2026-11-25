import { apiRequest } from "@/lib/api";
import type { Review, ReviewUpdateBody } from "./types";

// the proxy adds the trailing slash that fastapi expects
export async function fetchReviews(itemId: number): Promise<Review[]> {
    const result = await apiRequest("/reviews?item_id=" + itemId);

    if (!Array.isArray(result)) {
        throw new Error("The review list was not in the expected format.");
    }

    return result as Review[];
}

export async function updateReview(
    reviewId: number,
    body: ReviewUpdateBody,
): Promise<Review> {
    const result = await apiRequest("/reviews/" + reviewId, "PATCH", body);
    return result as Review;
}

export async function deleteReview(reviewId: number): Promise<void> {
    await apiRequest("/reviews/" + reviewId, "DELETE");
}