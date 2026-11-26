import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchReviews, updateReview, deleteReview, apiRequest } = vi.hoisted(
    function () {
        return {
            fetchReviews: vi.fn(),
            updateReview: vi.fn(),
            deleteReview: vi.fn(),
            apiRequest: vi.fn(),
        };
    },
);

vi.mock("@/components/reviews/reviews-api", function () {
    return { fetchReviews, updateReview, deleteReview };
});

// the create form calls apiRequest directly
vi.mock("@/lib/api", function () {
    return { apiRequest };
});

vi.mock("next/navigation", function () {
    return {
        usePathname: function () {
            return "/items/music/abc";
        }
    };
});

import ReviewPanel from "@/components/reviews/review-panel";
import type { Review } from "@/components/reviews/types";

function makeReview(overrides: Partial<Review> = {}): Review {
    return {
        id: 1,
        user_id: 8,
        item_id: 5,
        rating: 4,
        review_text: "Someone else's review",
        created_at: "2026-11-25T10:00:00Z",
        updated_at: "2026-11-25T10:00:00Z",
        ...overrides,
    };
}

const ownReview = makeReview({
    id: 2,
    user_id: 7,
    review_text: "My own review",
});

describe("ReviewPanel", function () {
    beforeEach(function () {
        fetchReviews.mockResolvedValue([]);
    });

    it("explains that these are InterestFinder ratings on a 1 to 5 scale", async function () {
        render(<ReviewPanel itemId={5} currentUserId={null} />);

        expect(
            screen.getByRole("heading", { name: "InterestFinder reviews" }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/scale of 1 to 5.*separate from provider ratings/),
        ).toBeInTheDocument();
        await screen.findByText("No InterestFinder reviews yet.");
    });

    it("shows a loading message, then the reviews for the item", async function () {
        let finish!: (value: Review[]) => void;

        fetchReviews.mockImplementation(function () {
            return new Promise(function (resolve) {
                finish = resolve;
            });
        });

        render(<ReviewPanel itemId={5} currentUserId={null} />);

        expect(screen.getByText("Loading reviews...")).toBeInTheDocument();
        expect(fetchReviews).toHaveBeenCalledWith(5);

        finish([makeReview()]);

        expect(
            await screen.findByText("Someone else's review"),
        ).toBeInTheDocument();
        expect(screen.queryByText("Loading reviews...")).not.toBeInTheDocument();
    });

    it("shows an error and no review form when loading fails", async function () {
        fetchReviews.mockRejectedValue(new Error("The server is unavailable"));

        render(<ReviewPanel itemId={5} currentUserId={7} />);

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "The server is unavailable",
        );
        expect(screen.queryByText("Loading reviews...")).not.toBeInTheDocument();
        expect(screen.queryByText("Write a review")).not.toBeInTheDocument();
    });

    it("asks guests to log in instead of showing the form", async function () {
        fetchReviews.mockResolvedValue([makeReview()]);

        render(<ReviewPanel itemId={5} currentUserId={null} />);

        const link = await screen.findByRole("link", { name: "Log in" });

        expect(link).toHaveAttribute(
            "href",
            "/login?next=" + encodeURIComponent("/items/music/abc"),
        );
        expect(screen.queryByText("Write a review")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Post review" })).toBeNull();
    });

    it("shows the review form to a logged-in user who has not reviewed yet", async function () {
        fetchReviews.mockResolvedValue([makeReview()]);

        render(<ReviewPanel itemId={5} currentUserId={7} />);

        expect(await screen.findByText("Write a review")).toBeInTheDocument();
        expect(
            screen.getByText(/items you have marked as completed/),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Post review" }),
        ).toBeInTheDocument();
    });

    it("replaces the form with a message when the user already reviewed", async function () {
        fetchReviews.mockResolvedValue([ownReview]);

        render(<ReviewPanel itemId={5} currentUserId={7} />);

        expect(
            await screen.findByText("You have already reviewed this item."),
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Post review" })).toBeNull();
    });

    it("adds a newly posted review to the top and removes the form", async function () {
        const user = userEvent.setup();

        fetchReviews.mockResolvedValue([makeReview()]);
        apiRequest.mockResolvedValue(
            makeReview({ id: 3, user_id: 7, rating: 5, review_text: "Just posted" }),
        );

        render(<ReviewPanel itemId={5} currentUserId={7} />);

        await screen.findByText("Write a review");
        await user.click(screen.getByLabelText("5"));
        await user.type(screen.getByLabelText("Review (optional)"), "Just posted");
        await user.click(screen.getByRole("button", { name: "Post review" }));

        expect(await screen.findByText("Just posted")).toBeInTheDocument();
        expect(
            screen.getByText("You have already reviewed this item."),
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Post review" })).toBeNull();

        const items = screen.getAllByRole("listitem");
        expect(items[0]).toHaveTextContent("Just posted");
        expect(items[1]).toHaveTextContent("Someone else's review");
    });

    it("shows an edited review in place", async function () {
        const user = userEvent.setup();

        fetchReviews.mockResolvedValue([ownReview]);
        updateReview.mockResolvedValue({
            ...ownReview,
            rating: 2,
            review_text: "Edited text",
        });

        render(<ReviewPanel itemId={5} currentUserId={7} />);

        await user.click(await screen.findByRole("button", { name: "Edit" }));
        await user.click(screen.getByLabelText("2"));
        await user.click(screen.getByRole("button", { name: "Save changes" }));

        expect(await screen.findByText("Edited text")).toBeInTheDocument();
        expect(screen.queryByText("My own review")).not.toBeInTheDocument();
        expect(
            screen.getByRole("img", { name: "2 out of 5 stars" }),
        ).toBeInTheDocument();
        expect(updateReview).toHaveBeenCalledWith(2, {
            rating: 2,
            review_text: "My own review",
        });
    });

    it("removes a deleted review and brings the form back", async function () {
        const user = userEvent.setup();

        fetchReviews.mockResolvedValue([ownReview]);
        deleteReview.mockResolvedValue(undefined);

        render(<ReviewPanel itemId={5} currentUserId={7} />);

        await user.click(await screen.findByRole("button", { name: "Delete" }));
        await user.click(screen.getByRole("button", { name: "Yes, delete" }));

        expect(
            await screen.findByText("No InterestFinder reviews yet."),
        ).toBeInTheDocument();
        expect(deleteReview).toHaveBeenCalledWith(2);
        expect(screen.getByText("Write a review")).toBeInTheDocument();
    });

    it("loads the reviews again when the item changes", async function () {
        fetchReviews.mockResolvedValueOnce([makeReview()]);
        fetchReviews.mockResolvedValueOnce([
            makeReview({ id: 9, item_id: 6, review_text: "Review for item six" }),
        ]);

        const { rerender } = render(<ReviewPanel itemId={5} currentUserId={null} />);

        await screen.findByText("Someone else's review");

        rerender(<ReviewPanel itemId={6} currentUserId={null} />);

        expect(await screen.findByText("Review for item six")).toBeInTheDocument();
        expect(fetchReviews).toHaveBeenLastCalledWith(6);
    });
});