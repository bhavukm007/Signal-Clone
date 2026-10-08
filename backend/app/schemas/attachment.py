from pydantic import BaseModel


class AttachmentOut(BaseModel):
    id: str
    file_name: str
    mime_type: str
    size_bytes: int
    url: str
