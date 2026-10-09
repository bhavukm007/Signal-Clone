from contextlib import ExitStack
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.message import Receipt
from test_core import login


def test_concurrent_group_messages_are_ordered_idempotent_and_read_by_every_member(
    client: TestClient, db_session,
) -> None:
    users = [login(client, f'+91 90000 0090{index}') for index in range(1, 5)]
    headers = [
        {'Authorization': f"Bearer {item['token']}", 'content-type': 'application/json'}
        for item in users
    ]
    response = client.post(
        '/api/v1/groups', headers=headers[0],
        json={
            'name': f'Concurrent {uuid4().hex[:8]}',
            'member_ids': [item['user']['id'] for item in users[1:]],
        },
    )
    assert response.status_code == 200
    conversation_id = response.json()['id']

    with ExitStack() as stack:
        sockets = [
            stack.enter_context(client.websocket_connect(f"/ws?token={item['token']}"))
            for item in users
        ]
        sockets[0].send_json({
            'type': 'typing.start', 'payload': {'conversation_id': conversation_id},
        })
        typing = None
        for _ in range(10):
            frame = sockets[1].receive_json()
            if frame.get('type') == 'typing':
                typing = frame
                break
        assert typing is not None
        assert typing['payload']['user_id'] == users[0]['user']['id']

        acknowledgements: dict[str, str] = {}
        pending_frames: list[list[dict]] = [[] for _ in users]
        payloads = []
        for user_index, item in enumerate(users):
            for number in range(20):
                payloads.append((user_index, {
                    'body': f'user-{user_index}-message-{number}',
                    'client_message_id': f'pytest-concurrency-{uuid4()}',
                }))

        # Interleave four independent WebSocket senders across the same in-memory
        # TestClient app; every sender contributes 20 messages.
        for number in range(20):
            for user_index, payload in payloads[number::20]:
                sockets[user_index].send_json({
                    'type': 'message.send',
                    'payload': {'conversation_id': conversation_id, **payload},
                })
                while True:
                    frame = sockets[user_index].receive_json()
                    if frame.get('type') == 'message.ack' and frame['payload'].get(
                        'client_message_id'
                    ) == payload['client_message_id']:
                        acknowledgements[payload['client_message_id']] = frame['payload']['message_id']
                        break
                    pending_frames[user_index].append(frame)
        first_sender, first_payload = payloads[0]
        sockets[first_sender].send_json({
            'type': 'message.send',
            'payload': {'conversation_id': conversation_id, **first_payload},
        })
        while True:
            frame = sockets[first_sender].receive_json()
            if frame.get('type') == 'message.ack' and frame['payload'].get(
                'client_message_id'
            ) == first_payload['client_message_id']:
                assert frame['payload']['message_id'] == acknowledgements[first_payload['client_message_id']]
                break
            pending_frames[first_sender].append(frame)

        expected_ids = set(acknowledgements.values())
        sender_by_message = {
            acknowledgements[payload['client_message_id']]: user_index
            for user_index, payload in payloads
        }
        received_by_user: dict[str, list[str]] = {}
        for user_index, socket in enumerate(sockets):
            received = [
                frame['payload']['message']['id'] for frame in pending_frames[user_index]
                if frame.get('type') == 'message.new'
                and frame['payload'].get('conversation_id') == conversation_id
            ]
            while len(received) < 60:
                frame = socket.receive_json()
                if frame.get('type') != 'message.new':
                    continue
                message = frame['payload']['message']
                assert message['conversation_id'] == conversation_id
                received.append(message['id'])
            assert len(received) == len(set(received)), 'a receiver saw a duplicate message'
            received_by_user[users[user_index]['user']['id']] = received

        all_history = client.get(
            f'/api/v1/conversations/{conversation_id}/messages?limit=100',
            headers=headers[0],
        ).json()
        assert expected_ids.issubset({item['id'] for item in all_history})
        canonical = [item['id'] for item in all_history if item['id'] in expected_ids]
        assert len(canonical) == 80
        assert len(canonical) == len(set(canonical))
        for item in users:
            own_id = item['user']['id']
            expected = [
                message['id'] for message in all_history
                if message['id'] in expected_ids and message['sender_id'] != own_id
            ]
            assert received_by_user[own_id] == expected

        db_session.expire_all()
        receipts = list(db_session.scalars(
            select(Receipt).where(Receipt.message_id.in_(expected_ids))
        ))
        assert len(receipts) == 80 * 3
        assert {receipt.status for receipt in receipts} == {'delivered'}

        latest_id = all_history[-1]['id']
        for socket in sockets:
            socket.send_json({
                'type': 'conversation.read',
                'payload': {
                    'conversation_id': conversation_id,
                    'up_to_message_id': latest_id,
                },
            })

        read_receipts_by_sender: dict[str, set[tuple[str, str]]] = {}
        for user_index, socket in enumerate(sockets):
            expected = {
                (message_id, users[recipient_index]['user']['id'])
                for message_id, sender_index in sender_by_message.items()
                if sender_index == user_index
                for recipient_index in range(len(users)) if recipient_index != user_index
            }
            seen: set[tuple[str, str]] = set()
            while not expected.issubset(seen):
                frame = socket.receive_json()
                if frame.get('type') == 'message.status' and frame['payload'].get('status') == 'read':
                    seen.add((frame['payload']['message_id'], frame['payload']['user_id']))
            read_receipts_by_sender[users[user_index]['user']['id']] = seen

        db_session.expire_all()
        receipts = list(db_session.scalars(
            select(Receipt).where(Receipt.message_id.in_(expected_ids))
        ))
        assert len(receipts) == 80 * 3
        assert {receipt.status for receipt in receipts} == {'read'}


