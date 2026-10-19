"""Shared response schemas used by the foundation and future routes."""

from pydantic import BaseModel, ConfigDict


class HealthData(BaseModel):
    status: str
    service: str
    version: str


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    data: HealthData
    request_id: str
