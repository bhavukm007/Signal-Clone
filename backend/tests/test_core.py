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


def test_websocket_message_delivery_receipts_typing_and_presence(client: TestClient) -> None:
    first = login(client, '+91 90000 00007')
    second = login(client, '+91 90000 00008')
    first_headers = {'Authorization': f"Bearer {first['token']}"}
    second_headers = {'Authorization': f"Bearer {second['token']}"}
    conversation = client.post(
        '/api/v1/conversations/direct',
        headers=first_headers,
        json={'user_id': second['user']['id']},
    ).json()
    conversation_id = conversation['id']

    with client.websocket_connect(f"/ws?token={first['token']}") as sender:
        with client.websocket_connect(f"/ws?token={second['token']}") as recipient:
            online_event = sender.receive_json()
            assert online_event['type'] == 'presence'
            assert online_event['payload']['user_id'] == second['user']['id']
            assert online_event['payload']['is_online'] is True

            sender.send_json({
                'type': 'typing.start',
                'payload': {'conversation_id': conversation_id},
            })
            typing = recipient.receive_json()
            assert typing['type'] == 'typing'
            assert typing['payload']['is_typing'] is True

            sender.send_json({
                'type': 'message.send',
                'payload': {
                    'conversation_id': conversation_id,
                    'body': 'realtime hello',
                    'client_message_id': 'ws-round-trip-1',
                },
            })
            ack = sender.receive_json()
            incoming = recipient.receive_json()
            delivered = sender.receive_json()
            assert ack['type'] == 'message.ack'
            assert incoming['type'] == 'message.new'
            assert incoming['payload']['message']['body'] == 'realtime hello'
            assert delivered['type'] == 'message.status'
            assert delivered['payload']['aggregate_status'] == 'delivered'

            recipient.send_json({
                'type': 'conversation.read',
                'payload': {
                    'conversation_id': conversation_id,
                    'up_to_message_id': ack['payload']['message_id'],
                },
            })
            read_event = sender.receive_json()
            assert read_event['type'] == 'message.status'
            assert read_event['payload']['status'] == 'read'
            assert read_event['payload']['aggregate_status'] == 'read'
        offline_event = sender.receive_json()
        assert offline_event['type'] == 'presence'
        assert offline_event['payload']['is_online'] is False


def test_pending_message_is_delivered_when_recipient_reconnects(client: TestClient) -> None:
    sender_user = login(client, '+91 90000 00009')
    recipient_user = login(client, '+91 90000 00010')
    sender_headers = {'Authorization': f"Bearer {sender_user['token']}"}
    recipient_headers = {'Authorization': f"Bearer {recipient_user['token']}"}
    conversation = client.post(
        '/api/v1/conversations/direct',
        headers=sender_headers,
        json={'user_id': recipient_user['user']['id']},
    ).json()
    posted = client.post(
        f"/api/v1/conversations/{conversation['id']}/messages",
        headers=sender_headers,
        json={'body': 'offline message', 'client_message_id': 'offline-delivery-1'},
    )
    message_id = posted.json()['id']
    with client.websocket_connect(f"/ws?token={recipient_user['token']}"):
        history = client.get(
            f"/api/v1/conversations/{conversation['id']}/messages",
            headers=recipient_headers,
        ).json()
    delivered_message = next(row for row in history if row['id'] == message_id)
    assert delivered_message['status'] == 'delivered'


def test_multi_tab_disconnect_keeps_user_online(client: TestClient) -> None:
    user = login(client, '+91 90000 00011')
    other = login(client, '+91 90000 00012')
    headers = {'Authorization': f"Bearer {user['token']}"}
    other_headers = {'Authorization': f"Bearer {other['token']}"}
    client.post('/api/v1/conversations/direct', headers=headers, json={'user_id': other['user']['id']})

    with client.websocket_connect(f"/ws?token={user['token']}"):
        with client.websocket_connect(f"/ws?token={user['token']}"):
            state = client.get('/api/v1/conversations', headers=other_headers).json()
            assert state[0]['is_online'] is True
        still_online = client.get('/api/v1/conversations', headers=other_headers).json()
        assert still_online[0]['is_online'] is True
    offline = client.get('/api/v1/conversations', headers=other_headers).json()
    assert offline[0]['is_online'] is False


