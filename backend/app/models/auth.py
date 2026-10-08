from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, new_id, utc_now


class OtpChallenge(Base):
    __tablename__ = 'otp_challenges'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    identifier: Mapped[str] = mapped_column(String(120), index=True)
    code: Mapped[str] = mapped_column(String(16))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class AuthSession(Base):
    __tablename__ = 'auth_sessions'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    device_name: Mapped[str] = mapped_column(String(120), default='Web browser')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
