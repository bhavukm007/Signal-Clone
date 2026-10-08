from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import utc_now
from app.models.conversation import Conversation, Participant
from app.models.message import Message
from app.models.user import User
from app.repositories import conversation_repository, message_repository, user_repository


def list_members(db: Session, user: User, conversation_id: str) -> list[dict[str, object]]:
    conversation_service_member = conversation_repository.membership(db, conversation_id, user.id)
    if conversation_service_member is None:
        raise HTTPException(status_code=403, detail='Conversation membership required')
    return [
        {'user': user_repository.by_id(db, row.user_id), 'role': row.role, 'joined_at': row.joined_at}
        for row in conversation_repository.participants(db, conversation_id)
    ]


def add_members(db: Session, actor: User, conversation_id: str, user_ids: list[str]) -> list[Participant]:
    membership = conversation_repository.membership(db, conversation_id, actor.id)
    if membership is None or membership.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin role required')
    added = []
    for user_id in set(user_ids):
        if user_repository.by_id(db, user_id) is None:
            raise HTTPException(status_code=404, detail=f'User {user_id} not found')
        if conversation_repository.membership(db, conversation_id, user_id) is None:
            row = Participant(conversation_id=conversation_id, user_id=user_id)
            db.add(row)
            added.append(row)
    db.commit()
    for row in added:
        db.refresh(row)
    return added


def remove_member(db: Session, actor: User, conversation_id: str, target_id: str) -> None:
    actor_row = conversation_repository.membership(db, conversation_id, actor.id)
    target = conversation_repository.membership(db, conversation_id, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail='Group member not found')
    if actor.id != target_id and (actor_row is None or actor_row.role != 'admin'):
        raise HTTPException(status_code=403, detail='Admin role required')
    target.left_at = utc_now()
    db.commit()


def set_role(db: Session, actor: User, conversation_id: str, target_id: str, role: str) -> None:
    actor_row = conversation_repository.membership(db, conversation_id, actor.id)
    target = conversation_repository.membership(db, conversation_id, target_id)
    if actor_row is None or actor_row.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin role required')
    if target is None:
        raise HTTPException(status_code=404, detail='Group member not found')
    target.role = role
    db.commit()


def update_group(db: Session, actor: User, conversation_id: str, title: str | None, description: str | None) -> Conversation:
    membership = conversation_repository.membership(db, conversation_id, actor.id)
    if membership is None or membership.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin role required')
    conversation = conversation_repository.by_id(db, conversation_id)
    if conversation.type != 'group':
        raise HTTPException(status_code=422, detail='Conversation is not a group')
    if title is not None:
        conversation.title = title
    if description is not None:
        conversation.description = description
    db.commit()
    db.refresh(conversation)
    return conversation
