from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import utc_now
from app.models.message import Message, Reaction, Receipt
from app.models.user import User
from app.repositories import conversation_repository, message_repository, user_repository
from app.schemas.message import MessageCreate


def create_message(db: Session, conversation_id: str, sender: User, body: MessageCreate) -> Message:
    conversation_service_member = conversation_repository.membership(db, conversation_id, sender.id)
    if conversation_service_member is None:
        raise HTTPException(status_code=403, detail='Conversation membership required')
    existing = message_repository.by_idempotency_key(db, sender.id, body.client_message_id)
    if existing is not None:
        return existing
    if body.reply_to_id:
        reply = message_repository.by_id(db, body.reply_to_id)
        if reply is None or reply.conversation_id != conversation_id:
            raise HTTPException(status_code=404, detail='Reply target not found in this conversation')
    conversation = conversation_repository.by_id(db, conversation_id)
    expires_at = None
    if conversation.disappearing_timer_seconds:
        expires_at = utc_now() + timedelta(seconds=conversation.disappearing_timer_seconds)
    message = Message(
        conversation_id=conversation_id,
        sender_id=sender.id,
        body=body.body,
        client_message_id=body.client_message_id,
        reply_to_id=body.reply_to_id,
        expires_at=expires_at,
    )
    db.add(message)
    db.flush()
    conversation.last_message_id = message.id
    conversation.last_activity_at = message.created_at
    for recipient in conversation_repository.participants(db, conversation_id):
        if recipient.user_id != sender.id:
            db.add(Receipt(message_id=message.id, user_id=recipient.user_id, status='sent'))
    db.commit()
    db.refresh(message)
    return message


def get_history(db: Session, user: User, conversation_id: str, before_id: str | None, limit: int) -> list[Message]:
    if conversation_repository.membership(db, conversation_id, user.id) is None:
        raise HTTPException(status_code=403, detail='Conversation membership required')
    cursor = message_repository.by_id(db, before_id) if before_id else None
    if before_id and (cursor is None or cursor.conversation_id != conversation_id):
        raise HTTPException(status_code=404, detail='Message cursor not found')
    return message_repository.history(db, conversation_id, cursor, min(max(limit, 1), 100))


def mark_delivered(db: Session, user_id: str, message_id: str) -> Receipt | None:
    receipt = db.scalar(select(Receipt).where(Receipt.message_id == message_id, Receipt.user_id == user_id))
    if receipt is not None and receipt.status == 'sent':
        receipt.status = 'delivered'
        receipt.delivered_at = utc_now()
        db.commit()
    return receipt


def mark_pending_delivered(db: Session, user_id: str) -> list[Receipt]:
    receipts = db.scalars(select(Receipt).where(Receipt.user_id == user_id, Receipt.status == 'sent')).all()
    for receipt in receipts:
        receipt.status = 'delivered'
        receipt.delivered_at = utc_now()
    db.commit()
    return list(receipts)


def mark_read(db: Session, user: User, conversation_id: str, up_to_message_id: str) -> list[Receipt]:
    if conversation_repository.membership(db, conversation_id, user.id) is None:
        raise HTTPException(status_code=403, detail='Conversation membership required')
    cursor = message_repository.by_id(db, up_to_message_id)
    if cursor is None or cursor.conversation_id != conversation_id:
        raise HTTPException(status_code=404, detail='Read cursor not found')
    participant = conversation_repository.membership(db, conversation_id, user.id)
    participant.last_read_message_id = cursor.id
    receipts = db.scalars(
        select(Receipt)
        .join(Message, Receipt.message_id == Message.id)
        .where(
            Receipt.user_id == user.id,
            Message.conversation_id == conversation_id,
            Message.created_at <= cursor.created_at,
            Receipt.status != 'read',
        )
    ).all()
    for receipt in receipts:
        receipt.status = 'read'
        receipt.delivered_at = receipt.delivered_at or utc_now()
        receipt.read_at = utc_now()
    db.commit()
    return list(receipts)


def aggregate_status(db: Session, message_id: str) -> str:
    receipts = message_repository.receipts_for_message(db, message_id)
    if not receipts:
        return 'read'
    statuses = {receipt.status for receipt in receipts}
    if statuses == {'read'}:
        return 'read'
    if 'sent' in statuses:
        return 'sent'
    if 'delivered' in statuses:
        return 'delivered'
    return 'sent'


def delete_message(db: Session, user: User, message_id: str) -> Message:
    message = message_repository.by_id(db, message_id)
    if message is None:
        raise HTTPException(status_code=404, detail='Message not found')
    if message.sender_id != user.id:
        raise HTTPException(status_code=403, detail='Only the sender can delete this message')
    message.deleted_at = utc_now()
    message.body = 'This message was deleted'
    db.commit()
    return message


def set_reaction(db: Session, user: User, message_id: str, emoji: str, remove: bool = False) -> Reaction | None:
    message = message_repository.by_id(db, message_id)
    if message is None:
        raise HTTPException(status_code=404, detail='Message not found')
    if conversation_repository.membership(db, message.conversation_id, user.id) is None:
        raise HTTPException(status_code=403, detail='Conversation membership required')
    reaction = message_repository.reaction_for_user(db, message_id, user.id)
    if remove:
        if reaction:
            db.delete(reaction)
    elif reaction:
        reaction.emoji = emoji
    else:
        reaction = Reaction(message_id=message_id, user_id=user.id, emoji=emoji)
        db.add(reaction)
    db.commit()
    if reaction and not remove:
        db.refresh(reaction)
    return reaction


def serialize_message(db: Session, message: Message) -> dict[str, object]:
    sender = user_repository.by_id(db, message.sender_id)
    return {
        'id': message.id,
        'conversation_id': message.conversation_id,
        'sender_id': message.sender_id,
        'sender': sender,
        'body': message.body,
        'type': message.type,
        'client_message_id': message.client_message_id,
        'created_at': message.created_at,
        'edited_at': message.edited_at,
        'deleted_at': message.deleted_at,
        'reply_to_id': message.reply_to_id,
        'status': aggregate_status(db, message.id),
    }
