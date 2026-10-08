from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.message import Message, Receipt


def pending_delivery(db: Session, user_id: str) -> list[Receipt]:
    return list(
        db.scalars(
            select(Receipt)
            .where(Receipt.user_id == user_id, Receipt.status == 'delivered')
            .join(Message)
            .where(Message.created_at > Receipt.delivered_at)
        )
    )
