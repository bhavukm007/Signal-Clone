from fastapi.testclient import TestClient
from audit_helpers import headers, login
def test_websocket_disconnect_cleans_up_presence(client: TestClient) -> None:
    from app.ws.manager import manager
    first = login(client, '+91 94444 00001')
    second = login(client, '+91 94444 00002')
    client.post('/api/v1/conversations/direct', headers=headers(second), json={
        'user_id': first['user']['id'],
    })
    with client.websocket_connect(f"/ws?token={first['token']}") as socket:
        online = client.get('/api/v1/conversations', headers=headers(second)).json()
        assert online[0]['is_online'] is True
        socket.close()
        during_grace = client.get('/api/v1/conversations', headers=headers(second)).json()
        assert during_grace[0]['is_online'] is True
    offline = client.get('/api/v1/conversations', headers=headers(second)).json()
    assert offline[0]['is_online'] is True
    assert manager.is_online(first['user']['id']) is False
def test_stale_websocket_heartbeat_is_dropped() -> None:
    import asyncio
    from time import monotonic
    from app.ws.manager import ConnectionManager

    class Socket:
        closed = False

        async def accept(self) -> None:
            return None

        async def close(self, **_kwargs) -> None:
            self.closed = True

    manager = ConnectionManager()
    socket = Socket()
    asyncio.run(manager.connect('stale-user', socket))
    manager.touch(socket, now=monotonic())
    dropped = asyncio.run(manager.drop_stale(timeout_seconds=1, now=monotonic() + 2))
    assert dropped == 1
    assert socket.closed
    assert not manager.is_online('stale-user')
