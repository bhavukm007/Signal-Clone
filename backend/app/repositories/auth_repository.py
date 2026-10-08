from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth import AuthSession, OtpChallenge


def latest_otp(db: Session, identifier: str) -> OtpChallenge | None:
    return db.scalar(
        select(OtpChallenge)
        .where(OtpChallenge.identifier == identifier, OtpChallenge.consumed_at.is_(None))
        .order_by(OtpChallenge.expires_at.desc())
    )


def sessions_for_token(db: Session, token_hash: str) -> AuthSession | None:
    return db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash))
