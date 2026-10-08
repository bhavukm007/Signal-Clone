from fastapi.testclient import TestClient


def login(client: TestClient, phone: str = '+91 90000 00001') -> dict:
    client.post('/api/v1/auth/request-otp', json={'identifier': phone})
    response = client.post(
        '/api/v1/auth/verify-otp',
        json={'identifier': phone, 'code': '123456'},
    )
    assert response.status_code == 200
    return response.json()


def test_health_and_login(client: TestClient) -> None:
    assert client.get('/health').json() == {'status': 'ok'}
    result = login(client)
    response = client.get(
        '/api/v1/auth/me',
        headers={'Authorization': f"Bearer {result['token']}"},
    )
    assert response.status_code == 200


def test_message_round_trip_is_idempotent(client: TestClient) -> None:
    first = login(client, '+91 90000 00001')
    second = login(client, '+91 90000 00002')
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
    admin = login(client, '+91 90000 00001')
    member = login(client, '+91 90000 00002')
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
        websocket.send_json({'type': 'ping', 'payload': {}})
        assert websocket.receive_json() == {'type': 'pong', 'payload': {}}
