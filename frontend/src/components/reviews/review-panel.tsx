"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import ReviewForm from "./review-form";
import ReviewList from "./review-list";
import { fetchReviews } from "./reviews-api";
import type { Review } from "./types";

interface ReviewPanelProps {
    itemId: number; // the local catalog id, not the external id
    currentUserId: number | null; // null for guests
}

export default function ReviewPanel(props: ReviewPanelProps) {
    const pathname = usePathname();
    const [reviews, setReviews] = useState<Review[] | null>(null);
    const [error, setError] = useState("");

    useEffect(
        function () {
            let cancelled = false;

            fetchReviews(props.itemId)
                .then(function (result) {
                    if (!cancelled) {
                        setReviews(result);
                    }
                })
                .catch(function (err: Error) {
                    if (!cancelled) {
                        setError(err.message);
                    }
                });

            return function () {
                cancelled = true;
            };
        },
        [props.itemId],
    );

    function handleCreated(review: Review) {
        setReviews(function (previous) {
            return [review, ...(previous ?? [])];
        });
    }

    function handleUpdated(updated: Review) {
        setReviews(function (previous) {
            return (previous ?? []).map(function (review) {
                if (review.id === updated.id) {
                    return updated;
                }
                return review;
            });
        });
    }

    function handleDeleted(reviewId: number) {
        setReviews(function (previous) {
            return (previous ?? []).filter(function (review) {
                return review.id !== reviewId;
            });
        });
    }


    let hasOwnReview = false;

    if (reviews !== null && props.currentUserId !== null) {
        hasOwnReview = reviews.some(function (review) {
            return review.user_id === props.currentUserId;
        });
    }

    let formArea = null;

    if (reviews !== null) {
        if (props.currentUserId === null) {
            formArea = (
                <p>
                    <Link
                        className="underline"
                        href={"/login?next=" + encodeURIComponent(pathname)}
                    >
                        Log in
                    </Link>{" "}
                    to write a review.
                </p>
            );
        } else if (hasOwnReview) {
            formArea = <p>You have already reviewed this item.</p>;
        } else {
            formArea = (
                <div className="space-y-2">
                    <h3 className="text-lg">Write a review</h3>
                    <p className="text-sm text-muted-foreground">
                        You can review items you have marked as completed in My Lists.
                    </p>
                    <ReviewForm itemId={props.itemId} onCreated={handleCreated} />
                </div>
            );
        }
    }

    return (
        <section aria-labelledby="reviews-heading" className="space-y-4">
            <h2 id="reviews-heading" className="text-2xl">
                InterestFinder reviews
            </h2>
            <p className="text-sm text-muted-foreground">
                Ratings from InterestFinder members, on a scale of 1 to 5. These are
                separate from provider ratings.
            </p>

            {error ? <p role="alert">{error}</p> : null}
            {reviews === null && !error ? <p>Loading reviews...</p> : null}
            {reviews ? (
                <ReviewList
                    reviews={reviews}
                    currentUserId={props.currentUserId}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                />
            ) : null}

            {formArea}
        </section>
    );
}