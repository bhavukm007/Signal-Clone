from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if authorization is None or not authorization.startswith('Bearer demo-'):
        raise HTTPException(status_code=401, detail='Bearer token required')
    user_id = authorization.removeprefix('Bearer demo-')
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=401, detail='Invalid or expired token')
    return user
