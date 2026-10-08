from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.conversation import AddMembers, GroupCreate, GroupUpdate, MemberRole
from app.services import group_service, realtime_service
from app.ws.events import EventType

router = APIRouter(prefix='/groups', tags=['groups'])


async def publish_group_change(db: Session, conversation_id: str, actor_id: str, messages) -> None:
    for message in messages:
        await realtime_service.publish_message(db, message, actor_id, include_sender=True)
    await realtime_service.broadcast_conversation(
        db,
        conversation_id,
        EventType.CONVERSATION_UPDATED,
        {'conversation_id': conversation_id},
    )


@router.post('')
async def create_group(
    body: GroupCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conversation, system_message = group_service.create_group(db, user, body)
    await publish_group_change(db, conversation.id, user.id, [system_message])
    return {'id': conversation.id, 'type': conversation.type, 'title': conversation.title}


@router.get('/{conversation_id}/members')
def list_members(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return group_service.list_members(db, user, conversation_id)


@router.post('/{conversation_id}/members')
async def add_members(
    conversation_id: str,
    body: AddMembers,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    messages = group_service.add_members(db, user, conversation_id, body.user_ids)
    await publish_group_change(db, conversation_id, user.id, messages)
    return {'ok': True, 'added_count': len(messages)}


@router.delete('/{conversation_id}/members/{user_id}')
async def remove_member(
    conversation_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    message = group_service.remove_member(db, user, conversation_id, user_id)
    await publish_group_change(db, conversation_id, user.id, [message])
    return {'ok': True}


@router.patch('/{conversation_id}/members/{user_id}/role')
async def set_member_role(
    conversation_id: str,
    user_id: str,
    body: MemberRole,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    message = group_service.set_role(db, user, conversation_id, user_id, body.role)
    await publish_group_change(db, conversation_id, user.id, [message])
    return {'ok': True, 'role': body.role}


@router.patch('/{conversation_id}')
async def update_group(
    conversation_id: str,
    body: GroupUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    group, message = group_service.update_group(
        db, user, conversation_id, body.name, body.description
    )
    await publish_group_change(db, conversation_id, user.id, [message] if message else [])
    return {'id': group.id, 'title': group.title, 'description': group.description}
