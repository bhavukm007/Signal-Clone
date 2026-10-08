from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.auth_service import validate_websocket_token

router = APIRouter()


@router.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket, token: str = '', db: Session = Depends(get_db)) -> None:
    user = validate_websocket_token(db, token)
    if user is None:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    try:
        while True:
            frame = await websocket.receive_json()
            if frame.get('type') == 'ping':
                await websocket.send_json({'type': 'pong', 'payload': {}})
    except WebSocketDisconnect:
        return
