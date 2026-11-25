import ReviewItem from "./review-item";
import type { Review } from "./types";

interface ReviewListProps {
    reviews: Review[];
    currentUserId: number | null;
    onUpdated: (review: Review) => void;
    onDeleted: (reviewId: number) => void;
}

export default function ReviewList(props: ReviewListProps) {
    if (props.reviews.length === 0) {
        return <p>No InterestFinder reviews yet.</p>;
    }

    return (
        <ul className="space-y-4">
            {props.reviews.map(function (review) {
                return (
                    <ReviewItem
                        key={review.id}
                        review={review}
                        isOwn={
                            props.currentUserId !== null &&
                            review.user_id === props.currentUserId
                        }
                        onUpdated={props.onUpdated}
                        onDeleted={props.onDeleted}
                    />
                );
            })}
        </ul>
    );
}