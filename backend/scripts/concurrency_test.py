"""Stress REST/WebSocket message delivery against a running backend."""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

import httpx
from websockets.asyncio.client import ClientConnection, connect


def websocket_url(base_url: str, token: str) -> str:
    scheme = 'wss' if base_url.startswith('https://') else 'ws'
    origin = base_url.removeprefix('https://').removeprefix('http://').rstrip('/')
    return f'{scheme}://{origin}/ws?token={token}'


@dataclass
class Peer:
    user: dict[str, Any]
    token: str
    ws: ClientConnection | None = None
    reader: asyncio.Task[None] | None = None
    frames: asyncio.Queue[dict[str, Any]] = field(default_factory=asyncio.Queue)
    messages: list[dict[str, Any]] = field(default_factory=list)
    latencies: list[float] = field(default_factory=list)
    status_events: set[tuple[str, str, str]] = field(default_factory=set)
    acknowledgements: dict[str, str] = field(default_factory=dict)
    ack_waiters: dict[str, asyncio.Future[str]] = field(default_factory=dict)
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def connect(self, base_url: str, send_times: dict[str, float]) -> None:
        self.ws = await connect(websocket_url(base_url, self.token), open_timeout=15)
        self.reader = asyncio.create_task(self._read_frames(send_times))

    async def _read_frames(self, send_times: dict[str, float]) -> None:
        assert self.ws is not None
        try:
            async for raw in self.ws:
                frame = json.loads(raw)
                if frame.get('type') == 'message.new':
                    message = frame.get('payload', {}).get('message', {})
                    client_id = message.get('client_message_id')
                    if client_id in send_times:
                        self.latencies.append((time.perf_counter() - send_times[client_id]) * 1000)
                    self.messages.append(message)
                elif frame.get('type') == 'message.ack':
                    payload = frame.get('payload', {})
                    client_id = payload.get('client_message_id')
                    message_id = payload.get('message_id')
                    if client_id and message_id:
                        self.acknowledgements[client_id] = message_id
                        waiter = self.ack_waiters.get(client_id)
                        if waiter is not None and not waiter.done():
                            waiter.set_result(message_id)
                elif frame.get('type') == 'message.status':
                    payload = frame.get('payload', {})
                    self.status_events.add((
                        payload.get('message_id'), payload.get('user_id'), payload.get('status')
                    ))
                await self.frames.put(frame)
        except Exception:
            return

    async def send(self, event: str, payload: dict[str, Any]) -> None:
        assert self.ws is not None
        async with self.send_lock:
            await self.ws.send(json.dumps({'type': event, 'payload': payload}))

    async def wait_ack(self, client_id: str) -> str:
        if client_id in self.acknowledgements:
            return self.acknowledgements[client_id]
        waiter = asyncio.get_running_loop().create_future()
        self.ack_waiters[client_id] = waiter
        try:
            return await asyncio.wait_for(waiter, 30)
        finally:
            self.ack_waiters.pop(client_id, None)

    async def close(self) -> None:
        if self.ws is not None:
            await self.ws.close()
        if self.reader is not None:
            await asyncio.gather(self.reader, return_exceptions=True)
        self.ws = None
        self.reader = None

    async def next_frame(self, predicate, timeout: float = 60) -> dict[str, Any]:
        while True:
            frame = await asyncio.wait_for(self.frames.get(), timeout)
            if predicate(frame):
                return frame

    async def collect_messages(self, count: int, conversation_id: str) -> list[dict[str, Any]]:
        found = []
        while len(found) < count:
            frame = await asyncio.wait_for(self.frames.get(), 90)
            if frame.get('type') == 'message.new' and frame.get('payload', {}).get('conversation_id') == conversation_id:
                found.append(frame['payload']['message'])
        return found

    async def collect_typing(self, peers: list['Peer'], conversation_id: str) -> None:
        expected = {
            (peer.user['id'], is_typing)
            for peer in peers if peer.user['id'] != self.user['id']
            for is_typing in (True, False)
        }
        seen: set[tuple[str, bool]] = set()
        while not expected.issubset(seen):
            frame = await asyncio.wait_for(self.frames.get(), 30)
            if frame.get('type') != 'typing':
                continue
            payload = frame.get('payload', {})
            if payload.get('conversation_id') == conversation_id:
                seen.add((payload.get('user_id'), payload.get('is_typing')))


