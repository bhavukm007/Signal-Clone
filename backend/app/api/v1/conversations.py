from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.conversation import ConversationPatch, DirectCreate
from app.schemas.message import ReadUpTo
from app.services import conversation_service
from app.services import message_service, realtime_service

router = APIRouter(prefix='/conversations', tags=['conversations'])


@router.get('')
def list_conversations(
    q: str | None = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return conversation_service.list_conversations(db, user, q)


@router.post('/direct')
def direct(
    body: DirectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conversation = conversation_service.get_or_create_direct(db, user, body.user_id)
    return {'id': conversation.id, 'type': conversation.type, 'title': conversation.title}


@router.get('/{conversation_id}')
def details(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return conversation_service.detail(db, user, conversation_id)


@router.post('/{conversation_id}/read')
async def mark_read(
    conversation_id: str,
    body: ReadUpTo,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    receipts = message_service.mark_read(db, user, conversation_id, body.up_to_message_id)
    await realtime_service.publish_receipts(db, receipts)
    return {'ok': True, 'updated_receipt_count': len(receipts)}


@router.patch('/{conversation_id}')
def update_conversation(
    conversation_id: str,
    body: ConversationPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conversation = conversation_service.update_conversation(
        db, conversation_id, user, body.is_pinned, body.is_archived,
        body.muted_until, body.disappearing_timer_seconds,
    )
    return {'id': conversation.id, 'disappearing_timer_seconds': conversation.disappearing_timer_seconds}

