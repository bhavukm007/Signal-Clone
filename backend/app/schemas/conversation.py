from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.user import UserOut


class ContactCreate(BaseModel):
    user_id: str | None = None
    identifier: str | None = Field(default=None, min_length=3, max_length=120)


class ContactOut(BaseModel):
    id: str
    user: UserOut
    nickname: str | None = None
    is_blocked: bool


class DirectCreate(BaseModel):
    user_id: str


class ConversationPatch(BaseModel):
    is_pinned: bool | None = None
    is_archived: bool | None = None
    muted_until: datetime | None = None
    mute_notifications: bool | None = None
    disappearing_timer_seconds: int | None = Field(default=None, ge=0, le=31536000)


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    member_ids: list[str] = Field(default_factory=list)


class AddMembers(BaseModel):
    user_ids: list[str] = Field(min_length=1, max_length=100)


class MemberRole(BaseModel):
    role: str = Field(pattern='^(admin|member)$')
from pydantic import BaseModel, Field


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
