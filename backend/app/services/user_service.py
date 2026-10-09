from sqlalchemy import case, exists, select
from sqlalchemy.orm import Session
from app.models.contact import Contact
from app.models.user import User
from app.repositories import user_repository


def search_users(db: Session, query: str, current_user: User) -> list[User]:
    return user_repository.search(db, query, current_user.id)


def suggestions(db: Session, current_user: User, limit: int = 8) -> list[dict[str, object]]:
    existing_contact = exists().where(
        Contact.owner_id == current_user.id,
        Contact.contact_user_id == User.id,
    )
    blocked_by_me = exists().where(
        Contact.owner_id == current_user.id,
        Contact.contact_user_id == User.id,
        Contact.is_blocked.is_(True),
    )
    blocked_me = exists().where(
        Contact.owner_id == User.id,
        Contact.contact_user_id == current_user.id,
        Contact.is_blocked.is_(True),
    )
    demo_numbers = [f'+91{9000000001 + index}' for index in range(10)]
    demo_first = case((User.phone_number.in_(demo_numbers), 0), else_=1)
    users = db.scalars(
        select(User)
        .where(
            User.id != current_user.id,
            User.is_discoverable.is_(True),
            ~existing_contact,
            ~blocked_by_me,
            ~blocked_me,
        )
        .order_by(demo_first, User.display_name.collate('NOCASE'), User.id)
        .limit(max(0, min(limit, 50)))
    ).all()
    return [
        {
            'id': user.id,
            'display_name': user.display_name,
            'about': user.about,
            'avatar_url': user.avatar_url,
            'avatar_color': user.avatar_color,
            'masked_phone_number': _mask_phone(user.phone_number),
        }
        for user in users
    ]


def _mask_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    suffix = phone[-3:]
    return f'+91 ••••• ••{suffix}' if phone.startswith('+91') else f'••••••{suffix}'


def set_discoverability(user: User, discoverable: bool) -> User:
    user.is_discoverable = discoverable
    return user
