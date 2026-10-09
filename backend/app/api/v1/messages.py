from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.message import MessageCreate, ReactionInput
from app.services import message_service, realtime_service
from app.core.datetime import utc_iso

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
    message = await realtime_service.send_message(
        db, conversation_id, user, body.body, body.client_message_id,
        body.reply_to_id, body.attachment_ids,
    )
    return message_service.serialize_message(db, message)


@router.delete('/messages/{message_id}')
async def delete_message(
    message_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    message = await message_service.delete_and_broadcast(db, user, message_id)
    return {'id': message.id, 'deleted_at': utc_iso(message.deleted_at)}


@router.put('/messages/{message_id}/reaction')
async def set_reaction(
    message_id: str,
    body: ReactionInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    reaction = await message_service.set_reaction_and_broadcast(db, user, message_id, body.emoji)
    return {'ok': True, 'emoji': reaction.emoji if reaction else body.emoji}


@router.delete('/messages/{message_id}/reaction')
async def remove_reaction(
    message_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await message_service.set_reaction_and_broadcast(db, user, message_id, '', remove=True)
    return {'ok': True}
