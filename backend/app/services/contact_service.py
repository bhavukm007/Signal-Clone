from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.contact import Contact
from app.models.user import User
from app.repositories import contact_repository, user_repository


def list_contacts(db: Session, owner: User) -> list[Contact]:
    return contact_repository.list_for_owner(db, owner.id)


def serialize_contact(db: Session, contact: Contact) -> dict[str, object]:
    return {
        'id': contact.id,
        'user': user_repository.by_id(db, contact.contact_user_id),
        'nickname': contact.nickname,
        'is_blocked': contact.is_blocked,
    }


def add_contact(db: Session, owner: User, user_id: str | None, identifier: str | None) -> Contact:
    if not user_id and not identifier:
        raise HTTPException(status_code=422, detail='Provide user_id or identifier')
    other = user_repository.by_id(db, user_id) if user_id else user_repository.by_identifier(db, identifier or '')
    if other is None:
        raise HTTPException(status_code=404, detail='User not found')
    if other.id == owner.id:
        raise HTTPException(status_code=422, detail='Cannot add yourself as a contact')
    contact = contact_repository.by_owner_and_user(db, owner.id, other.id)
    if contact is None:
        contact = Contact(owner_id=owner.id, contact_user_id=other.id)
        db.add(contact)
        db.commit()
        db.refresh(contact)
    return contact


def delete_contact(db: Session, owner: User, contact_id: str) -> None:
    contact = contact_repository.by_id_and_owner(db, contact_id, owner.id)
    if contact is None:
        raise HTTPException(status_code=404, detail='Contact not found')
    db.delete(contact)
    db.commit()


def toggle_block(db: Session, owner: User, contact_id: str) -> Contact:
    contact = contact_repository.by_id_and_owner(db, contact_id, owner.id)
    if contact is None:
        raise HTTPException(status_code=404, detail='Contact not found')
    contact.is_blocked = not contact.is_blocked
    db.commit()
    db.refresh(contact)
    return contact


def set_blocked(db: Session, owner: User, contact_id: str, blocked: bool) -> Contact:
    contact = contact_repository.by_id_and_owner(db, contact_id, owner.id)
    if contact is None:
        raise HTTPException(status_code=404, detail='Contact not found')
    contact.is_blocked = blocked
    db.commit()
    db.refresh(contact)
    return contact


def set_blocked_user(db: Session, owner: User, user_id: str, blocked: bool) -> Contact:
    if owner.id == user_id:
        raise HTTPException(status_code=422, detail='Cannot block yourself')
    if user_repository.by_id(db, user_id) is None:
        raise HTTPException(status_code=404, detail='User not found')
    contact = contact_repository.by_owner_and_user(db, owner.id, user_id)
    if contact is None:
        contact = Contact(owner_id=owner.id, contact_user_id=user_id, is_blocked=blocked)
        db.add(contact)
    else:
        contact.is_blocked = blocked
    db.commit()
    db.refresh(contact)
    return contact
