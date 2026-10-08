from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.conversation import ContactCreate, ContactOut
from app.services import contact_service

router = APIRouter(prefix='/contacts', tags=['contacts'])


class BlockUpdate(BaseModel):
    is_blocked: bool


@router.get('', response_model=list[ContactOut])
def list_contacts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [contact_service.serialize_contact(db, row) for row in contact_service.list_contacts(db, user)]


@router.post('', response_model=ContactOut)
def add_contact(
    body: ContactCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    contact = contact_service.add_contact(db, user, body.user_id, body.identifier)
    return contact_service.serialize_contact(db, contact)


@router.delete('/{contact_id}')
def delete_contact(
    contact_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    contact_service.delete_contact(db, user, contact_id)
    return {'ok': True}


@router.post('/{contact_id}/block')
def toggle_block(
    contact_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    contact = contact_service.toggle_block(db, user, contact_id)
    return {'is_blocked': contact.is_blocked}


@router.put('/{contact_id}/block')
def set_block(
    contact_id: str,
    body: BlockUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    contact = contact_service.set_blocked(db, user, contact_id, body.is_blocked)
    return {'is_blocked': contact.is_blocked}


@router.put('/users/{user_id}/block')
def set_user_block(
    user_id: str,
    body: BlockUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    contact = contact_service.set_blocked_user(db, user, user_id, body.is_blocked)
    return {'is_blocked': contact.is_blocked, 'contact_id': contact.id}
