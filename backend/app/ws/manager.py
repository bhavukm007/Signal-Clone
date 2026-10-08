from collections import defaultdict
from time import monotonic
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._typing_last_sent: dict[tuple[str, str], float] = {}

    def is_online(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))

    async def connect(self, user_id: str, websocket: WebSocket) -> bool:
        await websocket.accept()
        first_connection = not self.is_online(user_id)
        self._connections[user_id].add(websocket)
        return first_connection

    def disconnect(self, user_id: str, websocket: WebSocket) -> bool:
        sockets = self._connections.get(user_id)
        if sockets is None:
            return True
        sockets.discard(websocket)
        last_connection = not sockets
        if last_connection:
            self._connections.pop(user_id, None)
            for key in [key for key in self._typing_last_sent if key[0] == user_id]:
                self._typing_last_sent.pop(key, None)
        return last_connection

    async def send_user(self, user_id: str, event: str, payload: dict[str, Any]) -> None:
        frame = {'type': event, 'payload': payload}
        for websocket in tuple(self._connections.get(user_id, ())):
            try:
                await websocket.send_json(frame)
            except (WebSocketDisconnect, RuntimeError):
                self.disconnect(user_id, websocket)

    async def send_many(
        self,
        user_ids: set[str],
        event: str,
        payload: dict[str, Any],
        excluded_user_id: str | None = None,
    ) -> None:
        for user_id in user_ids:
            if user_id != excluded_user_id:
                await self.send_user(user_id, event, payload)

    def allow_typing(self, user_id: str, conversation_id: str, interval: float = 0.35) -> bool:
        key = (user_id, conversation_id)
        current = monotonic()
        if current - self._typing_last_sent.get(key, 0) < interval:
            return False
        self._typing_last_sent[key] = current
        return True


manager = ConnectionManager()
