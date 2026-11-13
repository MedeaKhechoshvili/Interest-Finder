"""Document the same error envelopes returned by our exception handlers."""

from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody
    request_id: str


# Runtime errors raised by each operation; validation errors are added below
# where FastAPI already documents them. Paths are the implemented API contract.
ERRORS = {
    ('/api/v1/auth/register', 'post'): [409],
    ('/api/v1/auth/login', 'post'): [401],
    ('/api/v1/auth/me', 'get'): [401],
    ('/api/v1/saved-items/', 'get'): [401],
    ('/api/v1/saved-items/', 'post'): [401, 404, 409],
    ('/api/v1/saved-items/{saved_item_id}', 'patch'): [401, 404],
    ('/api/v1/saved-items/{saved_item_id}', 'delete'): [401, 404],
    ('/api/v1/reviews/', 'post'): [401, 403, 404, 409],
    ('/api/v1/reviews/{review_id}', 'get'): [404],
    ('/api/v1/reviews/{review_id}', 'patch'): [400, 401, 404],
    ('/api/v1/reviews/{review_id}', 'delete'): [401, 404],
    ('/api/v1/items', 'get'): [502],
    ('/api/v1/items/{category}/{external_id}', 'get'): [404, 502],
}
DESCRIPTIONS = {
    400: 'No review changes supplied.',
    401: 'Authentication is missing, invalid, or expired.',
    403: 'The item must be saved and completed by the current user before review creation.',
    404: 'Resource not found or not owned by the current user.',
    409: 'An account, saved item, or review already exists.',
    422: 'Invalid request data. Submitted values are omitted from validation details.',
    500: 'Unexpected server error; internal details are not exposed.',
    502: 'An external provider failed, timed out, or returned unusable data.',
}


def install_openapi_schema(application: FastAPI) -> None:
    def custom_openapi():
        if application.openapi_schema is not None:
            return application.openapi_schema
        schema = get_openapi(
            title=application.title, version=application.version,
            description=application.description, routes=application.routes,
            openapi_version=application.openapi_version,
        )
        error_schema = ErrorResponse.model_json_schema(ref_template='#/components/schemas/{model}')
        schemas = schema.setdefault('components', {}).setdefault('schemas', {})
        schemas.update(error_schema.pop('$defs', {}))
        schemas['ErrorResponse'] = error_schema
        for path, operations in schema['paths'].items():
            for method, operation in operations.items():
                if method not in {'get', 'post', 'patch', 'put', 'delete', 'options', 'head'}:
                    continue
                codes = set(ERRORS.get((path, method), [])) | {500}
                if '422' in operation['responses']:
                    codes.add(422)
                for code in sorted(codes):
                    operation['responses'][str(code)] = {
                        'description': DESCRIPTIONS[code],
                        'content': {'application/json': {'schema': {'$ref': '#/components/schemas/ErrorResponse'}}},
                    }
        application.openapi_schema = schema
        return schema

    application.openapi = custom_openapi
