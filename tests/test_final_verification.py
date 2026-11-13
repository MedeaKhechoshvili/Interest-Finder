"""Issue #25: authorization, business rules, failure responses and CRUD."""

import secrets

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Review
from tests.test_saved_items import workflow_client  # noqa: F401


def login(client, email):
    password = secrets.token_urlsafe(24)
    response = client.post('/api/v1/auth/register', json={
        'full_name': 'Integration User', 'email': email,
        'password': password, 'terms_accepted': True,
    })
    assert response.status_code == 201, response.text
    response = client.post('/api/v1/auth/login', data={'username': email, 'password': password})
    assert response.status_code == 200, response.text
    return {'Authorization': 'Bearer ' + response.json()['access_token']}


def assert_error(response, status):
    assert response.status_code == status, response.text
    body = response.json()
    assert set(body) == {'error', 'request_id'}
    assert set(body['error']) == {'code', 'message', 'details'}
    assert body['error']['code'] == ('VALIDATION_ERROR' if status == 422 else f'HTTP_{status}')
    assert body['request_id'] == response.headers['X-Request-ID']


def completed_review(client, item_id, headers):
    saved = client.post('/api/v1/saved-items/', json={'item_id': item_id}, headers=headers)
    assert saved.status_code == 201
    saved_id = saved.json()['id']
    assert client.patch(f'/api/v1/saved-items/{saved_id}', json={'status': 'completed'}, headers=headers).status_code == 200
    review = client.post('/api/v1/reviews/', json={'item_id': item_id, 'rating': 4}, headers=headers)
    assert review.status_code == 201, review.text
    return saved_id, review.json()['id']


@pytest.mark.parametrize('method,path,body', [
    ('GET', '/auth/me', None), ('GET', '/saved-items/', None),
    ('POST', '/saved-items/', {'item_id': 101}),
    ('PATCH', '/saved-items/1', {'status': 'completed'}),
    ('DELETE', '/saved-items/1', None),
    ('POST', '/reviews/', {'item_id': 101, 'rating': 5}),
    ('PATCH', '/reviews/1', {'rating': 3}), ('DELETE', '/reviews/1', None),
])
def test_guest_cannot_use_protected_routes(workflow_client, method, path, body):
    client, _, _ = workflow_client
    response = client.request(method, '/api/v1' + path, json=body)
    assert_error(response, 401)
    assert response.headers['WWW-Authenticate'] == 'Bearer'


@pytest.mark.parametrize('state', ['unsaved', 'planned', 'other_user_completed'])
def test_review_requires_own_completed_item(workflow_client, state):
    client, engine, item_id = workflow_client
    headers = login(client, 'reviewer@example.com')
    if state != 'unsaved':
        owner = login(client, 'other@example.com') if state == 'other_user_completed' else headers
        saved = client.post('/api/v1/saved-items/', json={'item_id': item_id}, headers=owner)
        assert saved.status_code == 201
        if state == 'other_user_completed':
            assert client.patch(f"/api/v1/saved-items/{saved.json()['id']}", json={'status': 'completed'}, headers=owner).status_code == 200
    response = client.post('/api/v1/reviews/', json={'item_id': item_id, 'rating': 5}, headers=headers)
    assert_error(response, 403)
    with Session(engine) as session:
        assert session.scalars(select(Review)).all() == []


@pytest.mark.parametrize('method', ['PATCH', 'DELETE'])
@pytest.mark.parametrize('resource', ['saved-items', 'reviews'])
def test_other_user_cannot_change_or_delete_records(workflow_client, method, resource):
    client, _, item_id = workflow_client
    owner = login(client, 'owner@example.com')
    stranger = login(client, 'stranger@example.com')
    saved_id, review_id = completed_review(client, item_id, owner)
    record_id = saved_id if resource == 'saved-items' else review_id
    body = {'status': 'planned'} if resource == 'saved-items' else {'rating': 1}
    before_saved = client.get('/api/v1/saved-items/', headers=owner).json()
    before_review = client.get(f'/api/v1/reviews/{review_id}').json()
    response = client.request(method, f'/api/v1/{resource}/{record_id}', json=body if method == 'PATCH' else None, headers=stranger)
    assert_error(response, 404)
    assert client.get('/api/v1/saved-items/', headers=stranger).json() == []
    assert client.get('/api/v1/saved-items/', headers=owner).json() == before_saved
    assert client.get(f'/api/v1/reviews/{review_id}').json() == before_review


def test_duplicates_updates_and_owner_deletion(workflow_client):
    client, _, item_id = workflow_client
    owner = login(client, 'owner@example.com')
    saved_id, review_id = completed_review(client, item_id, owner)
    assert_error(client.post('/api/v1/saved-items/', json={'item_id': item_id}, headers=owner), 409)
    assert_error(client.post('/api/v1/reviews/', json={'item_id': item_id, 'rating': 2}, headers=owner), 409)
    changed = client.patch(f'/api/v1/reviews/{review_id}', json={'rating': 3, 'review_text': 'Edited'}, headers=owner)
    assert changed.status_code == 200
    assert changed.json()['rating'] == 3
    assert client.get(f'/api/v1/reviews/{review_id}').json()['review_text'] == 'Edited'
    assert_error(client.patch(f'/api/v1/reviews/{review_id}', json={}, headers=owner), 400)
    for path in [f'/api/v1/reviews/{review_id}', f'/api/v1/saved-items/{saved_id}']:
        removed = client.delete(path, headers=owner)
        assert removed.status_code == 204
        assert removed.content == b''
        assert_error(client.delete(path, headers=owner), 404)
    assert client.get('/api/v1/saved-items/', headers=owner).json() == []
    assert client.get('/api/v1/reviews/', params={'item_id': item_id}).json() == []


@pytest.mark.parametrize('method,path,body,status', [
    ('POST', '/saved-items/', {'item_id': 999999}, 404),
    ('POST', '/reviews/', {'item_id': 999999, 'rating': 5}, 404),
    ('GET', '/reviews/999999', None, 404),
    ('PATCH', '/saved-items/999999', {'status': 'completed'}, 404),
    ('PATCH', '/reviews/999999', {'rating': 4}, 404),
    ('POST', '/saved-items/', {}, 422),
    ('POST', '/saved-items/', {'item_id': 'bad'}, 422),
    ('PATCH', '/saved-items/1', {'status': 'invalid'}, 422),
    ('PATCH', '/saved-items/1', {'status': None}, 422),
    ('POST', '/reviews/', {'item_id': 101, 'rating': None}, 422),
    ('POST', '/reviews/', {'item_id': 101, 'rating': 0}, 422),
    ('POST', '/reviews/', {'item_id': 101, 'rating': 6}, 422),
    ('POST', '/reviews/', {'item_id': 101, 'rating': 5, 'review_text': 'x' * 2001}, 422),
])
def test_missing_records_and_invalid_input(workflow_client, method, path, body, status):
    client, _, _ = workflow_client
    headers = login(client, 'errors@example.com')
    assert_error(client.request(method, '/api/v1' + path, json=body, headers=headers), status)


def test_validation_does_not_echo_password(workflow_client):
    client, _, _ = workflow_client
    password = 'secret'  # Intentionally too short; test input only.
    response = client.post('/api/v1/auth/register', json={
        'full_name': 'Test User', 'email': 'valid@example.com',
        'password': password, 'terms_accepted': True,
    })
    assert_error(response, 422)
    assert password not in response.text
    assert all('input' not in error and 'ctx' not in error for error in response.json()['error']['details'])
