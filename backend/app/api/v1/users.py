from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import ProfileUpdate, UserOut
from app.services import auth_service, user_service

router = APIRouter(prefix='/users', tags=['users'])


@router.get('/search', response_model=list[UserOut])
def search_users(
    q: str = Query(min_length=1, max_length=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return user_service.search_users(db, q, user)


@router.patch('/me', response_model=UserOut)
def edit_me(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return auth_service.update_profile(db, user, body)
