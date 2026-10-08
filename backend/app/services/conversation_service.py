from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import utc_now
from app.models.conversation import Conversation, Participant
from app.models.message import Message
from app.models.user import User
from app.repositories import conversation_repository, message_repository, user_repository
from app.services.message_service import serialize_message
from app.schemas.conversation import ConversationPatch, DirectCreate


def require_member(db: Session, conversation_id: str, user_id: str) -> Participant:
    participant = conversation_repository.membership(db, conversation_id, user_id)
    if participant is None:
        raise HTTPException(status_code=403, detail='Conversation membership required')
    return participant


def get_or_create_direct(db: Session, user: User, body: DirectCreate) -> Conversation:
    other = user_repository.by_id(db, body.user_id)
    if other is None:
        raise HTTPException(status_code=404, detail='User not found')
    if other.id == user.id:
        raise HTTPException(status_code=422, detail='Cannot create a conversation with yourself')
    key = ':'.join(sorted((user.id, other.id)))
    conversation = db.scalar(select(Conversation).where(Conversation.direct_key == key))
    if conversation is None:
        conversation = Conversation(type='direct', created_by=user.id, direct_key=key)
        db.add(conversation)
        db.flush()
        db.add_all([
            Participant(conversation_id=conversation.id, user_id=user.id, role='admin'),
            Participant(conversation_id=conversation.id, user_id=other.id),
        ])
        db.commit()
        db.refresh(conversation)
    return conversation


def list_conversations(db: Session, user: User, query: str | None) -> list[dict[str, object]]:
    result = []
    for membership in conversation_repository.for_user(db, user.id):
        conversation = conversation_repository.by_id(db, membership.conversation_id)
        participants = [p for p in conversation_repository.participants(db, conversation.id) if p.user_id != user.id]
        others = [user_repository.by_id(db, p.user_id) for p in participants]
        title = conversation.title or (others[0].display_name if others and others[0] else 'Unknown')
        if query and query.casefold() not in title.casefold() and not any(
            person and query.casefold() in (person.display_name + ' ' + (person.username or '')).casefold()
            for person in others
        ):
            continue
        last = message_repository.by_id(db, conversation.last_message_id) if conversation.last_message_id else None
        unread = 0
        if membership.last_read_message_id:
            cursor = message_repository.by_id(db, membership.last_read_message_id)
            if cursor:
                unread = len(db.scalars(select(Message).where(
                    Message.conversation_id == conversation.id,
                    Message.created_at > cursor.created_at,
                    Message.sender_id != user.id,
                    Message.deleted_at.is_(None),
                )).all())
        else:
            unread = len(db.scalars(select(Message).where(
                Message.conversation_id == conversation.id,
                Message.sender_id != user.id,
                Message.deleted_at.is_(None),
            )).all())
        other = next((person for person in others if person is not None), None)
        result.append({
            'id': conversation.id, 'type': conversation.type, 'title': title,
            'participants': [person for person in others if person],
            'last_message': serialize_message(db, last) if last else None,
            'last_activity_at': conversation.last_activity_at,
            'unread_count': unread, 'is_pinned': membership.is_pinned,
            'muted_until': membership.muted_until,
            'is_online': bool(other and other.is_online),
            'last_seen_at': other.last_seen_at if other else None,
            'avatar_color': other.avatar_color if other else '#3A76F0',
            'disappearing_timer_seconds': conversation.disappearing_timer_seconds,
        })
    return sorted(result, key=lambda item: (not item['is_pinned'], -item['last_activity_at'].timestamp()))


def update_conversation(db: Session, conversation_id: str, user: User, body: ConversationPatch) -> Conversation:
    participant = require_member(db, conversation_id, user.id)
    conversation = conversation_repository.by_id(db, conversation_id)
    for field in ('is_pinned', 'is_archived', 'muted_until'):
        value = getattr(body, field)
        if value is not None:
            setattr(participant, field, value)
    if body.disappearing_timer_seconds is not None:
        conversation.disappearing_timer_seconds = body.disappearing_timer_seconds or None
    db.commit()
    db.refresh(conversation)
    return conversation


def detail(db: Session, user: User, conversation_id: str) -> dict[str, object]:
    require_member(db, conversation_id, user.id)
    conversation = conversation_repository.by_id(db, conversation_id)
    return {
        'id': conversation.id,
        'type': conversation.type,
        'title': conversation.title,
        'description': conversation.description,
        'disappearing_timer_seconds': conversation.disappearing_timer_seconds,
        'participants': [
            {'role': row.role, 'user': user_repository.by_id(db, row.user_id)}
            for row in conversation_repository.participants(db, conversation_id)
        ],
    }


