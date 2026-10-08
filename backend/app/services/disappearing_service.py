from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.message import Message


def expired_messages(db: Session, now: datetime | None = None) -> list[Message]:
    current = now or datetime.now(timezone.utc)
    return list(db.scalars(select(Message).where(
        Message.expires_at.is_not(None), Message.expires_at <= current, Message.deleted_at.is_(None),
    )))
