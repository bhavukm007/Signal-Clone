from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.base import utc_now
from app.models.user import User


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
    from app.models.conversation import Participant
    conversation_ids = select(Participant.conversation_id).where(Participant.user_id == user_id)
    return set(db.scalars(select(Participant.user_id).where(
        Participant.conversation_id.in_(conversation_ids), Participant.user_id != user_id,
    )).all())
