from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.user import User


def by_id(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def by_identifier(db: Session, identifier: str) -> User | None:
    return db.scalar(
        select(User).where(or_(User.phone_number == identifier, User.username == identifier))
    )


def create(db: Session, user: User) -> User:
    db.add(user)
    db.flush()
    return user


def search(db: Session, query: str, excluded_user_id: str) -> list[User]:
    pattern = f'%{query}%'
    statement = select(User).where(
        User.id != excluded_user_id,
        or_(User.display_name.ilike(pattern), User.phone_number.ilike(pattern), User.username.ilike(pattern)),
    ).limit(20)
    return list(db.scalars(statement))
