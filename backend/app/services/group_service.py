from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.base import utc_now
from app.models.conversation import Conversation, Participant
from app.models.message import Message
from app.models.user import User
from app.repositories import conversation_repository, user_repository
from app.services.message_service import create_system_message


def require_group(db: Session, conversation_id: str) -> Conversation:
    conversation = conversation_repository.by_id(db, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail='Group not found')
    if conversation.type != 'group':
        raise HTTPException(status_code=422, detail='Conversation is not a group')
    return conversation


def list_members(db: Session, user: User, conversation_id: str) -> list[dict[str, object]]:
    require_group(db, conversation_id)
    if conversation_repository.membership(db, conversation_id, user.id) is None:
        raise HTTPException(status_code=403, detail='Conversation membership required')
    return [
        {'user': user_repository.by_id(db, row.user_id), 'role': row.role, 'joined_at': row.joined_at}
        for row in conversation_repository.participants(db, conversation_id)
    ]


def create_group(
    db: Session, creator: User, name: str, member_ids: list[str], description: str | None,
) -> tuple[Conversation, Message]:
    conversation = Conversation(
        type='group', title=name, description=description, created_by=creator.id
    )
    db.add(conversation)
    db.flush()
    db.add(Participant(conversation_id=conversation.id, user_id=creator.id, role='admin'))
    for member_id in set(member_ids):
        if member_id == creator.id:
            continue
        if user_repository.by_id(db, member_id) is None:
            raise HTTPException(status_code=404, detail=f'User {member_id} not found')
        db.add(Participant(conversation_id=conversation.id, user_id=member_id))
    db.commit()
    db.refresh(conversation)
    message = create_system_message(
        db, conversation.id, creator, f'{creator.display_name} created the group',
        {'event': 'group_created', 'actor_id': creator.id, 'group_name': name},
    )
    return conversation, message


def add_members(db: Session, actor: User, conversation_id: str, user_ids: list[str]) -> list[Message]:
    require_group(db, conversation_id)
    membership = conversation_repository.membership(db, conversation_id, actor.id)
    if membership is None or membership.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin role required')
    added: list[User] = []
    for user_id in set(user_ids):
        target_user = user_repository.by_id(db, user_id)
        if target_user is None:
            raise HTTPException(status_code=404, detail=f'User {user_id} not found')
        previous_membership = conversation_repository.membership_any(db, conversation_id, user_id)
        if previous_membership is None:
            db.add(Participant(conversation_id=conversation_id, user_id=user_id))
            added.append(target_user)
        elif previous_membership.left_at is not None:
            previous_membership.left_at = None
            previous_membership.joined_at = utc_now()
            previous_membership.role = 'member'
            added.append(target_user)
    db.commit()
    return [
        create_system_message(
            db, conversation_id, actor, f'{actor.display_name} added {target.display_name}',
            {'event': 'member_added', 'actor_id': actor.id, 'target_id': target.id,
             'target_name': target.display_name},
        )
        for target in added
    ]


def remove_member(db: Session, actor: User, conversation_id: str, target_id: str) -> Message:
    require_group(db, conversation_id)
    actor_row = conversation_repository.membership(db, conversation_id, actor.id)
    target = conversation_repository.membership(db, conversation_id, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail='Group member not found')
    if actor.id == target_id and target.role == 'admin' and sum(
        row.role == 'admin' for row in conversation_repository.participants(db, conversation_id)
    ) <= 1:
        raise HTTPException(status_code=409, detail='The last admin must promote another member first')
    if actor.id != target_id and (actor_row is None or actor_row.role != 'admin'):
        raise HTTPException(status_code=403, detail='Admin role required')
    target_user = user_repository.by_id(db, target_id)
    target.left_at = utc_now()
    db.commit()
    if actor.id == target_id:
        body = f'{target_user.display_name} left the group'
    else:
        body = f'{actor.display_name} removed {target_user.display_name}'
    return create_system_message(
        db, conversation_id, actor, body,
        {
            'event': 'member_left' if actor.id == target_id else 'member_removed',
            'actor_id': actor.id,
            'target_id': target_id,
            'target_name': target_user.display_name,
        },
    )


def set_role(db: Session, actor: User, conversation_id: str, target_id: str, role: str) -> Message:
    require_group(db, conversation_id)
    actor_row = conversation_repository.membership(db, conversation_id, actor.id)
    target = conversation_repository.membership(db, conversation_id, target_id)
    if actor_row is None or actor_row.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin role required')
    if target is None:
        raise HTTPException(status_code=404, detail='Group member not found')
    if target.role == 'admin' and role == 'member' and sum(
        row.role == 'admin' for row in conversation_repository.participants(db, conversation_id)
    ) <= 1:
        raise HTTPException(status_code=409, detail='The group must keep at least one admin')
    target.role = role
    target_user = user_repository.by_id(db, target_id)
    db.commit()
    body = (
        f'{actor.display_name} made {target_user.display_name} an admin'
        if role == 'admin'
        else f'{actor.display_name} removed admin from {target_user.display_name}'
    )
    return create_system_message(
        db, conversation_id, actor, body,
        {'event': 'member_role_changed', 'actor_id': actor.id, 'target_id': target_id,
         'target_name': target_user.display_name, 'role': role},
    )


def update_group(
    db: Session,
    actor: User,
    conversation_id: str,
    title: str | None,
    description: str | None,
) -> tuple[Conversation, Message | None]:
    conversation = require_group(db, conversation_id)
    membership = conversation_repository.membership(db, conversation_id, actor.id)
    if membership is None or membership.role != 'admin':
        raise HTTPException(status_code=403, detail='Admin role required')
    changes = []
    if title is not None and title != conversation.title:
        conversation.title = title
        changes.append(f'{actor.display_name} changed the group name to {title}')
    if description is not None and description != conversation.description:
        conversation.description = description
        changes.append(f'{actor.display_name} updated the group description')
    db.commit()
    db.refresh(conversation)
    message = None
    if changes:
        event = 'group_renamed' if title is not None and changes[0].startswith(actor.display_name) else 'group_updated'
        message = create_system_message(
            db, conversation_id, actor, changes[0],
            {'event': event, 'actor_id': actor.id, 'group_name': conversation.title},
        )
    return conversation, message


async def publish_changes(
    db: Session, conversation_id: str, actor_id: str, messages: list[Message],
) -> None:
    from app.services import realtime_service
    from app.ws.events import EventType
    for message in messages:
        await realtime_service.publish_message(db, message, actor_id, include_sender=True)
    await realtime_service.broadcast_conversation(
        db, conversation_id, EventType.CONVERSATION_UPDATED,
        {'conversation_id': conversation_id},
    )
