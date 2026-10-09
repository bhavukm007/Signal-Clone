from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.rate_limit import auth_rate_limiter
from app.core.phone import normalize_identifier
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import OtpAccepted, OtpRequest, OtpVerify
from app.schemas.user import ProfileUpdate, UserOut
from app.services import auth_service

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/request-otp', response_model=OtpAccepted)
def request_otp(body: OtpRequest, request: Request, db: Session = Depends(get_db)):
    host = request.client.host if request.client else 'unknown'
    try:
        identifier_key = normalize_identifier(body.identifier).casefold()
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    auth_rate_limiter.check(f'otp:{host}:{identifier_key}', 5, 600)
    auth_rate_limiter.check(f'otp-ip:{host}', 120, 60)
    return auth_service.request_otp(db, body.identifier)


@router.post('/verify-otp')
def verify_otp(body: OtpVerify, request: Request, db: Session = Depends(get_db)):
    host = request.client.host if request.client else 'unknown'
    try:
        identifier_key = normalize_identifier(body.identifier).casefold()
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    auth_rate_limiter.check(f'login:{host}:{identifier_key}', 10, 600)
    auth_rate_limiter.check(f'login-ip:{host}', 120, 60)
    result = auth_service.verify_otp(db, body.identifier, body.code)
    result['user'] = UserOut.model_validate(result['user'])
    return result


@router.put('/profile', response_model=UserOut)
def update_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    is_first_profile = not user.display_name.strip()
    updated = auth_service.update_profile(db, user, body.display_name, body.about)
    if is_first_profile and body.display_name.strip():
        from app.services.welcome_bot_service import create_onboarding_conversation
        create_onboarding_conversation(db, updated)
    return updated


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
