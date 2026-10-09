from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_session_token, hash_token
from app.core.phone import normalize_identifier
from app.db.base import utc_now
from app.models.auth import AuthSession, OtpChallenge
from app.models.user import User
from app.repositories import auth_repository, user_repository


def request_otp(db: Session, identifier: str) -> dict[str, object]:
    identifier = normalize_identifier(identifier)
    db.add(OtpChallenge(identifier=identifier, code=settings.otp_code, expires_at=utc_now() + timedelta(minutes=10)))
    db.commit()
    return {'ok': True, 'demo_code': settings.otp_code}


def verify_otp(db: Session, identifier: str, code: str) -> dict[str, object]:
    identifier = normalize_identifier(identifier)
    challenge = auth_repository.latest_otp(db, identifier)
    if challenge is None or code != settings.otp_code:
        raise HTTPException(status_code=401, detail='Invalid or expired verification code')
    expiry = challenge.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=utc_now().tzinfo)
    if expiry < utc_now():
        raise HTTPException(status_code=401, detail='Invalid or expired verification code')
    challenge.consumed_at = utc_now()
    user = user_repository.by_identifier(db, identifier)
    is_new = user is None
    if user is None:
        user = User(
            phone_number=identifier if identifier.startswith('+') else None,
            username=None if identifier.startswith('+') else identifier,
            display_name='',
        )
        user_repository.create(db, user)
    token = create_session_token()
    db.add(AuthSession(
        user_id=user.id,
        token_hash=hash_token(token),
        device_name='Web browser',
        expires_at=utc_now() + timedelta(days=30),
    ))
    db.commit()
    db.refresh(user)
    return {'token': token, 'user': user, 'is_new_user': is_new}


def update_profile(db: Session, user: User, display_name: str, about: str | None) -> User:
    user.display_name = display_name
    if about is not None:
        user.about = about
    db.commit()
    db.refresh(user)
    return user


def validate_token(db: Session, token: str) -> User | None:
    session = auth_repository.sessions_for_token(db, hash_token(token))
    if session is None or session.revoked_at is not None:
        return None
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=utc_now().tzinfo)
    if expires_at <= utc_now():
        session.revoked_at = utc_now()
        db.commit()
        return None
    return user_repository.by_id(db, session.user_id)


def logout(db: Session, token: str, user: User) -> dict[str, bool]:
    session = auth_repository.sessions_for_token(db, hash_token(token))
    if session is None or session.user_id != user.id or session.revoked_at is not None:
        raise HTTPException(status_code=401, detail='Invalid or revoked session')
    session.revoked_at = utc_now()
    db.commit()
    return {'ok': True}


def validate_websocket_token(db: Session, token: str) -> User | None:
    return validate_token(db, token)