def test_group_admin_management_system_messages_and_membership(client: TestClient) -> None:
    admin = login(client, '+91 90000 00013')
    first_member = login(client, '+91 90000 00014')
    second_member = login(client, '+91 90000 00015')
    admin_headers = {'Authorization': f"Bearer {admin['token']}"}
    first_headers = {'Authorization': f"Bearer {first_member['token']}"}
    group = client.post('/api/v1/groups', headers=admin_headers, json={
        'name': 'Review crew', 'member_ids': [first_member['user']['id']],
    }).json()
    group_id = group['id']

    denied = client.patch(
        f"/api/v1/groups/{group_id}/members/{admin['user']['id']}/role",
        headers=first_headers,
        json={'role': 'admin'},
    )
    assert denied.status_code == 403

    promoted = client.patch(
        f"/api/v1/groups/{group_id}/members/{first_member['user']['id']}/role",
        headers=admin_headers,
        json={'role': 'admin'},
    )
    assert promoted.status_code == 200
    members = client.get(f"/api/v1/groups/{group_id}/members", headers=first_headers).json()
    first_row = next(row for row in members if row['user']['id'] == first_member['user']['id'])
    assert first_row['role'] == 'admin'

    added = client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=first_headers,
        json={'user_ids': [second_member['user']['id']]},
    )
    assert added.json()['added_count'] == 1
    changed = client.patch(
        f"/api/v1/groups/{group_id}",
        headers=admin_headers,
        json={'name': 'Review crew 2'},
    )
    assert changed.json()['title'] == 'Review crew 2'

    history = client.get(
        f"/api/v1/conversations/{group_id}/messages",
        headers=admin_headers,
    ).json()
    system_text = [row['body'] for row in history if row['type'] == 'system']
    assert any('created the group' in text for text in system_text)
    assert any('made' in text and 'an admin' in text for text in system_text)
    assert any('added' in text for text in system_text)
    assert any('changed the group name' in text for text in system_text)

    left = client.delete(
        f"/api/v1/groups/{group_id}/members/{second_member['user']['id']}",
        headers={'Authorization': f"Bearer {second_member['token']}"},
    )
    assert left.status_code == 200
    denied_after_leave = client.get(
        f"/api/v1/groups/{group_id}/members",
        headers={'Authorization': f"Bearer {second_member['token']}"},
    )
    assert denied_after_leave.status_code == 403



def test_group_changes_broadcast_system_message_and_update(client: TestClient) -> None:
    admin = login(client, '+91 90000 00016')
    member = login(client, '+91 90000 00017')
    admin_headers = {'Authorization': f"Bearer {admin['token']}"}
    group = client.post('/api/v1/groups', headers=admin_headers, json={
        'name': 'Broadcast test', 'member_ids': [member['user']['id']],
    }).json()

    with client.websocket_connect(f"/ws?token={admin['token']}") as admin_socket:
        with client.websocket_connect(f"/ws?token={member['token']}") as member_socket:
            admin_presence = admin_socket.receive_json()
            assert admin_presence['type'] == 'presence'
            pending_status = admin_socket.receive_json()
            assert pending_status['type'] == 'message.status'
            response = client.patch(
                f"/api/v1/groups/{group['id']}",
                headers=admin_headers,
                json={'name': 'Broadcast test renamed'},
            )
            assert response.status_code == 200
            member_message = member_socket.receive_json()
            member_update = member_socket.receive_json()
            admin_message = admin_socket.receive_json()
            admin_delivery = admin_socket.receive_json()
            admin_update = admin_socket.receive_json()
            assert member_message['type'] == 'message.new'
            assert 'changed the group name' in member_message['payload']['message']['body']
            assert member_update['type'] == 'conversation.updated'
            assert admin_message['type'] == 'message.new'
            assert admin_delivery['type'] == 'message.status'
            assert admin_update['type'] == 'conversation.updated'


