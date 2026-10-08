from pathlib import Path
import mimetypes

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.message import Attachment
from app.models.user import User
from app.repositories import attachment_repository, contact_repository, conversation_repository, message_repository, user_repository


def attachment_path(db: Session, requester: User, attachment_id: str) -> tuple[Path, str]:
    attachment = attachment_repository.by_id(db, attachment_id)
    message = message_repository.by_id(db, attachment.message_id) if attachment and attachment.message_id else None
    if attachment is None or message is None:
        raise HTTPException(status_code=404, detail='Attachment not found')
    if conversation_repository.membership(db, message.conversation_id, requester.id) is None:
        raise HTTPException(status_code=403, detail='Conversation membership required')
    return _stored_path(attachment.storage_path), attachment.mime_type


def avatar_path(db: Session, requester: User, user_id: str) -> tuple[Path, str]:
    profile = user_repository.by_id(db, user_id)
    storage_name = profile.avatar_storage_path if profile else None
    if profile is not None and not storage_name and profile.avatar_url:
        storage_name = profile.avatar_url.rsplit('/', 1)[-1]
    if profile is None or not storage_name:
        raise HTTPException(status_code=404, detail='Avatar not found')
    is_contact = (
        contact_repository.by_owner_and_user(db, requester.id, user_id) is not None
        or contact_repository.by_owner_and_user(db, user_id, requester.id) is not None
    )
    if requester.id != user_id and not is_contact:
        raise HTTPException(status_code=403, detail='Avatar is available to contacts only')
    path = _stored_path(storage_name)
    return path, mimetypes.guess_type(path.name)[0] or 'application/octet-stream'


def _stored_path(storage_name: str) -> Path:
    name = Path(storage_name).name
    if name != storage_name or not name:
        raise HTTPException(status_code=404, detail='Media not found')
    path = settings.upload_dir / name
    if not path.is_file():
        raise HTTPException(status_code=404, detail='Media not found')
    return path
