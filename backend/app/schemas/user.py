from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_serializer
from app.core.datetime import utc_iso


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    phone_number: str | None = None
    username: str | None = None
    display_name: str
    about: str
    avatar_url: str | None = None
    avatar_color: str
    is_online: bool
    last_seen_at: datetime

    @field_serializer('last_seen_at')
    def serialize_last_seen_at(self, value: datetime) -> str:
        return utc_iso(value)


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    about: str | None = Field(default=None, max_length=240)
