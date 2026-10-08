from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import utc_now
from app.models.conversation import Conversation, Participant
from app.models.message import Message
from app.models.contact import Contact
from app.models.user import User
from app.repositories import conversation_repository, message_repository, user_repository
from app.repositories.contact_repository import is_blocked
from app.services.presentation_service import serialize_user


def require_member(db: Session, conversation_id: str, user_id: str) -> Participant:
    participant = conversation_repository.membership(db, conversation_id, user_id)
    if participant is None:
        raise HTTPException(status_code=403, detail='Conversation membership required')
    return participant


def get_or_create_direct(db: Session, user: User, user_id: str) -> Conversation:
    other = user_repository.by_id(db, user_id)
    if other is None:
        raise HTTPException(status_code=404, detail='User not found')
    if other.id == user.id:
        raise HTTPException(status_code=422, detail='Cannot create a conversation with yourself')
    key = ':'.join(sorted((user.id, other.id)))
    conversation = db.scalar(select(Conversation).where(Conversation.direct_key == key))
    if conversation is None:
        conversation = Conversation(type='direct', created_by=user.id, direct_key=key)
        db.add(conversation)
        try:
            db.flush()
            db.add_all([
                Participant(conversation_id=conversation.id, user_id=user.id, role='admin'),
                Participant(conversation_id=conversation.id, user_id=other.id),
            ])
            db.commit()
        except IntegrityError:
            db.rollback()
            concurrent_winner = db.scalar(
                select(Conversation).where(Conversation.direct_key == key)
            )
            if concurrent_winner is None:
                raise
            return concurrent_winner
        db.refresh(conversation)
    return conversation


def list_conversations(db: Session, user: User, query: str | None) -> list[dict[str, object]]:
    cursor_time = select(Message.created_at).where(
        Message.id == Participant.last_read_message_id
    ).scalar_subquery()
    unread_count = select(func.count(Message.id)).where(
        Message.conversation_id == Conversation.id,
        Message.sender_id != user.id,
        Message.deleted_at.is_(None),
        or_(Participant.last_read_message_id.is_(None), Message.created_at > cursor_time),
    ).correlate(Conversation, Participant).scalar_subquery()
    rows = db.execute(
        select(Participant, Conversation, unread_count)
        .join(Conversation, Conversation.id == Participant.conversation_id)
        .where(
            Participant.user_id == user.id,
            Participant.left_at.is_(None),
            Participant.is_archived.is_(False),
        )
    ).all()
    conversation_ids = [conversation.id for _membership, conversation, _count in rows]
    participant_rows = db.execute(
        select(Participant.conversation_id, User)
        .join(User, User.id == Participant.user_id)
        .where(Participant.conversation_id.in_(conversation_ids), Participant.left_at.is_(None))
    ).all()
    users_by_conversation: dict[str, list[User]] = {}
    for conversation_id, participant_user in participant_rows:
        if participant_user.id != user.id:
            users_by_conversation.setdefault(conversation_id, []).append(participant_user)
    last_message_ids = [conversation.last_message_id for _, conversation, _ in rows if conversation.last_message_id]
    last_rows = db.execute(
        select(Message, User).join(User, User.id == Message.sender_id)
        .where(Message.id.in_(last_message_ids))
    ).all()
    last_by_id = {message.id: (message, sender) for message, sender in last_rows}
    blocked_pairs = set(db.execute(
        select(Contact.owner_id, Contact.contact_user_id).where(
            Contact.is_blocked.is_(True),
            or_(Contact.owner_id == user.id, Contact.contact_user_id == user.id),
        )
    ).all())

    result: list[dict[str, object]] = []
    for membership, conversation, unread in rows:
        peers = users_by_conversation.get(conversation.id, [])
        title = conversation.title or (peers[0].display_name if peers else 'Unknown')
        if query and query.casefold() not in title.casefold() and not any(
            query.casefold() in (peer.display_name + ' ' + (peer.username or '')).casefold()
            for peer in peers
        ):
            continue
        first_peer = peers[0] if peers else None
        last_row = last_by_id.get(conversation.last_message_id)
        preview = None
        if last_row:
            message, sender = last_row
            preview = {
                'id': message.id,
                'sender_id': message.sender_id,
                'sender': serialize_user(sender),
                'body': message.body,
                'type': message.type,
                'created_at': message.created_at.isoformat(),
            }
        result.append({
            'id': conversation.id, 'type': conversation.type, 'title': title,
            'participants': [serialize_user(peer) for peer in peers],
            'last_message': preview,
            'last_activity_at': conversation.last_activity_at,
            'unread_count': unread, 'is_pinned': membership.is_pinned,
            'muted_until': membership.muted_until,
            'is_online': bool(first_peer and first_peer.is_online),
            'last_seen_at': first_peer.last_seen_at if first_peer else None,
            'avatar_color': first_peer.avatar_color if first_peer else '#3A76F0',
            'disappearing_timer_seconds': conversation.disappearing_timer_seconds,
            'is_blocked_by_me': bool(first_peer and (user.id, first_peer.id) in blocked_pairs),
        })
    return sorted(result, key=lambda item: (not item['is_pinned'], -item['last_activity_at'].timestamp()))


def update_conversation(
    db: Session,
    conversation_id: str,
    user: User,
    is_pinned: bool | None,
    is_archived: bool | None,
    muted_until,
    disappearing_timer_seconds: int | None,
) -> Conversation:
    participant = require_member(db, conversation_id, user.id)
    conversation = conversation_repository.by_id(db, conversation_id)
    for field in ('is_pinned', 'is_archived', 'muted_until'):
        value = {'is_pinned': is_pinned, 'is_archived': is_archived, 'muted_until': muted_until}[field]
        if value is not None:
            setattr(participant, field, value)
    if disappearing_timer_seconds is not None:
        conversation.disappearing_timer_seconds = disappearing_timer_seconds or None
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
        'is_blocked_by_me': _peer_block_state(db, conversation, user.id, True),
        'is_blocked_by_peer': _peer_block_state(db, conversation, user.id, False),
    }


def _peer_block_state(
    db: Session, conversation: Conversation, user_id: str, own_block: bool,
) -> bool:
    if conversation.type != 'direct':
        return False
    peer = next(
        (row.user_id for row in conversation_repository.participants(db, conversation.id)
         if row.user_id != user_id),
        None,
    )
    if peer is None:
        return False
    return is_blocked(db, user_id, peer) if own_block else is_blocked(db, peer, user_id)


