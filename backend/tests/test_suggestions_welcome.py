from app.db.seed import seed
from app.models.conversation import Conversation
from app.models.message import Message, Receipt
from app.models.user import User
from sqlalchemy import select


def auth(client, identifier: str) -> dict:
    assert client.post('/api/v1/auth/request-otp', json={'identifier': identifier}).status_code == 200
    response = client.post(
        '/api/v1/auth/verify-otp',
        json={'identifier': identifier, 'code': '123456'},
    )
    assert response.status_code == 200
    return response.json()


def test_suggestions_mask_phones_and_obey_discoverability(client, database) -> None:
    with database() as db:
        seed(db)

    result = auth(client, '+919111111111')
    headers = {'Authorization': f"Bearer {result['token']}"}
    response = client.get('/api/v1/users/suggestions?limit=8', headers=headers)
    assert response.status_code == 200
    suggestions = response.json()
    assert suggestions
    assert suggestions[0]['display_name'] == 'Aarav Mehta'
    assert suggestions[0]['masked_phone_number'] == '+91 ••••• ••001'
    assert 'phone_number' not in suggestions[0]
    assert '+919000000001' not in response.text

    person_id = suggestions[0]['id']
    assert client.post('/api/v1/contacts', headers=headers, json={'user_id': person_id}).status_code == 200
    refreshed = client.get('/api/v1/users/suggestions', headers=headers).json()
    assert person_id not in {person['id'] for person in refreshed}

    hidden = client.patch(
        '/api/v1/users/me/discoverability',
        headers=headers,
        json={'is_discoverable': False},
    )
    assert hidden.status_code == 200
    with database() as db:
        discoverable_user = User(
            phone_number='+919222222222',
            display_name='Findable Person',
            is_discoverable=True,
        )
        db.add(discoverable_user)
        db.commit()
    other = auth(client, '+919333333333')
    other_suggestions = client.get(
        '/api/v1/users/suggestions',
        headers={'Authorization': f"Bearer {other['token']}"},
    ).json()
    assert result['user']['id'] not in {person['id'] for person in other_suggestions}


def test_first_profile_creates_welcome_dm_and_bot_replies_with_read_receipt(client, database) -> None:
    result = auth(client, '+919444444444')
    headers = {'Authorization': f"Bearer {result['token']}"}
    profile = client.put(
        '/api/v1/auth/profile',
        headers=headers,
        json={'display_name': 'First Timer'},
    )
    assert profile.status_code == 200
    conversations = client.get('/api/v1/conversations', headers=headers).json()
    welcome = next(
        item for item in conversations
        if any(member['display_name'] == 'Signal Welcome' for member in item['participants'])
    )
    history_path = f"/api/v1/conversations/{welcome['id']}/messages"
    history = client.get(history_path, headers=headers).json()
    assert history[0]['body'].startswith('Welcome to Signal Clone!')

    sent = client.post(
        history_path,
        headers=headers,
        json={'body': 'How do I create a group?', 'client_message_id': 'welcome-bot-test-message'},
    )
    assert sent.status_code == 200
    history = client.get(history_path, headers=headers).json()
    bot_reply = next(message for message in history if 'Thanks for your message!' in message['body'])
    assert bot_reply['sender']['display_name'] == 'Signal Welcome'
    assert bot_reply['status'] == 'read'
    with database() as db:
        message = db.get(Message, bot_reply['id'])
        assert message is not None
        receipt = db.scalar(
            select(Receipt).where(Receipt.message_id == message.id, Receipt.user_id == result['user']['id'])
        )
        assert receipt is not None and receipt.status == 'read' and receipt.read_at is not None
        conversation = db.get(Conversation, welcome['id'])
        assert conversation is not None and conversation.last_message_id == message.id


def test_reaction_route_persists_single_emoji_per_user_and_replaces_it(client, database) -> None:
    with database() as db:
        seed(db)
    result = auth(client, '+919000000001')
    headers = {'Authorization': f"Bearer {result['token']}"}
    conversations = client.get('/api/v1/conversations', headers=headers).json()
    direct = next(item for item in conversations if item['type'] == 'direct')
    history = client.get(
        f"/api/v1/conversations/{direct['id']}/messages", headers=headers,
    ).json()
    message_id = history[-1]['id']
    path = f'/api/v1/messages/{message_id}/reaction'
    first = client.put(path, headers=headers, json={'emoji': '👍🏽'})
    assert first.status_code == 200
    second = client.put(path, headers=headers, json={'emoji': '🎉'})
    assert second.status_code == 200
    updated = client.get(
        f"/api/v1/conversations/{direct['id']}/messages", headers=headers,
    ).json()
    message = next(item for item in updated if item['id'] == message_id)
    assert message['reactions'] == [{'emoji': '🎉', 'count': 1, 'user_ids': [result['user']['id']]}]


def test_group_system_messages_are_structured_and_previews_are_perspective_aware(client, database) -> None:
    with database() as db:
        seed(db)
    admin = auth(client, '+919000000001')
    member = auth(client, '+919000000002')
    added_user = auth(client, '+919000000003')
    headers = {'Authorization': f"Bearer {admin['token']}"}
    created = client.post(
        '/api/v1/groups',
        headers=headers,
        json={'name': 'Perspective test', 'member_ids': [member['user']['id']]},
    )
    assert created.status_code == 200
    conversation_id = created.json()['id']
    history = client.get(
        f'/api/v1/conversations/{conversation_id}/messages', headers=headers,
    ).json()
    assert history[-1]['system_data']['event'] == 'group_created'
    admin_preview = next(
        item for item in client.get('/api/v1/conversations', headers=headers).json()
        if item['id'] == conversation_id
    )['last_message']
    assert admin_preview['preview_text'] == 'You created the group'

    member_headers = {'Authorization': f"Bearer {member['token']}"}
    member_preview = next(
        item for item in client.get('/api/v1/conversations', headers=member_headers).json()
        if item['id'] == conversation_id
    )['last_message']
    assert member_preview['preview_text'] == 'Aarav Mehta created the group'

    added = client.post(
        f'/api/v1/groups/{conversation_id}/members',
        headers=headers,
        json={'user_ids': [added_user['user']['id']]},
    )
    assert added.status_code == 200
    newest_preview = next(
        item for item in client.get('/api/v1/conversations', headers=headers).json()
        if item['id'] == conversation_id
    )['last_message']
    assert newest_preview['preview_text'] == 'You added Rohan Shah'
