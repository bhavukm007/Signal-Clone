from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import utc_now
from app.models.contact import Contact
from app.models.conversation import Participant
from app.models.user import User
from app.repositories.contact_repository import is_blocked


def set_online(db: Session, user_id: str, online: bool) -> User | None:
    user = db.get(User, user_id)
    if user is not None:
        user.is_online = online
        if not online:
            user.last_seen_at = utc_now()
        db.commit()
        db.refresh(user)
    return user


def relevant_user_ids(db: Session, user_id: str) -> set[str]:
    conversation_ids = select(Participant.conversation_id).where(
        Participant.user_id == user_id, Participant.left_at.is_(None)
    )
    shared = set(db.scalars(select(Participant.user_id).where(
        Participant.conversation_id.in_(conversation_ids),
        Participant.user_id != user_id,
        Participant.left_at.is_(None),
    )).all())
    inbound = set(db.scalars(select(Contact.owner_id).where(Contact.contact_user_id == user_id)).all())
    outbound = set(db.scalars(select(Contact.contact_user_id).where(Contact.owner_id == user_id)).all())
    candidates = shared | inbound | outbound
    return {
        candidate for candidate in candidates
        if not is_blocked(db, candidate, user_id) and not is_blocked(db, user_id, candidate)
    }