def test_concurrent_idempotency_key_cannot_be_reused_in_another_conversation(
    client: TestClient,
) -> None:
    first = login(client, '+91 90000 00991')
    second = login(client, '+91 90000 00992')
    third = login(client, '+91 90000 00993')
    first_headers = {'Authorization': f"Bearer {first['token']}"}
    first_chat = client.post(
        '/api/v1/conversations/direct', headers=first_headers,
        json={'user_id': second['user']['id']},
    ).json()['id']
    second_chat = client.post(
        '/api/v1/conversations/direct', headers=first_headers,
        json={'user_id': third['user']['id']},
    ).json()['id']
    body = {'body': 'same key', 'client_message_id': f'global-idem-{uuid4()}'}
    created = client.post(
        f'/api/v1/conversations/{first_chat}/messages', headers=first_headers, json=body,
    )
    assert created.status_code == 200
    conflict = client.post(
        f'/api/v1/conversations/{second_chat}/messages', headers=first_headers, json=body,
    )
    assert conflict.status_code == 409


def test_unread_count_tracks_messages_after_read_cursor(client: TestClient) -> None:
    alice = login(client, '+91 90000 00994')
    bob = login(client, '+91 90000 00995')
    alice_headers = {'Authorization': f"Bearer {alice['token']}"}
    bob_headers = {'Authorization': f"Bearer {bob['token']}"}
    conversation_id = client.post(
        '/api/v1/conversations/direct', headers=alice_headers,
        json={'user_id': bob['user']['id']},
    ).json()['id']
    sent = client.post(
        f'/api/v1/conversations/{conversation_id}/messages', headers=bob_headers,
        json={'body': 'unread cursor check', 'client_message_id': f'unread-{uuid4()}'},
    )
    assert sent.status_code == 200

    conversations = client.get('/api/v1/conversations', headers=alice_headers).json()
    item = next(row for row in conversations if row['id'] == conversation_id)
    assert item['unread_count'] == 1

    marked = client.post(
        f'/api/v1/conversations/{conversation_id}/read', headers=alice_headers,
        json={'up_to_message_id': sent.json()['id']},
    )
    assert marked.status_code == 200
    conversations = client.get('/api/v1/conversations', headers=alice_headers).json()
    item = next(row for row in conversations if row['id'] == conversation_id)
    assert item['unread_count'] == 0
