from pathlib import Path
import mimetypes

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.message import Attachment, Message
from app.models.user import User
from app.repositories import attachment_repository, contact_repository, conversation_repository, message_repository, user_repository
from app.services.presentation_service import serialize_user
from app.core.datetime import utc_iso


def attachment_path(db: Session, requester: User, attachment_id: str) -> tuple[Path, str, str]:
    attachment = attachment_repository.by_id(db, attachment_id)
    message = message_repository.by_id(db, attachment.message_id) if attachment and attachment.message_id else None
    if attachment is None or message is None:
        raise HTTPException(status_code=404, detail='Attachment not found')
    if conversation_repository.membership(db, message.conversation_id, requester.id) is None:
        raise HTTPException(status_code=403, detail='Conversation membership required')
    return _stored_path(attachment.storage_path), attachment.mime_type, attachment.file_name


def conversation_attachments(db: Session, requester: User, conversation_id: str) -> list[dict[str, object]]:
    if conversation_repository.membership(db, conversation_id, requester.id) is None:
        raise HTTPException(status_code=403, detail='Conversation membership required')
    rows = db.execute(
        select(Attachment, Message)
        .join(Message, Attachment.message_id == Message.id)
        .where(Message.conversation_id == conversation_id, Message.deleted_at.is_(None))
        .order_by(Message.created_at, Attachment.id)
    ).all()
    result = []
    for attachment, message in rows:
        sender = user_repository.by_id(db, message.sender_id)
        result.append({
            'id': attachment.id,
            'file_name': attachment.file_name,
            'mime_type': attachment.mime_type,
            'size_bytes': attachment.size_bytes,
            'url': f'/api/v1/media/attachments/{attachment.id}',
            'message': {
                'id': message.id,
                'sender_id': message.sender_id,
                'sender': serialize_user(sender),
                'created_at': utc_iso(message.created_at),
            },
        })
    return result


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
