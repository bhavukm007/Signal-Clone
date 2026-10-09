from fastapi.testclient import TestClient


def login(client: TestClient, phone: str = '+919000000001') -> dict:
    client.post('/api/v1/auth/request-otp', json={'identifier': phone})
    response = client.post(
        '/api/v1/auth/verify-otp',
        json={'identifier': phone, 'code': '123456'},
    )
    assert response.status_code == 200
    return response.json()


def test_health_and_login(client: TestClient) -> None:
    assert client.get('/health').json() == {'status': 'ok'}
def test_health_and_login(client: TestClient) -> None:
    assert client.get('/health').json() == {'status': 'ok'}
    result = login(client)
    response = client.get(
        '/api/v1/auth/me',
        headers={'Authorization': f"Bearer {result['token']}"},
    )
    assert response.status_code == 200


def test_message_round_trip_is_idempotent(client: TestClient) -> None:
    first = login(client, '+919000000001')
    second = login(client, '+919000000002')
    headers = {'Authorization': f"Bearer {first['token']}"}
    other_headers = {'Authorization': f"Bearer {second['token']}"}
    direct = client.post(
        '/api/v1/conversations/direct',
        headers=headers,
        json={'user_id': second['user']['id']},
    ).json()
    path = f"/api/v1/conversations/{direct['id']}/messages"
    body = {'body': 'pytest check', 'client_message_id': 'stable-test-id'}
    sent = client.post(path, headers=headers, json=body)
    repeated = client.post(path, headers=headers, json={**body, 'body': 'duplicate'})
    assert sent.status_code == 200
    assert repeated.json()['id'] == sent.json()['id']
    received = client.get(path, headers=other_headers)
    assert received.json()[0]['body'] == 'pytest check'


def test_group_admin_rules(client: TestClient) -> None:
    admin = login(client, '+919000000001')
    member = login(client, '+919000000002')
    headers = {'Authorization': f"Bearer {admin['token']}"}
    group = client.post(
        '/api/v1/groups',
        headers=headers,
        json={'name': 'Test Group', 'member_ids': [member['user']['id']]},
    ).json()
    member_headers = {'Authorization': f"Bearer {member['token']}"}
    response = client.post(
        f"/api/v1/groups/{group['id']}/members",
        headers=member_headers,
        json={'user_ids': [admin['user']['id']]},
    )
    assert response.status_code == 403


def test_in_memory_test_database_starts_empty(client: TestClient) -> None:
    result = login(client, '+91 91111 11111')
    assert result['is_new_user'] is True


def test_complete_schema_is_registered() -> None:
    from app.main import Base

    assert {
        'users', 'auth_sessions', 'otp_challenges', 'contacts', 'conversations',
        'conversation_participants', 'messages', 'message_receipts',
        'message_reactions', 'attachments',
    } <= set(Base.metadata.tables)


def test_websocket_ping_round_trip(client: TestClient) -> None:
    result = login(client, '+91 90000 00003')
    with client.websocket_connect(f"/ws?token={result['token']}") as websocket:
        assert websocket.receive_json()['type'] == 'presence.snapshot'
        websocket.send_json({'type': 'ping', 'payload': {}})
        assert websocket.receive_json() == {'type': 'pong', 'payload': {}}


def test_session_is_hashed_and_logout_revokes(client: TestClient, db_session) -> None:
    from sqlalchemy import select
    from app.core.security import hash_token
    from app.db.base import utc_now
    from app.models.auth import AuthSession

    result = login(client, '+91 90000 00004')
    token = result['token']
    saved = db_session.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    assert saved is not None
    assert saved.token_hash != token
    expiry = saved.expires_at.replace(tzinfo=utc_now().tzinfo) if saved.expires_at.tzinfo is None else saved.expires_at
    assert expiry > utc_now()
    headers = {'Authorization': f'Bearer {token}'}
    assert client.post('/api/v1/auth/logout', headers=headers).status_code == 200
    rejected = client.get('/api/v1/auth/me', headers=headers)
    assert rejected.status_code == 401
    assert rejected.json()['error']['code'] == 'UNAUTHORIZED'


def test_revoked_session_is_rejected_by_websocket(client: TestClient) -> None:
    import pytest
    from starlette.websockets import WebSocketDisconnect

    result = login(client, '+91 90000 00005')
    headers = {'Authorization': f"Bearer {result['token']}"}
    assert client.post('/api/v1/auth/logout', headers=headers).status_code == 200
    with pytest.raises(WebSocketDisconnect) as disconnected:
        with client.websocket_connect(f"/ws?token={result['token']}"):
            pass
    assert disconnected.value.code == 4401


def test_expired_session_is_rejected_and_revoked(client: TestClient, db_session) -> None:
    from datetime import timedelta
    from sqlalchemy import select
    from app.core.security import hash_token
    from app.db.base import utc_now
    from app.models.auth import AuthSession

    result = login(client, '+91 90000 00006')
    row = db_session.scalar(select(AuthSession).where(
        AuthSession.token_hash == hash_token(result['token'])
    ))
    assert row is not None
    row.expires_at = utc_now() - timedelta(seconds=1)
    db_session.commit()
    response = client.get('/api/v1/auth/me', headers={'Authorization': f"Bearer {result['token']}"})
    assert response.status_code == 401
    db_session.refresh(row)
    assert row.revoked_at is not None
