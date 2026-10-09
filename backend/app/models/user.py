from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, new_id, utc_now


class User(Base):
    __tablename__ = 'users'
    __table_args__ = (CheckConstraint('phone_number IS NOT NULL OR username IS NOT NULL', name='ck_users_identifier'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    phone_number: Mapped[Optional[str]] = mapped_column(String(32), unique=True)
    username: Mapped[Optional[str]] = mapped_column(String(64), unique=True)
    display_name: Mapped[str] = mapped_column(String(80), default='')
    about: Mapped[str] = mapped_column(String(240), default='Hey there! I am using Signal.')
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    avatar_storage_path: Mapped[Optional[str]] = mapped_column(String(255))
    avatar_color: Mapped[str] = mapped_column(String(7), default='#8298c9')
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    is_discoverable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
