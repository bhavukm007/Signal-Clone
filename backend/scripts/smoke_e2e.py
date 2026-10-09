"""Exercise two-account REST/WebSocket workflows against a running local server."""

from __future__ import annotations

import argparse
import asyncio
import json
import uuid
from collections.abc import Callable

import httpx
from websockets.asyncio.client import ClientConnection, connect


def login(client: httpx.Client, identifier: str) -> dict[str, object]:
    client.post('/api/v1/auth/request-otp', json={'identifier': identifier}).raise_for_status()
    response = client.post(
        '/api/v1/auth/verify-otp', json={'identifier': identifier, 'code': '123456'}
    )
    response.raise_for_status()
    return response.json()


async def next_frame(
    socket: ClientConnection,
    expected_type: str,
    predicate: Callable[[dict[str, object]], bool] | None = None,
) -> dict[str, object]:
    while True:
        frame = json.loads(await asyncio.wait_for(socket.recv(), timeout=10))
        if frame.get('type') == expected_type and (predicate is None or predicate(frame)):
            return frame


async def check_websockets(
    base_url: str,
    first_token: str,
    second_token: str,
    conversation_id: str,
    attachment_id: str,
) -> str:
    ws_url = base_url.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws?token='
    async with connect(ws_url + first_token) as first, connect(ws_url + second_token) as second:
        await first.send(json.dumps({'type': 'typing.start', 'payload': {'conversation_id': conversation_id}}))
        await next_frame(second, 'typing', lambda item: item['payload'].get('is_typing') is True)
        await first.send(json.dumps({'type': 'typing.stop', 'payload': {'conversation_id': conversation_id}}))
        await next_frame(second, 'typing', lambda item: item['payload'].get('is_typing') is False)

        sent_ids: list[str] = []
        for number, (sender, recipient) in enumerate(((first, second), (second, first))):
            client_id = str(uuid.uuid4())
            await sender.send(json.dumps({'type': 'message.send', 'payload': {
                'conversation_id': conversation_id,
                'body': f'Automated realtime smoke {client_id[:8]}',
                'client_message_id': client_id,
                'attachment_ids': [attachment_id] if number == 0 else [],
            }}))
            delivery = await next_frame(recipient, 'message.new')
            message = delivery['payload']['message']
            if number == 0:
                assert message['attachments'][0]['id'] == attachment_id
            message_id = str(message['id'])
            sent_ids.append(message_id)
            await next_frame(sender, 'message.ack', lambda item: item['payload'].get('client_message_id') == client_id)
            delivered = await next_frame(sender, 'message.status', lambda item: item['payload'].get('message_id') == message_id)
            assert delivered['payload']['aggregate_status'] in {'delivered', 'read'}
            await recipient.send(json.dumps({'type': 'conversation.read', 'payload': {
                'conversation_id': conversation_id,
                'up_to_message_id': message_id,
            }}))
            read = await next_frame(sender, 'message.status', lambda item: item['payload'].get('message_id') == message_id and item['payload'].get('aggregate_status') == 'read')
            assert read['payload']['aggregate_status'] == 'read'
    return sent_ids[-1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:8000')
    parser.add_argument('--verify-conversation')
    parser.add_argument('--verify-message')
    parser.add_argument('--verify-group')
    args = parser.parse_args()
    with httpx.Client(base_url=args.base_url, timeout=15) as client:
        first = login(client, '+91 90000 00001')
        assert first['is_new_user'] is False, 'startup did not seed the first demo account'
        if args.verify_conversation and args.verify_message and args.verify_group:
            headers = {'Authorization': f"Bearer {first['token']}"}
            detail = client.get(f'/api/v1/conversations/{args.verify_conversation}', headers=headers)
            detail.raise_for_status()
            history = client.get(f'/api/v1/conversations/{args.verify_conversation}/messages', headers=headers)
            history.raise_for_status()
            assert any(item['id'] == args.verify_message for item in history.json())
            members = client.get(f'/api/v1/groups/{args.verify_group}/members', headers=headers)
            members.raise_for_status()
            print(json.dumps({'status': 'persistence passed', 'message_id': args.verify_message, 'group_id': args.verify_group}))
            return
        second = login(client, '+91 90000 00002')
        assert second['is_new_user'] is False, 'startup did not seed the second demo account'
        first_user = first['user']
        second_user = second['user']
        headers = {'Authorization': f"Bearer {first['token']}"}
        direct = client.post('/api/v1/conversations/direct', headers=headers, json={'user_id': second_user['id']})
        direct.raise_for_status()
        conversation_id = direct.json()['id']

        upload = client.post(
            '/api/v1/uploads',
            headers=headers,
            files={'file': ('production-smoke.txt', b'production upload check', 'text/plain')},
        )
        upload.raise_for_status()
        attachment_id = str(upload.json()['id'])

        group = client.post('/api/v1/groups', headers=headers, json={
            'name': f"Smoke group {uuid.uuid4().hex[:6]}", 'member_ids': [second_user['id']],
        })
        group.raise_for_status()
        group_id = group.json()['id']
        members = client.get(f'/api/v1/groups/{group_id}/members', headers=headers)
        members.raise_for_status()
        assert len(members.json()) == 2
        non_admin_headers = {'Authorization': f"Bearer {second['token']}"}
        denied = client.post(f'/api/v1/groups/{group_id}/members', headers=non_admin_headers, json={'user_ids': [first_user['id']]})
        assert denied.status_code == 403, denied.text

    last_message_id = asyncio.run(check_websockets(
        args.base_url,
        str(first['token']),
        str(second['token']),
        str(conversation_id),
        attachment_id,
    ))
    print(json.dumps({
        'status': 'passed',
        'conversation_id': conversation_id,
        'group_id': group_id,
        'last_message_id': last_message_id,
        'accounts': ['+91 90000 00001', '+91 90000 00002'],
        'checks': ['auth', 'direct chat', 'upload and attachment delivery', 'group creation', 'admin denial', 'typing', 'both-way messages', 'delivery and read receipts'],
    }, indent=2))


if __name__ == '__main__':
    main()
