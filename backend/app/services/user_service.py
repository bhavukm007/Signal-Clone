from sqlalchemy.orm import Session
from app.models.user import User
from app.repositories import user_repository


def search_users(db: Session, query: str, current_user: User) -> list[User]:
    return user_repository.search(db, query, current_user.id)
