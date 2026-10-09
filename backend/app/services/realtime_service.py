import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from threading import Lock
from weakref import WeakKeyDictionary

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.message import Message, Receipt
from app.models.user import User
from app.repositories import conversation_repository, message_repository
from app.repositories.contact_repository import is_blocked
from app.services import message_service
from app.core.datetime import utc_iso
from app.ws.events import EventType
from app.ws.manager import manager


_lock_guard = Lock()
_message_locks: WeakKeyDictionary[asyncio.AbstractEventLoop, dict[str, tuple[asyncio.Lock, int]]] = WeakKeyDictionary()


@asynccontextmanager
async def _serialize_message(conversation_id: str, sender_id: str, client_message_id: str):
    """Serialize persistence and publication for a conversation and idempotency key."""
    loop = asyncio.get_running_loop()
    keys = sorted((f'conversation:{conversation_id}', f'idempotency:{sender_id}:{client_message_id}'))
    with _lock_guard:
        locks = _message_locks.setdefault(loop, {})
        entries = []
        for key in keys:
            lock, users = locks.get(key, (asyncio.Lock(), 0))
            locks[key] = (lock, users + 1)
            entries.append((key, lock))
    acquired = []
    try:
        for _key, lock in entries:
            await lock.acquire()
            acquired.append(lock)
        yield
    finally:
        for lock in reversed(acquired):
            lock.release()
        with _lock_guard:
            locks = _message_locks.get(loop, {})
            for key, lock in entries:
                current_lock, users = locks.get(key, (lock, 1))
                if users <= 1:
                    locks.pop(key, None)
                else:
                    locks[key] = (current_lock, users - 1)


async def broadcast_conversation(
    db: Session,
    conversation_id: str,
    event: EventType,
    payload: dict,
    excluded_user_id: str | None = None,
) -> None:
    participants = conversation_repository.participants(db, conversation_id)
    user_ids = {
        row.user_id for row in participants
        if not any(
            is_blocked(db, other.user_id, row.user_id)
            for other in participants if other.user_id != row.user_id
        )
    }
    # Never hold a SQLite read transaction open while waiting on socket backpressure.
    db.commit()
    await manager.send_many(user_ids, event.value, payload, excluded_user_id)


async def publish_message(
    db: Session,
    message: Message,
    sender_id: str,
    include_sender: bool = False,
) -> None:
    serialized = message_service.serialize_message(db, message)
    await broadcast_conversation(
        db,
        message.conversation_id,
        EventType.MESSAGE_NEW,
        {'message': serialized, 'conversation_id': message.conversation_id},
        excluded_user_id=None if include_sender else sender_id,
    )
    recipients = conversation_repository.participants(db, message.conversation_id)
    for recipient in recipients:
        if recipient.user_id == sender_id or not manager.is_online(recipient.user_id):
            continue
        receipt = message_service.mark_delivered(db, recipient.user_id, message.id)
        if receipt:
            await publish_receipt(db, receipt)


async def send_message(
    db: Session,
    conversation_id: str,
    sender: User,
    body: str,
    client_message_id: str,
    reply_to_id: str | None = None,
    attachment_ids: list[str] | None = None,
    acknowledge_sender: bool = False,
) -> Message:
    """Persist and publish a message once, in the same order all clients see it."""
    from app.services import message_service

    async with _serialize_message(conversation_id, sender.id, client_message_id):
        previous = message_repository.by_idempotency_key(db, sender.id, client_message_id)
        message = message_service.create_message(
            db, conversation_id, sender, body, client_message_id, reply_to_id, attachment_ids
        )
        if acknowledge_sender:
            await manager.send_user(sender.id, EventType.MESSAGE_ACK.value, {
                'client_message_id': message.client_message_id,
                'message_id': message.id,
                'status': 'sent',
            })
        if previous is None:
            await publish_message(db, message, sender.id)
    if previous is None:
        from app.services.welcome_bot_service import reply_after_typing
        await reply_after_typing(db, message, sender)
    return message


async def publish_receipt(db: Session, receipt: Receipt) -> None:
    message = message_repository.by_id(db, receipt.message_id)
    if message is None:
        return
    if is_blocked(db, receipt.user_id, message.sender_id):
        return
    payload = {
        'message_id': message.id,
        'user_id': receipt.user_id,
        'status': receipt.status,
        'aggregate_status': message_service.aggregate_status(db, message.id),
    }
    db.commit()
    await manager.send_user(message.sender_id, EventType.MESSAGE_STATUS.value, payload)


async def publish_receipts(db: Session, receipts: list[Receipt]) -> None:
    for receipt in receipts:
        await publish_receipt(db, receipt)


async def presence_changed(
    db: Session,
    user_id: str,
    is_online: bool,
    last_seen_at: datetime | None,
) -> None:
    from app.services.presence_service import relevant_user_ids
    recipients = relevant_user_ids(db, user_id)
    db.commit()
    await manager.send_many(
        recipients,
        EventType.PRESENCE.value,
        {
            'user_id': user_id,
            'is_online': is_online,
            'last_seen_at': utc_iso(last_seen_at) if last_seen_at else None,
        },
    )
