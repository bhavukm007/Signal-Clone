from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base, utc_now
from app.models.contact import Contact
from app.models.conversation import Conversation, Participant
from app.models.message import Message, Reaction, Receipt
from app.models.user import User

NAMES = [
    'Aarav Mehta', 'Isha Kapoor', 'Rohan Shah', 'Maya Iyer', 'Kabir Rao',
    'Ananya Das', 'Vivaan Nair', 'Sara Khan', 'Dev Patel', 'Neha Bose',
]
COLORS = [
    '#86a8e7', '#e69a9a', '#89bd9b', '#c19adf', '#e6b476',
    '#72bfc0', '#e18ab0', '#a7ad69', '#8b9bd1', '#d88e72',
]
DIRECT_MESSAGES = [
    'Hey, how have you been?', 'Just saw your message 🙂',
    'Want to catch up this week?', 'That sounds good to me.',
    'I will send you the details tonight.', 'Perfect, see you then!',
    'Did you get a chance to look at the photos?', 'These turned out great!',
    'Coffee after work tomorrow?', 'I know a place near the station.',
    'That works. I will be there around six.', 'Running five minutes late!',
    'No worries, I just arrived.', 'Thanks for making time today.',
    'Let us do it again next week.', 'Absolutely, I will check my calendar.',
    'Have a good evening!', 'You too. Talk soon 👋',
]
GROUP_MESSAGES = [
    'Anyone free this Saturday?', 'That sounds perfect!',
    'I can bring some snacks 🍪', 'Should we meet around noon?',
    'I will share the location here.', 'Thanks, that is easy to find.',
    'I might be a few minutes late.', 'All good, we will save you a seat.',
    'Here is the playlist I mentioned.', 'This is exactly the right vibe.',
    'I can bring a camera too.', 'Please do, the light should be nice.',
    'I am on my way now.', 'See you all there!', 'That was such a fun day.',
]


