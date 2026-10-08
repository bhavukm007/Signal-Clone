from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, new_id, utc_now


class Conversation(Base):
    __tablename__ = 'conversations'
    __table_args__ = (
        CheckConstraint("type IN ('direct', 'group')", name='ck_conversations_type'),
        Index('ix_conversations_activity', 'last_activity_at'),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    type: Mapped[str] = mapped_column(String(8), default='direct')
    title: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(String(500))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    created_by: Mapped[str] = mapped_column(ForeignKey('users.id'))
    direct_key: Mapped[Optional[str]] = mapped_column(String(73), unique=True)
    disappearing_timer_seconds: Mapped[Optional[int]] = mapped_column(Integer)
    last_message_id: Mapped[Optional[str]] = mapped_column(ForeignKey('messages.id', use_alter=True))
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Participant(Base):
    __tablename__ = 'conversation_participants'
    __table_args__ = (
        UniqueConstraint('conversation_id', 'user_id', name='uq_participants_conversation_user'),
        CheckConstraint("role IN ('admin', 'member')", name='ck_participants_role'),
        Index('ix_participants_user', 'user_id'),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(ForeignKey('conversations.id', ondelete='CASCADE'), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    role: Mapped[str] = mapped_column(String(8), default='member')
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_read_message_id: Mapped[Optional[str]] = mapped_column(ForeignKey('messages.id', use_alter=True))
    muted_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
