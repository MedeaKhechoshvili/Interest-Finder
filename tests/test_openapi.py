"""Validate the exported contract and its alignment with runtime behavior."""

from pathlib import Path

import yaml
from openapi_spec_validator import validate

from app.main import create_app


def test_exported_openapi_is_valid_and_matches_routes():
    exported = yaml.safe_load((Path(__file__).resolve().parents[1] / 'openapi.yaml').read_text(encoding='utf-8'))
    validate(exported)
    assert exported == create_app().openapi()


def test_errors_and_login_have_explicit_schemas():
    schema = create_app().openapi()
    review = schema['paths']['/api/v1/reviews/']['post']
    for status in ['401', '403', '404', '409', '422', '500']:
        assert review['responses'][status]['content']['application/json']['schema']['$ref'] == '#/components/schemas/ErrorResponse'
    error = schema['components']['schemas']['ErrorResponse']
    assert set(error['required']) == {'error', 'request_id'}
    assert schema['paths']['/api/v1/auth/login']['post']['responses']['200']['content']['application/json']['schema']['$ref'] == '#/components/schemas/TokenResponse'
    rating = schema['components']['schemas']['ReviewUpdate']['properties']['rating']
    assert rating['type'] == 'integer'
    assert 'anyOf' not in rating


def test_swagger_marks_protected_and_public_operations_correctly():
    paths = create_app().openapi()['paths']
    for path, method in [('/api/v1/auth/me', 'get'), ('/api/v1/saved-items/', 'get'),
                         ('/api/v1/saved-items/', 'post'), ('/api/v1/reviews/', 'post'),
                         ('/api/v1/reviews/{review_id}', 'patch'), ('/api/v1/reviews/{review_id}', 'delete')]:
        assert paths[path][method]['security']
    for path in ['/api/v1/health', '/api/v1/home', '/api/v1/items', '/api/v1/reviews/']:
        assert not paths[path]['get'].get('security')
