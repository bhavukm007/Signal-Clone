from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.message import MessageCreate, ReactionInput
from app.services import message_service
from app.services import realtime_service

router = APIRouter(tags=['messages'])


@router.get('/conversations/{conversation_id}/messages')
def list_messages(
    conversation_id: str,
    before: str | None = None,
    limit: int = Query(default=30, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    messages = message_service.get_history(db, user, conversation_id, before, limit)
    return [message_service.serialize_message(db, message) for message in messages]


@router.post('/conversations/{conversation_id}/messages')
async def create_message(
    conversation_id: str,
    body: MessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    message = message_service.create_message(db, conversation_id, user, body)
    await realtime_service.publish_message(db, message, user.id)
    return message_service.serialize_message(db, message)


@router.delete('/messages/{message_id}')
async def delete_message(
    message_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    message = message_service.delete_message(db, user, message_id)
    from app.ws.events import EventType
    from app.services.realtime_service import broadcast_conversation
    await broadcast_conversation(db, message.conversation_id, EventType.MESSAGE_DELETED, {
        'message_id': message.id, 'conversation_id': message.conversation_id,
    })
    return {'id': message.id, 'deleted_at': message.deleted_at}


@router.put('/messages/{message_id}/reaction')
async def set_reaction(
    message_id: str,
    body: ReactionInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    reaction = message_service.set_reaction(db, user, message_id, body.emoji)
    from app.repositories.message_repository import by_id
    from app.services.realtime_service import broadcast_conversation
    from app.ws.events import EventType
    message = by_id(db, message_id)
    if message:
        await broadcast_conversation(db, message.conversation_id, EventType.REACTION_UPDATED, {
            'message_id': message_id, 'user_id': user.id, 'emoji': reaction.emoji if reaction else body.emoji,
        })
    return {'ok': True, 'emoji': reaction.emoji if reaction else body.emoji}


@router.delete('/messages/{message_id}/reaction')
async def remove_reaction(
    message_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    message_service.set_reaction(db, user, message_id, '', remove=True)
    from app.repositories.message_repository import by_id
    from app.services.realtime_service import broadcast_conversation
    from app.ws.events import EventType
    message = by_id(db, message_id)
    if message:
        await broadcast_conversation(db, message.conversation_id, EventType.REACTION_UPDATED, {
            'message_id': message_id, 'user_id': user.id, 'emoji': None,
        })
    return {'ok': True}
