"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Review, ReviewCreateBody } from "./types";
import { MAX_RATING, MAX_REVIEW_LENGTH, MIN_RATING } from "./types";

interface ReviewFormProps {
    itemId: number; // the local catalog id
    onCreated: (review: Review) => void;
}

export default function ReviewForm(props: ReviewFormProps) {
    const [rating, setRating] = useState(0);
    const [text, setText] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (submitting) {
            return;
        }

        if (rating < MIN_RATING || rating > MAX_RATING) {
            setError("Please choose a rating from 1 to 5.");
            return;
        }

        if (text.length > MAX_REVIEW_LENGTH) {
            setError("Reviews can be at most " + MAX_REVIEW_LENGTH + " characters.");
            return;
        }

        setError("");
        setSubmitting(true);

        const trimmed = text.trim();
        const body: ReviewCreateBody = {
            item_id: props.itemId,
            rating: rating,
            review_text: trimmed === "" ? null : trimmed,
        };

        try {
            const created = (await apiRequest("/reviews", "POST", body)) as Review;
            setRating(0);
            setText("");
            props.onCreated(created);
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Could not save your review. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    }

    const ratings = [1, 2, 3, 4, 5];

    return (
        <form onSubmit={handleSubmit} aria-busy={submitting} className="space-y-4">
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
                                    name="rating"
                                    value={value}
                                    checked={rating === value}
                                    disabled={submitting}
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

            <div className="space-y-2">
                <Label htmlFor="review-text">Review (optional)</Label>
                <textarea
                    id="review-text"
                    name="review_text"
                    rows={4}
                    maxLength={MAX_REVIEW_LENGTH}
                    value={text}
                    disabled={submitting}
                    onChange={function (event) {
                        setText(event.target.value);
                    }}
                    className="w-full rounded-lg border bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                />
                <p className="text-xs text-muted-foreground">
                    {text.length} / {MAX_REVIEW_LENGTH}
                </p>
            </div>

            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}

            <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Post review"}
            </Button>
        </form>
    );
}