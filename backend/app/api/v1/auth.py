from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import OtpAccepted, OtpRequest, OtpVerify
from app.schemas.user import ProfileUpdate, UserOut
from app.services import auth_service

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/request-otp', response_model=OtpAccepted)
def request_otp(body: OtpRequest, db: Session = Depends(get_db)):
    return auth_service.request_otp(db, body)


@router.post('/verify-otp')
def verify_otp(body: OtpVerify, db: Session = Depends(get_db)):
    result = auth_service.verify_otp(db, body)
    result['user'] = UserOut.model_validate(result['user'])
    return result


@router.put('/profile', response_model=UserOut)
def update_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return auth_service.update_profile(db, user, body)


@router.post('/logout')
def logout(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if authorization is None or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Bearer token required')
    token = authorization.removeprefix('Bearer ')
    return auth_service.logout(db, token, user)


@router.get('/me', response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
