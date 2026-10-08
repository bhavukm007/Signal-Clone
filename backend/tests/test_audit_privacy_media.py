from fastapi.testclient import TestClient
from audit_helpers import headers, login
def test_block_prevents_direct_sends_and_presence(client: TestClient, db_session, monkeypatch) -> None:
    import asyncio
    from app.services.presence_service import relevant_user_ids
    from app.services import message_service, realtime_service
    from app.ws.manager import manager
    from app.ws.events import EventType
    from app.models.user import User

    blocker = login(client, '+91 92222 00001')
    blocked = login(client, '+91 92222 00002')
    contact = client.post('/api/v1/contacts', headers=headers(blocker), json={
        'user_id': blocked['user']['id'],
    }).json()
    conversation = client.post('/api/v1/conversations/direct', headers=headers(blocker), json={
        'user_id': blocked['user']['id'],
    }).json()
    earlier_message = client.post(
        f"/api/v1/conversations/{conversation['id']}/messages",
        headers=headers(blocked),
        json={'body': 'sent before block', 'client_message_id': 'pre-block-send'},
    ).json()
    response = client.put(
        f"/api/v1/contacts/{contact['id']}/block",
        headers=headers(blocker), json={'is_blocked': True},
    )
    assert response.status_code == 200 and response.json()['is_blocked'] is True
    denied = client.post(
        f"/api/v1/conversations/{conversation['id']}/messages",
        headers=headers(blocked),
        json={'body': 'blocked message', 'client_message_id': 'blocked-send'},
    )
    assert denied.status_code == 403
    assert denied.json()['error']['code'] == 'FORBIDDEN'

    assert blocked['user']['id'] not in relevant_user_ids(db_session, blocker['user']['id'])
    assert blocker['user']['id'] not in relevant_user_ids(db_session, blocked['user']['id'])

    blocker_user = db_session.get(User, blocker['user']['id'])
    assert blocker_user is not None
    receipts = message_service.mark_read(
        db_session, blocker_user, conversation['id'], earlier_message['id'],
    )
    receipt_targets: list[str] = []

    async def record_receipt(user_id: str, _event: str, _payload: dict) -> None:
        receipt_targets.append(user_id)

    monkeypatch.setattr(manager, 'send_user', record_receipt)
    asyncio.run(realtime_service.publish_receipts(db_session, receipts))
    assert blocked['user']['id'] not in receipt_targets

    typing_targets: set[str] = set()

    async def record_broadcast(user_ids, _event, _payload, _excluded_user_id=None) -> None:
        typing_targets.update(user_ids)

    monkeypatch.setattr(manager, 'send_many', record_broadcast)
    asyncio.run(realtime_service.broadcast_conversation(
        db_session, conversation['id'], EventType.TYPING,
        {'user_id': blocker['user']['id'], 'is_typing': True},
    ))
    assert blocked['user']['id'] not in typing_targets
    restored = client.put(
        f"/api/v1/contacts/{contact['id']}/block",
        headers=headers(blocker), json={'is_blocked': False},
    )
    assert restored.status_code == 200 and restored.json()['is_blocked'] is False
def test_uploaded_media_requires_auth_and_active_conversation_membership(client: TestClient, db_session) -> None:
    from pathlib import Path
    from app.models.message import Attachment
    owner = login(client, '+91 92222 00007')
    member = login(client, '+91 92222 00008')
    outsider = login(client, '+91 92222 00009')
    upload = client.post('/api/v1/uploads', headers=headers(owner), files={
        'file': ('private.txt', b'private bytes', 'text/plain'),
    })
    attachment = upload.json()
    conversation = client.post('/api/v1/conversations/direct', headers=headers(owner), json={
        'user_id': member['user']['id'],
    }).json()
    linked = client.post(
        f"/api/v1/conversations/{conversation['id']}/messages",
        headers=headers(owner),
        json={'body': '', 'client_message_id': 'private-file-message',
              'attachment_ids': [attachment['id']]},
    )
    assert linked.status_code == 200
    url = attachment['url']
    assert client.get(url).status_code == 401
    assert client.get(url, headers=headers(outsider)).status_code == 403
    allowed = client.get(url, headers=headers(member))
    assert allowed.status_code == 200 and allowed.content == b'private bytes'
    stored = db_session.get(Attachment, attachment['id'])
    assert stored is not None
    (Path('uploads') / stored.storage_path).unlink(missing_ok=True)
def test_avatar_route_requires_auth_and_contact_relationship(client: TestClient, db_session) -> None:
    from pathlib import Path
    from app.models.user import User
    owner = login(client, '+91 92222 00010')
    contact = login(client, '+91 92222 00011')
    outsider = login(client, '+91 92222 00012')
    avatar = client.post('/api/v1/users/me/avatar', headers=headers(owner), files={
        'file': ('photo.png', b'\x89PNG\r\n\x1a\ncontents', 'image/png'),
    }).json()
    assert client.get(avatar['avatar_url']).status_code == 401
    assert client.get(avatar['avatar_url'], headers=headers(outsider)).status_code == 403
    assert client.get(avatar['avatar_url'], headers=headers(owner)).status_code == 200
    client.post('/api/v1/contacts', headers=headers(contact), json={'user_id': owner['user']['id']})
    assert client.get(avatar['avatar_url'], headers=headers(contact)).status_code == 200
    profile = db_session.get(User, owner['user']['id'])
    assert profile is not None and profile.avatar_storage_path is not None
    (Path('uploads') / profile.avatar_storage_path).unlink(missing_ok=True)
