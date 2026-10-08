from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.message import Message, Reaction, Receipt


def by_id(db: Session, message_id: str) -> Message | None:
    return db.get(Message, message_id)


def by_idempotency_key(db: Session, sender_id: str, client_message_id: str) -> Message | None:
    return db.scalar(
        select(Message).where(
            Message.sender_id == sender_id,
            Message.client_message_id == client_message_id,
        )
    )


def history(db: Session, conversation_id: str, before: Message | None, limit: int) -> list[Message]:
    statement = select(Message).where(
        Message.conversation_id == conversation_id,
        Message.deleted_at.is_(None),
    )
    if before is not None:
        statement = statement.where(Message.created_at < before.created_at)
    statement = statement.order_by(Message.created_at.desc()).limit(limit)
    return list(reversed(list(db.scalars(statement))))


def receipts_for_message(db: Session, message_id: str) -> list[Receipt]:
    return list(db.scalars(select(Receipt).where(Receipt.message_id == message_id)))


def reaction_for_user(db: Session, message_id: str, user_id: str) -> Reaction | None:
    return db.scalar(
        select(Reaction).where(Reaction.message_id == message_id, Reaction.user_id == user_id)
    )


def reactions_for_message(db: Session, message_id: str) -> list[Reaction]:
    return list(db.scalars(select(Reaction).where(Reaction.message_id == message_id)))
