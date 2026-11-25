// shapes match the backend ReviewRead, ReviewCreate and ReviewUpdate schemas
export interface Review {
    id: number; // the review record id, used for edit and delete
    user_id: number;
    item_id: number; // the local catalog id
    rating: number; // whole number from 1 to 5
    review_text: string | null;
    created_at: string | null;
    updated_at: string;
}

export interface ReviewCreateBody {
    item_id: number;
    rating: number;
    review_text?: string | null;
}

export interface ReviewUpdateBody {
    rating?: number;
    review_text?: string | null;
}

export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const MAX_REVIEW_LENGTH = 2000;