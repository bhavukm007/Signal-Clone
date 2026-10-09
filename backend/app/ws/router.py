from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.message import MessageCreate, ReactionInput
from app.services import auth_service, conversation_service, message_service, presence_service, realtime_service
from app.ws.events import EventType
from app.ws.manager import manager

router = APIRouter()


async def handle_frame(websocket: WebSocket, db: Session, user: User, frame: dict) -> None:
    event_type = frame.get('type')
    payload = frame.get('payload') or {}
    if event_type == 'ping':
        await websocket.send_json({'type': EventType.PONG.value, 'payload': {}})
        return
    if event_type == 'message.send':
        message_body = MessageCreate.model_validate(payload)
        conversation_id = str(payload.get('conversation_id', ''))
        if not conversation_id:
            raise ValueError('conversation_id is required')
        await realtime_service.send_message(
            db, conversation_id, user, message_body.body, message_body.client_message_id,
            message_body.reply_to_id, message_body.attachment_ids, acknowledge_sender=True,
        )
        return
    if event_type == 'typing.start' or event_type == 'typing.stop':
        conversation_id = str(payload.get('conversation_id', ''))
        conversation_service.require_member(db, conversation_id, user.id)
        is_typing = event_type == 'typing.start'
        if manager.allow_typing(user.id, conversation_id, 0.35 if is_typing else 0):
            await realtime_service.broadcast_conversation(
                db,
                conversation_id,
                EventType.TYPING,
                {'conversation_id': conversation_id, 'user_id': user.id, 'is_typing': is_typing},
                excluded_user_id=user.id,
            )
        return
    if event_type == 'message.delivered':
        message_id = str(payload.get('message_id', ''))
        receipt = message_service.mark_delivered(db, user.id, message_id)
        if receipt:
            await realtime_service.publish_receipt(db, receipt)
        return
    if event_type == 'conversation.read':
        conversation_id = str(payload.get('conversation_id', ''))
        message_id = str(payload.get('up_to_message_id', ''))
        receipts = message_service.mark_read(db, user, conversation_id, message_id)
        await realtime_service.publish_receipts(db, receipts)
        return
    if event_type in ('reaction.set', 'reaction.remove'):
        message_id = str(payload.get('message_id', ''))
        emoji = ''
        if event_type == 'reaction.set':
            reaction_body = ReactionInput.model_validate(payload)
            emoji = reaction_body.emoji
        await message_service.set_reaction_and_broadcast(
            db, user, message_id, emoji, remove=event_type == 'reaction.remove'
        )
        return
    await websocket.send_json({
        'type': EventType.ERROR.value,
        'payload': {'code': 'UNKNOWN_EVENT', 'message': 'Unsupported event type'},
    })


@router.websocket('/ws')
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = '',
    db: Session = Depends(get_db),
) -> None:
    user = auth_service.validate_websocket_token(db, token)
    if user is None:
        await websocket.close(code=4401)
        return

    first_socket = await manager.connect(user.id, websocket)
    try:
        if first_socket:
            online_user = presence_service.set_online(db, user.id, True)
            await realtime_service.presence_changed(
                db, user.id, True, online_user.last_seen_at if online_user else None
            )
            pending = message_service.mark_pending_delivered(db, user.id)
            await realtime_service.publish_receipts(db, pending)
        while True:
            try:
                frame = await websocket.receive_json()
                manager.touch(websocket)
                if not isinstance(frame, dict):
                    raise ValueError('Frame must be a JSON object')
                await handle_frame(websocket, db, user, frame)
            except ValidationError:
                await websocket.send_json({
                    'type': EventType.ERROR.value,
                    'payload': {'code': 'INVALID_FRAME', 'message': 'Invalid event payload'},
                })
            except (ValueError, KeyError) as error:
                await websocket.send_json({
                    'type': EventType.ERROR.value,
                    'payload': {'code': 'INVALID_FRAME', 'message': str(error)},
                })
            except Exception as error:
                from fastapi import HTTPException
                if isinstance(error, HTTPException):
                    await websocket.send_json({
                        'type': EventType.ERROR.value,
                        'payload': {'code': 'REQUEST_ERROR', 'message': error.detail},
                    })
                else:
                    raise
            finally:
                # WebSocket dependency sessions outlive a single frame. Release any
                # read transaction before awaiting the next frame (notably on SQLite).
                if db.in_transaction():
                    db.commit()
    except WebSocketDisconnect:
        pass
    finally:
        last_socket = manager.disconnect(user.id, websocket)
        if last_socket:
            try:
                offline_user = presence_service.set_online(db, user.id, False)
                await realtime_service.presence_changed(
                    db, user.id, False, offline_user.last_seen_at if offline_user else None
                )
            except Exception:
                from app.core.logging import logger
                logger.exception('Failed to publish websocket offline transition')
