from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, desc
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, new_id, utc_now


class Message(Base):
    __tablename__ = 'messages'
    __table_args__ = (
        UniqueConstraint('sender_id', 'client_message_id', name='uq_messages_sender_client_id'),
        CheckConstraint("type IN ('text', 'image', 'file', 'system')", name='ck_messages_type'),
        Index('ix_messages_conversation_created', 'conversation_id', desc('created_at')),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(ForeignKey('conversations.id', ondelete='CASCADE'), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey('users.id'))
    body: Mapped[str] = mapped_column(Text, default='')
    system_data: Mapped[Optional[str]] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(8), default='text')
    reply_to_id: Mapped[Optional[str]] = mapped_column(ForeignKey('messages.id'))
    client_message_id: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)


class Receipt(Base):
    __tablename__ = 'message_receipts'
    __table_args__ = (
        UniqueConstraint('message_id', 'user_id', name='uq_receipts_message_user'),
        CheckConstraint("status IN ('sent', 'delivered', 'read')", name='ck_receipts_status'),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    message_id: Mapped[str] = mapped_column(ForeignKey('messages.id', ondelete='CASCADE'), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    status: Mapped[str] = mapped_column(String(12), default='sent')
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class Reaction(Base):
    __tablename__ = 'message_reactions'
    __table_args__ = (UniqueConstraint('message_id', 'user_id', name='uq_reactions_message_user'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    message_id: Mapped[str] = mapped_column(ForeignKey('messages.id', ondelete='CASCADE'), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    emoji: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Attachment(Base):
    __tablename__ = 'attachments'
    __table_args__ = (CheckConstraint('size_bytes > 0', name='ck_attachments_size_positive'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    message_id: Mapped[str | None] = mapped_column(ForeignKey('messages.id', ondelete='CASCADE'), index=True)
    uploaded_by: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(150))
    size_bytes: Mapped[int] = mapped_column(Integer)
    storage_path: Mapped[str] = mapped_column(String(500))
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)
