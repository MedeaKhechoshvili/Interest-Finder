"""Tests for the shared provider error handling in base.py.

TMDB is used as the example provider, but every adapter goes through the same
_get_json helper, so these rules apply to all four providers.
"""

import httpx
import pytest

from app.core.errors import AppError
from app.services.providers.tmdb import TMDBProvider
from tests.provider_helpers import run_provider


def get_movie(provider: TMDBProvider):
    return provider.get_details("550")


def test_timeout_becomes_provider_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("too slow", request=request)

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, get_movie)
    assert error.value.status_code == 502
    assert error.value.code == "PROVIDER_TIMEOUT"


def test_connection_error_becomes_provider_unavailable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no internet", request=request)

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, get_movie)
    assert error.value.status_code == 502
    assert error.value.code == "PROVIDER_UNAVAILABLE"


@pytest.mark.parametrize("status_code", [401, 429, 500, 503])
def test_error_status_becomes_provider_unavailable(status_code: int) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code)

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, get_movie)
    assert error.value.status_code == 502
    assert error.value.code == "PROVIDER_UNAVAILABLE"
    assert error.value.details == {"status_code": status_code}


def test_provider_404_becomes_item_not_found() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"status_message": "not found"})

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, get_movie)
    assert error.value.status_code == 404
    assert error.value.code == "ITEM_NOT_FOUND"


def test_non_json_body_becomes_invalid_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>maintenance</html>")

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, get_movie)
    assert error.value.status_code == 502
    assert error.value.code == "PROVIDER_INVALID_RESPONSE"


def test_error_messages_never_contain_api_keys() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, get_movie)
    assert "test-token" not in str(error.value.message)
    assert "test-token" not in str(error.value.details)
