from fastapi.testclient import TestClient
from test_core import login


def test_disappearing_timer_purges_and_broadcasts_delete(client: TestClient, db_session) -> None:
    from datetime import timedelta
    from sqlalchemy import select
    from app.db.base import utc_now
    from app.models.message import Message
    from app.services.disappearing_service import purge_expired_and_broadcast

    sender = login(client, '+91 90000 00020')
    recipient = login(client, '+91 90000 00021')
    headers = {'Authorization': f"Bearer {sender['token']}"}
    conversation = client.post('/api/v1/conversations/direct', headers=headers, json={
        'user_id': recipient['user']['id'],
    }).json()
    timer = client.patch(
        f"/api/v1/conversations/{conversation['id']}",
        headers=headers,
        json={'disappearing_timer_seconds': 120},
    )
    assert timer.status_code == 200

    with client.websocket_connect(f"/ws?token={sender['token']}") as sender_socket:
        with client.websocket_connect(f"/ws?token={recipient['token']}") as recipient_socket:
            assert sender_socket.receive_json()['type'] == 'presence'
            sender_socket.send_json({
                'type': 'message.send',
                'payload': {
                    'conversation_id': conversation['id'],
                    'body': 'vanishing note',
                    'client_message_id': 'expires-soon-1',
                },
            })
            ack = sender_socket.receive_json()
            incoming = recipient_socket.receive_json()
            sender_socket.receive_json()
            assert incoming['type'] == 'message.new'
            message_id = ack['payload']['message_id']
            message = db_session.scalar(select(Message).where(Message.id == message_id))
            assert message is not None and message.expires_at is not None
            message.expires_at = utc_now() + timedelta(seconds=1)
            db_session.commit()

            deterministic_now = utc_now() + timedelta(seconds=2)
            purged = client.portal.call(purge_expired_and_broadcast, db_session, deterministic_now)
            assert purged == [message_id]
            deleted_event = recipient_socket.receive_json()
            assert deleted_event['type'] == 'message.deleted'
            assert deleted_event['payload']['message_id'] == message_id
            db_session.refresh(message)
            assert message.deleted_at is not None
            assert message.body == 'This message expired'

def test_seed_data_is_complete_and_idempotent(db_session, client: TestClient) -> None:
    from sqlalchemy import func, select
    from app.db.seed import seed_if_empty
    from app.models.contact import Contact
    from app.models.conversation import Conversation, Participant
    from app.models.message import Message, Reaction, Receipt
    from app.models.user import User

    assert seed_if_empty(db_session) is True
    assert seed_if_empty(db_session) is False
    assert db_session.scalar(select(func.count(User.id))) == 10
    assert db_session.scalar(select(func.count(Contact.id))) == 60
    assert db_session.scalar(select(func.count(Conversation.id)).where(Conversation.type == 'direct')) == 9
    assert db_session.scalar(select(func.count(Conversation.id)).where(Conversation.type == 'group')) == 3
    assert db_session.scalar(select(func.count(Message.id))) == 210
    assert db_session.scalar(select(func.count(Reaction.id))) >= 30
    assert db_session.scalar(select(func.count(Message.id)).where(Message.reply_to_id.is_not(None))) >= 10
    assert db_session.scalar(select(func.count(Receipt.id)).where(Receipt.status == 'sent')) > 0
    assert db_session.scalar(select(func.count(Receipt.id)).where(Receipt.status == 'delivered')) > 0
    assert db_session.scalar(select(func.count(Receipt.id)).where(Receipt.status == 'read')) > 0

    demo_headers = {'Authorization': f"Bearer {login(client)['token']}"}
    items = client.get('/api/v1/conversations', headers=demo_headers).json()
    assert any(item['unread_count'] > 0 for item in items)
    assert any(item['is_pinned'] for item in items)
    assert any(item['muted_until'] for item in items)
    assert any(item['type'] == 'group' for item in items)
    demo = db_session.scalar(select(User).where(User.phone_number == '+91 90000 00001'))
    assert demo is not None
    assert db_session.scalar(select(func.count(Participant.id)).where(Participant.user_id == demo.id)) >= 6
    assert db_session.scalar(select(User).where(User.phone_number == '+91 90000 00002')) is not None
