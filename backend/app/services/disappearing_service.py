from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.message import Message


def expired_messages(db: Session, now: datetime | None = None) -> list[Message]:
    current = now or datetime.now(timezone.utc)
    return list(db.scalars(select(Message).where(
        Message.expires_at.is_not(None), Message.expires_at <= current, Message.deleted_at.is_(None),
    )))


async def purge_expired_and_broadcast(
    db: Session, now: datetime | None = None,
) -> list[str]:
    from app.db.base import utc_now
    from app.services.realtime_service import broadcast_conversation
    from app.ws.events import EventType

    current = now or utc_now()
    messages = expired_messages(db, current)
    for message in messages:
        message.deleted_at = current
        message.body = 'This message expired'
    if messages:
        db.commit()
    for message in messages:
        await broadcast_conversation(
            db,
            message.conversation_id,
            EventType.MESSAGE_DELETED,
            {'message_id': message.id, 'conversation_id': message.conversation_id},
        )
    return [message.id for message in messages]
