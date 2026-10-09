from fastapi.testclient import TestClient
from test_core import login


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
