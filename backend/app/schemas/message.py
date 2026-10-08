from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.attachment import AttachmentOut
from app.schemas.user import UserOut


class MessageCreate(BaseModel):
    body: str = Field(default='', max_length=10000)
    client_message_id: str = Field(min_length=1, max_length=100)
    reply_to_id: str | None = None
    attachment_ids: list[str] = Field(default_factory=list, max_length=10)


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender: UserOut
    body: str
    type: str
    client_message_id: str
    created_at: datetime
    edited_at: datetime | None = None
    deleted_at: datetime | None = None
    reply_to_id: str | None = None
    status: str = 'sent'
    attachments: list[AttachmentOut] = Field(default_factory=list)


class ReadUpTo(BaseModel):
    up_to_message_id: str


class ReactionInput(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)
