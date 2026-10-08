from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, new_id, utc_now


class Contact(Base):
    __tablename__ = 'contacts'
    __table_args__ = (
        UniqueConstraint('owner_id', 'contact_user_id', name='uq_contacts_owner_user'),
        CheckConstraint('owner_id <> contact_user_id', name='ck_contacts_no_self'),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    contact_user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    nickname: Mapped[Optional[str]] = mapped_column(String(80))
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
