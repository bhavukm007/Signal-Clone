from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.conversation import AddMembers, GroupCreate, GroupUpdate, MemberRole
from app.services import conversation_service, group_service

router = APIRouter(prefix='/groups', tags=['groups'])


@router.post('')
def create_group(
    body: GroupCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conversation = conversation_service.create_group(db, user, body)
    return {'id': conversation.id, 'type': conversation.type, 'title': conversation.title}


@router.get('/{conversation_id}/members')
def list_members(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return group_service.list_members(db, user, conversation_id)


@router.post('/{conversation_id}/members')
def add_members(
    conversation_id: str,
    body: AddMembers,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = group_service.add_members(db, user, conversation_id, body.user_ids)
    return {'ok': True, 'added_count': len(rows)}


@router.delete('/{conversation_id}/members/{user_id}')
def remove_member(
    conversation_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    group_service.remove_member(db, user, conversation_id, user_id)
    return {'ok': True}


@router.patch('/{conversation_id}/members/{user_id}/role')
def set_member_role(
    conversation_id: str,
    user_id: str,
    body: MemberRole,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    group_service.set_role(db, user, conversation_id, user_id, body.role)
    return {'ok': True, 'role': body.role}


@router.patch('/{conversation_id}')
def update_group(
    conversation_id: str,
    body: GroupUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    group = group_service.update_group(db, user, conversation_id, body.name, body.description)
    return {'id': group.id, 'title': group.title, 'description': group.description}
