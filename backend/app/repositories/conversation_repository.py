from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.conversation import Conversation, Participant


def by_id(db: Session, conversation_id: str) -> Conversation | None:
    return db.get(Conversation, conversation_id)


def membership(db: Session, conversation_id: str, user_id: str) -> Participant | None:
    return db.scalar(
        select(Participant).where(
            Participant.conversation_id == conversation_id,
            Participant.user_id == user_id,
            Participant.left_at.is_(None),
        )
    )


def participants(db: Session, conversation_id: str) -> list[Participant]:
    return list(
        db.scalars(
            select(Participant).where(
                Participant.conversation_id == conversation_id,
                Participant.left_at.is_(None),
            )
        )
    )


def for_user(db: Session, user_id: str) -> list[Participant]:
    return list(
        db.scalars(
            select(Participant).where(
                Participant.user_id == user_id,
                Participant.left_at.is_(None),
                Participant.is_archived.is_(False),
            )
        )
    )