def _conversation_dates(index: int, count: int, now) -> list:
    return [
        now - timedelta(days=4 - (number // 5), hours=5 - (number % 5))
        for number in range(count)
    ]


def _add_receipts(db: Session, message: Message, recipients: list[User], number: int) -> None:
    statuses = ('read', 'delivered', 'sent')
    for offset, recipient in enumerate(recipients):
        status = statuses[(number + offset) % len(statuses)]
        db.add(Receipt(
            message_id=message.id,
            user_id=recipient.id,
            status=status,
            delivered_at=message.created_at if status in ('delivered', 'read') else None,
            read_at=message.created_at if status == 'read' else None,
        ))


def _seed_contacts(db: Session, users: list[User]) -> None:
    for index, owner in enumerate(users):
        for offset in range(1, 7):
            contact = users[(index + offset) % len(users)]
            db.add(Contact(owner_id=owner.id, contact_user_id=contact.id))


def _seed_direct_conversations(db: Session, users: list[User], now) -> None:
    demo = users[0]
    for conversation_number, other in enumerate(users[1:]):
        conversation = Conversation(
            type='direct',
            created_by=demo.id,
            direct_key=':'.join(sorted((demo.id, other.id))),
            last_activity_at=now,
            disappearing_timer_seconds=3600 if conversation_number == 4 else None,
        )
        db.add(conversation)
        db.flush()
        demo_membership = Participant(
            conversation_id=conversation.id,
            user_id=demo.id,
            role='admin',
            is_pinned=conversation_number == 0,
            muted_until=now + timedelta(days=3) if conversation_number == 1 else None,
        )
        db.add_all([
            demo_membership,
            Participant(conversation_id=conversation.id, user_id=other.id),
        ])
        dates = _conversation_dates(conversation_number, len(DIRECT_MESSAGES), now)
        message_ids: list[str] = []
        newest_id = ''
        newest_time = dates[0]
        for number, (body, created_at) in enumerate(zip(DIRECT_MESSAGES, dates)):
            sender = other if number % 2 == 0 else demo
            message = Message(
                conversation_id=conversation.id,
                sender_id=sender.id,
                body=body,
                client_message_id=f'demo-direct-{conversation.id}-{number}',
                reply_to_id=message_ids[number - 1] if number >= 2 and number % 5 == 0 else None,
                created_at=created_at,
                expires_at=(created_at + timedelta(seconds=3600)) if conversation_number == 4 else None,
            )
            db.add(message)
            db.flush()
            message_ids.append(message.id)
            newest_id, newest_time = message.id, message.created_at
            _add_receipts(db, message, [demo if sender.id != demo.id else other], number)
            if number % 4 == 0:
                db.add(Reaction(
                    message_id=message.id,
                    user_id=demo.id if sender.id != demo.id else other.id,
                    emoji=('❤️', '👍', '😂')[number % 3],
                ))
        conversation.last_message_id = newest_id
        conversation.last_activity_at = newest_time
        if conversation_number == 2:
            demo_membership.last_read_message_id = message_ids[10]
        elif conversation_number == 3:
            demo_membership.last_read_message_id = message_ids[14]
        else:
            demo_membership.last_read_message_id = message_ids[-1]


def _seed_groups(db: Session, users: list[User], now) -> None:
    group_names = ['Weekend plans 🌿', 'Design team', 'College friends']
    for group_index, name in enumerate(group_names):
        admin = users[group_index]
        members = users[group_index:group_index + 5]
        group = Conversation(
            type='group', title=name, created_by=admin.id,
            last_activity_at=now - timedelta(days=4),
        )
        db.add(group)
        db.flush()
        db.add_all([
            Participant(
                conversation_id=group.id,
                user_id=member.id,
                role='admin' if member.id == admin.id else 'member',
                is_pinned=(group_index == 0 and member.id == admin.id),
            )
            for member in members
        ])
        system_message = Message(
            conversation_id=group.id,
            sender_id=admin.id,
            body=f'{admin.display_name} created {name}',
            type='system',
            client_message_id=f'demo-group-system-{group.id}',
            created_at=now - timedelta(days=5),
        )
        db.add(system_message)
        db.flush()
        previous_ids = [system_message.id]
        newest_id = system_message.id
        newest_time = system_message.created_at
        for number, (body, created_at) in enumerate(zip(
            GROUP_MESSAGES,
            _conversation_dates(group_index, len(GROUP_MESSAGES), now),
        )):
            sender = members[(number + 1) % len(members)]
            message = Message(
                conversation_id=group.id,
                sender_id=sender.id,
                body=body,
                client_message_id=f'demo-group-{group.id}-{number}',
                reply_to_id=previous_ids[-1] if number >= 2 and number % 5 == 0 else None,
                created_at=created_at,
            )
            db.add(message)
            db.flush()
            previous_ids.append(message.id)
            newest_id, newest_time = message.id, message.created_at
            _add_receipts(db, message, [member for member in members if member.id != sender.id], number)
            if number % 3 == 0:
                reactor = next(member for member in members if member.id != sender.id)
                db.add(Reaction(message_id=message.id, user_id=reactor.id, emoji=('🔥', '👏', '🙂')[number % 3]))
        group.last_message_id = newest_id
        group.last_activity_at = newest_time


def seed(db: Session) -> None:
    now = utc_now()
    users = [
        User(
            phone_number=f'+91{9000000001 + index}',
            username=name.split()[0].lower(),
            display_name=name,
            about='Hey there! I am using Signal.',
            avatar_color=COLORS[index],
            # Presence is process-local and is re-established by live sockets.
            is_online=False,
            last_seen_at=now - timedelta(minutes=index * 13),
        )
        for index, name in enumerate(NAMES)
    ]
    db.add_all(users)
    db.flush()
    _seed_contacts(db, users)
    _seed_direct_conversations(db, users, now)
    _seed_groups(db, users, now)
    db.commit()


def seed_if_empty(db: Session) -> bool:
    if db.scalar(select(User.id).limit(1)) is not None:
        return False
    seed(db)
    return True


if __name__ == '__main__':
    from app.db.session import SessionLocal, engine
    import app.models  # Importing registers every ORM table in Base.metadata.

    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        seed_if_empty(session)
