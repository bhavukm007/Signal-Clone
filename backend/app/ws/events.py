from enum import StrEnum


class EventType(StrEnum):
    MESSAGE_NEW = 'message.new'
    MESSAGE_ACK = 'message.ack'
    MESSAGE_STATUS = 'message.status'
    TYPING = 'typing'
    PRESENCE = 'presence'
    CONVERSATION_UPDATED = 'conversation.updated'
    REACTION_UPDATED = 'reaction.updated'
    MESSAGE_DELETED = 'message.deleted'
    ERROR = 'error'
    PONG = 'pong'
