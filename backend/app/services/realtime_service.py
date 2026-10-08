from datetime import datetime
from sqlalchemy.orm import Session

from app.models.message import Message, Receipt
from app.repositories import conversation_repository, message_repository
from app.services import message_service
from app.ws.events import EventType
from app.ws.manager import manager


async def broadcast_conversation(
    db: Session,
    conversation_id: str,
    event: EventType,
    payload: dict,
    excluded_user_id: str | None = None,
) -> None:
    user_ids = {row.user_id for row in conversation_repository.participants(db, conversation_id)}
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


async def publish_receipt(db: Session, receipt: Receipt) -> None:
    message = message_repository.by_id(db, receipt.message_id)
    if message is None:
        return
    await manager.send_user(message.sender_id, EventType.MESSAGE_STATUS.value, {
        'message_id': message.id,
        'user_id': receipt.user_id,
        'status': receipt.status,
        'aggregate_status': message_service.aggregate_status(db, message.id),
    })


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
    await manager.send_many(
        relevant_user_ids(db, user_id),
        EventType.PRESENCE.value,
        {
            'user_id': user_id,
            'is_online': is_online,
            'last_seen_at': last_seen_at.isoformat() if last_seen_at else None,
        },
    )
