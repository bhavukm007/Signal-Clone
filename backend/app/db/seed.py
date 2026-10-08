from datetime import timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.base import utc_now
from app.models.conversation import Conversation, Participant
from app.models.message import Message, Receipt
from app.models.user import User


def seed(db: Session) -> None:
    names = ['Aarav Mehta', 'Isha Kapoor', 'Rohan Shah', 'Maya Iyer', 'Kabir Rao', 'Ananya Das', 'Vivaan Nair', 'Sara Khan', 'Dev Patel', 'Neha Bose']
    colors = ['#86a8e7', '#e69a9a', '#89bd9b', '#c19adf', '#e6b476', '#72bfc0', '#e18ab0', '#a7ad69', '#8b9bd1', '#d88e72']
    users = []
    for index, name in enumerate(names):
        user = User(
            phone_number=f'+91 90000 0000{index + 1}',
            username=name.split()[0].lower(),
            display_name=name,
            avatar_color=colors[index],
            is_online=index in (0, 1, 3),
            last_seen_at=utc_now() - timedelta(minutes=index * 13),
        )
        db.add(user)
        users.append(user)
    db.flush()
    demo = users[0]
    for index, other in enumerate(users[1:]):
        key = ':'.join(sorted((demo.id, other.id)))
        conversation = Conversation(
            type='direct', created_by=demo.id, direct_key=key,
            last_activity_at=utc_now() - timedelta(hours=index),
            disappearing_timer_seconds=86400 if index == 4 else None,
        )
        db.add(conversation)
        db.flush()
        db.add_all([
            Participant(conversation_id=conversation.id, user_id=demo.id, role='admin', is_pinned=index == 0,
                        muted_until=utc_now() + timedelta(days=3) if index == 1 else None),
            Participant(conversation_id=conversation.id, user_id=other.id),
        ])
        for message_number in range(18):
            sender = demo if message_number % 2 else other
            message = Message(
                conversation_id=conversation.id, sender_id=sender.id,
                body=['Hey! How have you been?', 'Just saw your message 🙂',
                      'Want to catch up this week?', 'Sounds good, see you then!'][message_number % 4],
                client_message_id=f'seed-{conversation.id}-{message_number}',
                created_at=utc_now() - timedelta(days=message_number // 5, hours=message_number % 6),
            )
            db.add(message)
            db.flush()
            conversation.last_message_id = message.id
            if sender.id != demo.id:
                db.add(Receipt(message_id=message.id, user_id=demo.id, status='read', read_at=message.created_at))
    for group_index, title in enumerate(['Weekend plans 🌿', 'Design team', 'College friends']):
        group = Conversation(type='group', title=title, created_by=users[group_index].id,
                            last_activity_at=utc_now() - timedelta(hours=group_index + 1))
        db.add(group)
        db.flush()
        for member in users[group_index:group_index + 5]:
            db.add(Participant(conversation_id=group.id, user_id=member.id,
                               role='admin' if member.id == users[group_index].id else 'member'))
        for message_number in range(16):
            message = Message(
                conversation_id=group.id, sender_id=users[(group_index + message_number) % 8].id,
                body=['Anyone free Saturday?', 'That sounds perfect!', 'I will bring snacks 🍪', 'On my way!'][message_number % 4],
                type='system' if message_number == 0 else 'text',
                client_message_id=f'group-{group_index}-{message_number}',
                created_at=utc_now() - timedelta(days=message_number // 4, hours=message_number % 6),
            )
            db.add(message)
            db.flush()
            group.last_message_id = message.id
    db.commit()


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(User.id).limit(1)) is None:
        seed(db)


if __name__ == '__main__':
    from app.db.base import Base
    from app.db.session import SessionLocal, engine
    import app.models  # Register all tables before create_all.

    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        seed_if_empty(session)
