"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import RatingStars from "./rating-stars";
import { deleteReview, updateReview } from "./reviews-api";
import type { Review } from "./types";
import { MAX_RATING, MAX_REVIEW_LENGTH, MIN_RATING } from "./types";

interface ReviewItemProps {
    review: Review;
    isOwn: boolean;
    onUpdated: (review: Review) => void;
    onDeleted: (reviewId: number) => void;
}

export default function ReviewItem(props: ReviewItemProps) {
    const review = props.review;
    const [editing, setEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [rating, setRating] = useState(review.rating);
    const [text, setText] = useState(review.review_text ?? "");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const date = new Date(review.updated_at).toLocaleDateString();

    function errorText(err: unknown) {
        if (err instanceof Error) {
            return err.message;
        }
        return "Something went wrong. Please try again.";
    }

    function startEditing() {
        setRating(review.rating);
        setText(review.review_text ?? "");
        setError("");
        setConfirmingDelete(false);
        setEditing(true);
    }

    async function handleSave() {
        if (busy) {
            return;
        }

        if (rating < MIN_RATING || rating > MAX_RATING) {
            setError("Please choose a rating from 1 to 5.");
            return;
        }

        setError("");
        setBusy(true);

        const trimmed = text.trim();

        try {
            const updated = await updateReview(review.id, {
                rating: rating,
                review_text: trimmed === "" ? null : trimmed,
            });
            setEditing(false);
            props.onUpdated(updated);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete() {
        if (busy) {
            return;
        }

        setError("");
        setBusy(true);

        try {
            await deleteReview(review.id);
            props.onDeleted(review.id);
        } catch (err) {
            setError(errorText(err));
            setBusy(false);
        }
    }

    const errorBox = error ? (
        <Alert variant="destructive" className="mt-2">
            <AlertDescription>{error}</AlertDescription>
        </Alert>
    ) : null;

    if (editing) {
        const ratings = [1, 2, 3, 4, 5];
        const fieldId = "edit-text-" + review.id;

        return (
            <li className="rounded-lg border p-4">
                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">
                        Your rating (1 to 5, 5 is best)
                    </legend>
                    <div className="flex gap-4">
                        {ratings.map(function (value) {
                            return (
                                <label key={value} className="flex items-center gap-1">
                                    <input
                                        type="radio"
                                        name={"edit-rating-" + review.id}
                                        value={value}
                                        checked={rating === value}
                                        disabled={busy}
                                        onChange={function () {
                                            setRating(value);
                                        }}
                                    />
                                    {value}
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                <div className="mt-3 space-y-2">
                    <Label htmlFor={fieldId}>Review (optional)</Label>
                    <textarea
                        id={fieldId}
                        rows={4}
                        maxLength={MAX_REVIEW_LENGTH}
                        value={text}
                        disabled={busy}
                        onChange={function (event) {
                            setText(event.target.value);
                        }}
                        className="w-full rounded-lg border bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                    />
                    <p className="text-xs text-muted-foreground">
                        {text.length} / {MAX_REVIEW_LENGTH}
                    </p>
                </div>

                {errorBox}

                <div className="mt-3 flex gap-2">
                    <Button type="button" onClick={handleSave} disabled={busy}>
                        {busy ? "Saving..." : "Save changes"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={function () {
                            setEditing(false);
                            setError("");
                        }}
                    >
                        Cancel
                    </Button>
                </div>
            </li>
        );
    }

    return (
        <li className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
                <RatingStars rating={review.rating} />
                <span className="text-sm text-muted-foreground">
                    {props.isOwn ? "You" : "Reader"} · {date}
                </span>
            </div>

            {review.review_text ? (
                <p className="mt-2 whitespace-pre-wrap">{review.review_text}</p>
            ) : null}

            {errorBox}

            {props.isOwn ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {confirmingDelete ? (
                        <>
                            <span className="self-center text-sm">
                                Delete this review?
                            </span>
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={busy}
                                onClick={handleDelete}
                            >
                                {busy ? "Deleting..." : "Yes, delete"}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={function () {
                                    setConfirmingDelete(false);
                                }}
                            >
                                Keep it
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button type="button" variant="outline" onClick={startEditing}>
                                Edit
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={function () {
                                    setError("");
                                    setConfirmingDelete(true);
                                }}
                            >
                                Delete
                            </Button>
                        </>
                    )}
                </div>
            ) : null}
        </li>
    );
}