class StressRun:
    def __init__(self, base_url: str, users: int, messages: int) -> None:
        self.base_url = base_url.rstrip('/')
        self.users = users
        self.messages_per_user = messages
        self.http = httpx.AsyncClient(base_url=self.base_url, timeout=30)
        self.peers: list[Peer] = []
        self.send_times: dict[str, float] = {}
        self.sent: dict[str, dict[str, Any]] = {}
        self.duplicate_ids: set[str] = set()

    async def request(self, method: str, path: str, token: str | None = None, **kwargs):
        headers = kwargs.pop('headers', {})
        if token:
            headers['Authorization'] = f'Bearer {token}'
        response = await self.http.request(method, path, headers=headers, **kwargs)
        response.raise_for_status()
        return response.json() if response.content else None

    async def login_users(self) -> None:
        for index in range(self.users):
            identifier = (
                f'+91 90000 0000{index + 1}' if index < 10
                else f'+91 91{index:03d} 00000'
            )
            await self.request('POST', '/api/v1/auth/request-otp', json={'identifier': identifier})
            result = await self.request(
                'POST', '/api/v1/auth/verify-otp',
                json={'identifier': identifier, 'code': '123456'},
            )
            self.peers.append(Peer(result['user'], result['token']))

    async def create_chats(self) -> str:
        owner = self.peers[0]
        group = await self.request(
            'POST', '/api/v1/groups', owner.token,
            json={
                'name': f'Concurrency {uuid.uuid4().hex[:8]}',
                'member_ids': [peer.user['id'] for peer in self.peers[1:]],
            },
        )
        self.direct_ids = {}
        for peer in self.peers[1:]:
            direct = await self.request(
                'POST', '/api/v1/conversations/direct', owner.token,
                json={'user_id': peer.user['id']},
            )
            self.direct_ids[peer.user['id']] = direct['id']
        return group['id']

    async def post_message(
        self, peer: Peer, conversation_id: str, client_id: str, body: str,
    ) -> str:
        self.send_times[client_id] = time.perf_counter()
        payload = {
            'conversation_id': conversation_id,
            'body': body,
            'client_message_id': client_id,
        }
        await peer.send('message.send', payload)
        message_id = await peer.wait_ack(client_id)
        self.sent[message_id] = {
            'client_message_id': client_id,
            'sender_id': peer.user['id'],
            'conversation_id': conversation_id,
            'body': body,
        }
        return message_id

    async def send_batch(self, conversation_id: str, counts: list[int], label: str) -> list[str]:
        sent_ids: list[str] = []

        async def send_for_user(index: int, count: int) -> None:
            peer = self.peers[index]
            for number in range(count):
                body = f'{label}:user-{index}:message-{number}'
                client_id = f'{label}-{index}-{number}-{uuid.uuid4().hex[:6]}'
                message_id = await self.post_message(peer, conversation_id, client_id, body)
                sent_ids.append(message_id)
                if number == 0 and label == 'group-main':
                    await peer.send('message.send', {
                        'conversation_id': conversation_id,
                        'body': body,
                        'client_message_id': client_id,
                    })
                    duplicate = await peer.wait_ack(client_id)
                    assert duplicate == message_id, 'idempotent resend returned a different message id'
                    self.duplicate_ids.add(client_id)

        await asyncio.gather(*(send_for_user(index, count) for index, count in enumerate(counts)))
        return sent_ids

    async def history(self, peer: Peer, conversation_id: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        before = None
        while True:
            suffix = f'?limit=100&before={before}' if before else '?limit=100'
            page = await self.request(
                'GET', f'/api/v1/conversations/{conversation_id}/messages{suffix}', peer.token
            )
            if not page:
                break
            items = page + items
            if len(page) < 100:
                break
            before = page[0]['id']
        return items

    async def read_all(self, conversation_id: str, latest_id: str) -> None:
        await asyncio.gather(*(
            peer.send('conversation.read', {
                'conversation_id': conversation_id,
                'up_to_message_id': latest_id,
            })
            for peer in self.peers
        ))

    async def verify_statuses(
        self, message_ids: set[str], participants_by_message: dict[str, set[str]],
    ) -> None:
        expected_by_sender: dict[str, set[tuple[str, str, str]]] = defaultdict(set)
        for message_id in message_ids:
            sender_id = self.sent[message_id]['sender_id']
            for recipient_id in participants_by_message[message_id] - {sender_id}:
                expected_by_sender[sender_id].add((message_id, recipient_id, 'delivered'))
                expected_by_sender[sender_id].add((message_id, recipient_id, 'read'))

        async def collect(peer: Peer) -> None:
            expected = expected_by_sender[peer.user['id']]
            deadline = time.monotonic() + 90
            while not expected.issubset(peer.status_events):
                if time.monotonic() >= deadline:
                    missing = expected - peer.status_events
                    raise AssertionError(
                        f'missing {len(missing)} receipt events for {peer.user["id"]}: '
                        f'{sorted(missing)[:5]}'
                    )
                await asyncio.sleep(0.05)

        await asyncio.gather(*(collect(peer) for peer in self.peers))

    async def exercise(self) -> dict[str, Any]:
        await self.login_users()
        group_id = await self.create_chats()
        await asyncio.gather(*(peer.connect(self.base_url, self.send_times) for peer in self.peers))

        for peer in self.peers:
            await peer.send('typing.start', {'conversation_id': group_id})
            await peer.send('typing.stop', {'conversation_id': group_id})
        for peer in self.peers:
            await peer.collect_typing(self.peers, group_id)

        initial_ids = await self.send_batch(
            group_id, [self.messages_per_user] * self.users, 'group-main'
        )
        initial_counts = [self.messages_per_user] * self.users
        await self.collect_group_messages(group_id, initial_counts, len(initial_ids))

        # All messages are read by every other participant, then the 200-message burst runs.
        initial_history = await self.history(self.peers[0], group_id)
        await self.read_all(group_id, initial_history[-1]['id'])
        group_members = {peer.user['id'] for peer in self.peers}
        await self.verify_statuses(
            set(initial_ids), {message_id: group_members for message_id in initial_ids}
        )

        burst_counts = [200 // self.users + (1 if index < 200 % self.users else 0) for index in range(self.users)]
        burst_ids = await self.send_batch(group_id, burst_counts, 'group-burst')
        await self.collect_group_messages(group_id, burst_counts, len(burst_ids))
        all_group_ids = set(initial_ids + burst_ids)
        full_history = await self.history(self.peers[0], group_id)
        await self.assert_group_order(group_id, full_history, all_group_ids)
        await self.read_all(group_id, full_history[-1]['id'])
        await self.verify_statuses(
            set(burst_ids), {message_id: group_members for message_id in burst_ids}
        )

        # Send on every direct chat concurrently and read them on both ends.
        direct_specs = []
        for index, peer in enumerate(self.peers[1:], start=1):
            conversation_id = self.direct_ids[peer.user['id']]
            direct_specs.extend([
                (self.peers[0], conversation_id, f'dm-owner-{index}', f'DM owner to {index}'),
                (peer, conversation_id, f'dm-peer-{index}', f'DM peer {index} to owner'),
            ])
        direct_ids = await asyncio.gather(*(
            self.post_message(peer, conversation_id, client_id, body)
            for peer, conversation_id, client_id, body in direct_specs
        ))
        for index, peer in enumerate(self.peers[1:], start=1):
            conversation_id = self.direct_ids[peer.user['id']]
            await asyncio.gather(
                self.peers[0].collect_messages(1, conversation_id),
                peer.collect_messages(1, conversation_id),
            )
            direct_history = await self.history(peer, conversation_id)
            await asyncio.gather(*(
                participant.send('conversation.read', {
                    'conversation_id': conversation_id,
                    'up_to_message_id': direct_history[-1]['id'],
                })
                for participant in (self.peers[0], peer)
            ))
            direct_history = await self.history(self.peers[0], conversation_id)
            for participant in (self.peers[0], peer):
                actual = [
                    message['id'] for message in participant.messages
                    if message['conversation_id'] == conversation_id
                ]
                expected = [
                    message['id'] for message in direct_history
                    if message['id'] in direct_ids
                    and message['sender_id'] != participant.user['id']
                ]
                assert actual == expected, f'DM order/uniqueness failed for user {index}'
        direct_peer_by_conversation = {
            conversation_id: peer for peer_id, conversation_id in self.direct_ids.items()
            for peer in self.peers if peer.user['id'] == peer_id
        }
        direct_participants = {}
        for message_id, (sender, conversation_id, _client_id, _body) in zip(direct_ids, direct_specs):
            other = (
                direct_peer_by_conversation[conversation_id]
                if sender.user['id'] == self.peers[0].user['id']
                else self.peers[0]
            )
            direct_participants[message_id] = {sender.user['id'], other.user['id']}
        await self.verify_statuses(set(direct_ids), direct_participants)

        # Drop one participant during the live stream, then prove REST resync recovers it.
        offline = self.peers[-1]
        await offline.close()
        missed_ids = await asyncio.gather(*(
            self.post_message(self.peers[0], group_id, f'reconnect-{i}-{uuid.uuid4()}', f'reconnect {i}')
            for i in range(3)
        ))
        await offline.connect(self.base_url, self.send_times)
        recovered = await self.history(offline, group_id)
        recovered_ids = {message['id'] for message in recovered}
        assert set(missed_ids).issubset(recovered_ids), 'REST resync missed messages sent while offline'
        await self.read_all(group_id, recovered[-1]['id'])
        await self.verify_statuses(
            set(missed_ids), {message_id: group_members for message_id in missed_ids}
        )

        # A second tab receives one copy, and closing it does not mark the user offline.
        second_tab = Peer(self.peers[0].user, self.peers[0].token)
        await second_tab.connect(self.base_url, self.send_times)
        tab_message = await self.post_message(
            self.peers[1], group_id, f'multi-tab-{uuid.uuid4()}', 'multi-tab delivery'
        )
        await asyncio.gather(
            self.peers[0].next_frame(lambda frame: self._is_message(frame, tab_message)),
            second_tab.next_frame(lambda frame: self._is_message(frame, tab_message)),
        )
        await asyncio.sleep(0.05)
        for tab in (self.peers[0], second_tab):
            extra = []
            while not tab.frames.empty():
                extra.append(tab.frames.get_nowait())
            assert sum(self._is_message(frame, tab_message) for frame in extra) == 0, 'multi-tab duplicate delivery'
        await second_tab.close()
        current_history = await self.history(self.peers[0], group_id)
        await self.read_all(group_id, current_history[-1]['id'])
        await self.verify_statuses({tab_message}, {tab_message: group_members})
        direct_state = await self.request(
            'GET', '/api/v1/conversations', self.peers[1].token
        )
        target_direct = next(item for item in direct_state if item['id'] == self.direct_ids[self.peers[1].user['id']])
        assert target_direct['is_online'] is True, 'closing one tab incorrectly marked user offline'

        latencies = sorted(latency for peer in self.peers for latency in peer.latencies)
        assert latencies, 'no send-to-receive latency samples were collected'
        p95 = latencies[max(0, math.ceil(0.95 * len(latencies)) - 1)]
        return {
            'users': self.users,
            'messages_per_user': self.messages_per_user,
            'group_messages': len(all_group_ids),
            'direct_conversations': len(self.direct_ids),
            'duplicate_resends': len(self.duplicate_ids),
            'burst_messages': len(burst_ids),
            'reconnect_missed_messages': len(missed_ids),
            'latency_samples': len(latencies),
            'p95_send_to_receive_ms': round(p95, 2),
        }

    @staticmethod
    def _is_message(frame: dict[str, Any], message_id: str) -> bool:
        return (
            frame.get('type') == 'message.new'
            and frame.get('payload', {}).get('message', {}).get('id') == message_id
        )

    async def collect_group_messages(
        self, conversation_id: str, counts: list[int], total: int,
    ) -> None:
        await asyncio.gather(*(
            peer.collect_messages(total - counts[index], conversation_id)
            for index, peer in enumerate(self.peers)
        ))

    async def assert_group_order(
        self, conversation_id: str, history: list[dict[str, Any]], expected_ids: set[str],
    ) -> None:
        canonical = [item['id'] for item in history if item['id'] in expected_ids]
        assert set(canonical) == expected_ids, 'REST history lost a sent message'
        for peer in self.peers:
            actual = [item['id'] for item in peer.messages if item['conversation_id'] == conversation_id]
            expected = [item for item in canonical if self.sent[item]['sender_id'] != peer.user['id']]
            assert actual == expected, f'inconsistent/duplicate receive order for {peer.user["id"]}'

    async def close(self) -> None:
        await asyncio.gather(*(peer.close() for peer in self.peers), return_exceptions=True)
        await self.http.aclose()


async def run(args: argparse.Namespace) -> None:
    if args.users < 2 or args.messages < 1:
        raise SystemExit('--users must be >= 2 and --messages must be >= 1')
    stress = StressRun(args.base_url, args.users, args.messages)
    try:
        result = await stress.exercise()
        print(json.dumps({'status': 'passed', **result}, indent=2))
    finally:
        await stress.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8000')
    parser.add_argument('--users', type=int, default=6)
    parser.add_argument('--messages', type=int, default=50)
    return parser.parse_args()


if __name__ == '__main__':
    asyncio.run(run(parse_args()))
