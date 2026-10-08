from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import utc_now
from app.models.auth import OtpChallenge
from app.models.user import User
from app.repositories import auth_repository, user_repository
from app.schemas.auth import OtpRequest, OtpVerify
from app.schemas.user import ProfileUpdate


def request_otp(db: Session, body: OtpRequest) -> dict[str, object]:
    db.add(OtpChallenge(identifier=body.identifier, code=settings.otp_code, expires_at=utc_now() + timedelta(minutes=10)))
    db.commit()
    return {'ok': True, 'hint': 'Use 123456'}


def verify_otp(db: Session, body: OtpVerify) -> dict[str, object]:
    challenge = auth_repository.latest_otp(db, body.identifier)
    if challenge is None or body.code != settings.otp_code:
        raise HTTPException(status_code=401, detail='Invalid or expired verification code')
    expiry = challenge.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=utc_now().tzinfo)
    if expiry < utc_now():
        raise HTTPException(status_code=401, detail='Invalid or expired verification code')
    challenge.consumed_at = utc_now()
    user = user_repository.by_identifier(db, body.identifier)
    is_new = user is None
    if user is None:
        user = User(
            phone_number=body.identifier if body.identifier.startswith('+') else None,
            username=None if body.identifier.startswith('+') else body.identifier,
            display_name='',
        )
        user_repository.create(db, user)
    db.commit()
    db.refresh(user)
    return {'token': f'demo-{user.id}', 'user': user, 'is_new_user': is_new}


def update_profile(db: Session, user: User, body: ProfileUpdate) -> User:
    user.display_name = body.display_name
    if body.about is not None:
        user.about = body.about
    db.commit()
    db.refresh(user)
    return user


def logout() -> dict[str, bool]:
    return {'ok': True}


def validate_demo_token(db: Session, token: str):
    if not token.startswith('demo-'):
        return None
    return user_repository.by_id(db, token.removeprefix('demo-'))
