from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.message import Attachment


def by_id(db: Session, attachment_id: str) -> Attachment | None:
    return db.get(Attachment, attachment_id)


def for_message(db: Session, message_id: str) -> list[Attachment]:
    return list(db.scalars(select(Attachment).where(Attachment.message_id == message_id)))
