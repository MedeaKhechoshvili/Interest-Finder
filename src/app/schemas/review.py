from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewCreate(BaseModel):
    item_id: int
    rating: int = Field(ge=1, le=5)
    review_text: str | None = Field(default=None, max_length=2000)


class ReviewUpdate(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    review_text: str | None = Field(default=None, max_length=2000)

    @field_validator("rating")
    @classmethod
    def reject_null_rating(cls, value: int | None) -> int:
        # Omitted fields keep their default without running this validator.
        if value is None:
            raise ValueError("Rating cannot be null; omit it to keep the current rating")
        return value


class ReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    item_id: int
    rating: int
    review_text: str | None
    created_at: datetime | None
    updated_at: datetime
