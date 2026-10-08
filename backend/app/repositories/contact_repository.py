from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.contact import Contact


def list_for_owner(db: Session, owner_id: str) -> list[Contact]:
    return list(db.scalars(select(Contact).where(Contact.owner_id == owner_id).order_by(Contact.created_at)))


def by_id_and_owner(db: Session, contact_id: str, owner_id: str) -> Contact | None:
    return db.scalar(select(Contact).where(Contact.id == contact_id, Contact.owner_id == owner_id))


def by_owner_and_user(db: Session, owner_id: str, user_id: str) -> Contact | None:
    return db.scalar(
        select(Contact).where(Contact.owner_id == owner_id, Contact.contact_user_id == user_id)
    )


def is_blocked(db: Session, owner_id: str, user_id: str) -> bool:
    return db.scalar(select(Contact.id).where(
        Contact.owner_id == owner_id,
        Contact.contact_user_id == user_id,
        Contact.is_blocked.is_(True),
    )) is not None
