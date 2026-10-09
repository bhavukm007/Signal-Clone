from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed import seed_if_empty


def login(client: TestClient, phone: str) -> dict:
    client.post('/api/v1/auth/request-otp', json={'identifier': phone})
    response = client.post(
        '/api/v1/auth/verify-otp',
        json={'identifier': phone, 'code': '123456'},
    )
    assert response.status_code == 200
    return response.json()


def assert_utc(value: str | None) -> None:
    assert value is not None
    assert value.endswith('Z'), f'expected a UTC ISO 8601 timestamp, got {value!r}'


def test_api_and_websocket_datetimes_are_utc_iso_strings(client: TestClient) -> None:
    alice = login(client, '+91 90000 00531')
    bob = login(client, '+91 90000 00532')
    alice_headers = {'Authorization': f"Bearer {alice['token']}"}
    bob_headers = {'Authorization': f"Bearer {bob['token']}"}

    assert_utc(client.get('/api/v1/auth/me', headers=alice_headers).json()['last_seen_at'])
    direct = client.post(
        '/api/v1/conversations/direct',
        headers=alice_headers,
        json={'user_id': bob['user']['id']},
    ).json()
    conversation_id = direct['id']
    client.patch(
        f'/api/v1/conversations/{conversation_id}',
        headers=alice_headers,
        json={'muted_until': '2030-01-01T00:00:00Z', 'disappearing_timer_seconds': 3600},
    )

    conversations = client.get('/api/v1/conversations', headers=alice_headers).json()
    summary = next(item for item in conversations if item['id'] == conversation_id)
    assert_utc(summary['last_activity_at'])
    assert_utc(summary['muted_until'])
    assert_utc(summary['last_seen_at'])

    path = f'/api/v1/conversations/{conversation_id}/messages'
    sent = client.post(
        path,
        headers=alice_headers,
        json={'body': 'UTC timestamp check', 'client_message_id': 'utc-http-message'},
    )
    assert sent.status_code == 200
    message = sent.json()
    assert_utc(message['created_at'])
    assert_utc(message['expires_at'])
    assert_utc(message['sender']['last_seen_at'])
    history = client.get(path, headers=bob_headers).json()
    assert_utc(history[0]['created_at'])

    with client.websocket_connect(f"/ws?token={bob['token']}") as socket:
        with client.websocket_connect(f"/ws?token={alice['token']}") as sender_socket:
            sender_socket.send_json({
                'type': 'message.send',
                'payload': {
                    'conversation_id': conversation_id,
                    'body': 'UTC websocket timestamp check',
                    'client_message_id': 'utc-ws-message',
                },
            })
            while True:
                frame = socket.receive_json()
                if frame.get('type') == 'message.new':
                    break
    assert_utc(frame['payload']['message']['created_at'])
    assert_utc(frame['payload']['message']['expires_at'])
    assert_utc(frame['payload']['message']['sender']['last_seen_at'])


def test_seeded_conversation_timestamps_are_utc_iso_strings(
    client: TestClient, db_session: Session,
) -> None:
    seed_if_empty(db_session)
    alice = login(client, '+91 90000 00001')
    headers = {'Authorization': f"Bearer {alice['token']}"}
    conversations = client.get('/api/v1/conversations', headers=headers).json()
    for conversation in conversations:
        assert_utc(conversation['last_activity_at'])
        assert_utc(conversation.get('last_seen_at'))
        if conversation['last_message']:
            assert_utc(conversation['last_message']['created_at'])
            history = client.get(
                f"/api/v1/conversations/{conversation['id']}/messages?limit=100",
                headers=headers,
            ).json()
            for message in history:
                assert_utc(message['created_at'])
                if message['expires_at']:
                    assert_utc(message['expires_at'])
