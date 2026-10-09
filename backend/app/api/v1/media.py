from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services import media_service

router = APIRouter(prefix='/media', tags=['media'])


@router.get('/attachments/{attachment_id}')
def get_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    path, mime_type, file_name = media_service.attachment_path(db, user, attachment_id)
    return FileResponse(path, media_type=mime_type, filename=file_name)


@router.get('/conversations/{conversation_id}/attachments')
def list_conversation_attachments(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return media_service.conversation_attachments(db, user, conversation_id)


@router.get('/avatars/{user_id}')
def get_avatar(
    user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    path, mime_type = media_service.avatar_path(db, user, user_id)
    return FileResponse(path, media_type=mime_type, filename=path.name)
