from pathlib import Path, PurePath
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.message import Attachment
from app.models.user import User


MIME_EXTENSIONS = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
}


def validate_file(content_type: str | None, file_name: str, content: bytes) -> str:
    mime_type = content_type or 'application/octet-stream'
    if mime_type not in MIME_EXTENSIONS:
        raise HTTPException(status_code=415, detail='File type is not supported')
    if not content:
        raise HTTPException(status_code=422, detail='Empty files are not allowed')
    signatures = {
        'image/jpeg': content.startswith(b'\xff\xd8\xff'),
        'image/png': content.startswith(b'\x89PNG\r\n\x1a\n'),
        'image/gif': content.startswith((b'GIF87a', b'GIF89a')),
        'image/webp': len(content) >= 12 and content[:4] == b'RIFF' and content[8:12] == b'WEBP',
        'application/pdf': content.startswith(b'%PDF-'),
    }
    if mime_type in signatures and not signatures[mime_type]:
        raise HTTPException(status_code=422, detail='File contents do not match the declared type')
    if mime_type == 'text/plain':
        try:
            decoded = content.decode('utf-8')
        except UnicodeDecodeError as error:
            raise HTTPException(status_code=422, detail='Text files must be UTF-8') from error
        if '\x00' in decoded:
            raise HTTPException(status_code=422, detail='Text file contains binary data')
    expected_extension = MIME_EXTENSIONS[mime_type]
    actual_extension = PurePath(file_name).suffix.lower()
    if actual_extension and actual_extension != expected_extension:
        raise HTTPException(status_code=422, detail='File extension does not match its MIME type')
    return mime_type


async def read_validated(upload: UploadFile) -> tuple[bytes, str, str]:
    original_name = Path(upload.filename or 'attachment').name
    content = await upload.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail='File exceeds the upload size limit')
    mime_type = validate_file(upload.content_type, original_name, content)
    return content, original_name, mime_type


def write_file(content: bytes, mime_type: str) -> str:
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    storage_name = f'{uuid4().hex}{MIME_EXTENSIONS[mime_type]}'
    destination = settings.upload_dir / storage_name
    destination.write_bytes(content)
    return storage_name


async def create_attachment(db: Session, owner: User, upload: UploadFile) -> Attachment:
    content, original_name, mime_type = await read_validated(upload)
    storage_name = write_file(content, mime_type)
    attachment = Attachment(
        uploaded_by=owner.id,
        file_name=original_name,
        mime_type=mime_type,
        size_bytes=len(content),
        storage_path=storage_name,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


async def save_avatar(upload: UploadFile) -> str:
    content, _original_name, mime_type = await read_validated(upload)
    if not mime_type.startswith('image/'):
        raise HTTPException(status_code=415, detail='Avatar must be an image')
    return write_file(content, mime_type)


async def update_avatar(db: Session, owner: User, upload: UploadFile) -> dict[str, str]:
    storage_name = await save_avatar(upload)
    owner.avatar_storage_path = storage_name
    owner.avatar_url = f'/api/v1/media/avatars/{owner.id}'
    db.commit()
    db.refresh(owner)
    return {'avatar_url': owner.avatar_url}


def serialize_attachment(attachment: Attachment) -> dict[str, object]:
    return {
        'id': attachment.id,
        'file_name': attachment.file_name,
        'mime_type': attachment.mime_type,
        'size_bytes': attachment.size_bytes,
        'url': f'/api/v1/media/attachments/{attachment.id}',
    }
