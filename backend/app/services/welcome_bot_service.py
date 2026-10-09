import asyncio
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import utc_now
from app.models.conversation import Conversation, Participant
from app.models.message import Message, Receipt
from app.models.user import User
from app.repositories import conversation_repository

BOT_USERNAME = 'signal-welcome'
WELCOME_TEXT = (
    'Welcome to Signal Clone! Try sending a message, adding people from New message, '
    'or creating a group. This is a demo account, so messages are simulated.'
)
REPLY_TEXT = 'Thanks for your message! You can add people from New message or start a group from the compose menu.'


def ensure_bot(db: Session) -> User:
    bot = db.scalar(select(User).where(User.username == BOT_USERNAME))
    if bot is None:
        bot = User(
            username=BOT_USERNAME,
            display_name='Signal Welcome',
            about='Demo account',
            avatar_color='#3a76f0',
            is_discoverable=False,
        )
        db.add(bot)
        db.flush()
    return bot


def create_onboarding_conversation(db: Session, user: User) -> Conversation:
    bot = ensure_bot(db)
    direct_key = ':'.join(sorted((bot.id, user.id)))
    conversation = db.scalar(select(Conversation).where(Conversation.direct_key == direct_key))
    if conversation is not None:
        return conversation

    conversation = Conversation(type='direct', created_by=bot.id, direct_key=direct_key)
    db.add(conversation)
    db.flush()
    db.add_all([
        Participant(conversation_id=conversation.id, user_id=bot.id, role='admin'),
        Participant(conversation_id=conversation.id, user_id=user.id),
    ])
    message = Message(
        conversation_id=conversation.id,
        sender_id=bot.id,
        body=WELCOME_TEXT,
        client_message_id=f'welcome-initial-{user.id}',
        created_at=utc_now(),
    )
    db.add(message)
    db.flush()
    conversation.last_message_id = message.id
    conversation.last_activity_at = message.created_at
    db.add(Receipt(
        message_id=message.id,
        user_id=user.id,
        status='read',
        delivered_at=message.created_at,
        read_at=message.created_at,
    ))
    db.commit()
    db.refresh(conversation)
    return conversation


async def reply_after_typing(db: Session, message: Message, sender: User) -> None:
    participants = conversation_repository.participants(db, message.conversation_id)
    bot = next(
        (user for row in participants if (user := db.get(User, row.user_id)) and user.username == BOT_USERNAME),
        None,
    )
    if bot is None or sender.id == bot.id:
        return

    from app.services import message_service
    from app.ws.manager import manager

    typing_payload = {
        'conversation_id': message.conversation_id,
        'user_id': bot.id,
        'is_typing': True,
    }
    await manager.send_user(sender.id, 'typing', typing_payload)
    await asyncio.sleep(0.35)
    await manager.send_user(sender.id, 'typing', {**typing_payload, 'is_typing': False})

    reply = message_service.create_message(
        db,
        message.conversation_id,
        bot,
        REPLY_TEXT,
        f'welcome-reply-{message.id}-{uuid4()}',
    )
    receipt = db.scalar(
        select(Receipt).where(Receipt.message_id == reply.id, Receipt.user_id == sender.id)
    )
    if receipt is not None:
        receipt.status = 'read'
        receipt.delivered_at = reply.created_at
        receipt.read_at = reply.created_at
        db.commit()
    await manager.send_user(sender.id, 'message.new', {
        'message': message_service.serialize_message(db, reply),
        'conversation_id': message.conversation_id,
    })
