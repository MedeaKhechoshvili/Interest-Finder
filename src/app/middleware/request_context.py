"""Request IDs and safe request logging middleware."""

import logging
import re
from time import perf_counter
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach a correlation ID and log request metadata without secrets."""

    async def dispatch(self, request: Request, call_next) -> Response:
        incoming_id = request.headers.get("X-Request-ID", "")
        request_id = incoming_id if REQUEST_ID_PATTERN.fullmatch(incoming_id) else str(uuid4())
        request.state.request_id = request_id
        started = perf_counter()
        response: Response | None = None

        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            duration_ms = (perf_counter() - started) * 1000
            status_code = response.status_code if response is not None else 500
            logger.info(
                "request method=%s path=%s status=%s duration_ms=%.2f request_id=%s",
                request.method,
                request.url.path,
                status_code,
                duration_ms,
                request_id,
            )
