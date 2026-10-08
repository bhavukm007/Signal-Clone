from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services import upload_service

router = APIRouter(prefix='/uploads', tags=['uploads'])


@router.post('')
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attachment = await upload_service.create_attachment(db, user, file)
    return upload_service.serialize_attachment(attachment)
