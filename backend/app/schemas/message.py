from datetime import datetime
import unicodedata
from pydantic import BaseModel, Field
from pydantic import field_validator
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
    system_data: dict[str, object] | None = None
    type: str
    client_message_id: str
    created_at: datetime
    edited_at: datetime | None = None
    deleted_at: datetime | None = None
    expires_at: datetime | None = None
    reply_to_id: str | None = None
    status: str = 'sent'
    attachments: list[AttachmentOut] = Field(default_factory=list)


class ReadUpTo(BaseModel):
    up_to_message_id: str


class ReactionInput(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)

    @field_validator('emoji')
    @classmethod
    def validate_emoji_grapheme(cls, value: str) -> str:
        if len(value.encode('utf-8')) > 16:
            raise ValueError('Reaction emoji must be at most 16 UTF-8 bytes')

        regional_start, regional_end = 0x1F1E6, 0x1F1FF
        modifier_start, modifier_end = 0x1F3FB, 0x1F3FF
        allowed_ranges = ((0x1F000, 0x1FAFF), (0x2600, 0x27BF), (0x2300, 0x23FF))

        def emoji_base(character: str) -> bool:
            point = ord(character)
            return point not in range(modifier_start, modifier_end + 1) and any(
                start <= point <= end for start, end in allowed_ranges
            )

        has_emoji = False
        clusters = 0
        join_next = False
        regional_run = 0
        for character in value:
            point = ord(character)
            if point == 0x200D:
                if not has_emoji:
                    raise ValueError('Reaction must be a single emoji grapheme')
                join_next = True
                regional_run = 0
                continue
            extender = (
                point in (0xFE0E, 0xFE0F, 0x20E3)
                or modifier_start <= point <= modifier_end
                or 0xE0020 <= point <= 0xE007F
                or unicodedata.category(character).startswith('M')
            )
            if extender:
                continue
            if regional_start <= point <= regional_end:
                has_emoji = True
                if regional_run % 2 == 0 and not join_next:
                    clusters += 1
                regional_run += 1
                join_next = False
                continue
            regional_run = 0
            if character in '#*0123456789':
                has_emoji = has_emoji or '\u20e3' in value
            elif emoji_base(character):
                has_emoji = True
            else:
                raise ValueError('Reaction must be a single emoji grapheme')
            if not join_next:
                clusters += 1
            join_next = False

        if not has_emoji or join_next or clusters != 1:
            raise ValueError('Reaction must be a single emoji grapheme')
        return value
