from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.auth_service import validate_token
from app.models.user import User


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if authorization is None or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Bearer token required')
    user = validate_token(db, authorization.removeprefix('Bearer '))
    if user is None:
        raise HTTPException(status_code=401, detail='Invalid or expired token')
    return user
