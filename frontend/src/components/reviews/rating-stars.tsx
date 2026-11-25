import { MAX_RATING } from "./types";

export default function RatingStars({ rating }: { rating: number }) {
    const filled = Math.max(0, Math.min(MAX_RATING, rating));

    return (
        <span role="img" aria-label={filled + " out of " + MAX_RATING + " stars"}>
            {"★".repeat(filled)}
            {"☆".repeat(MAX_RATING - filled)}
        </span>
    );
}