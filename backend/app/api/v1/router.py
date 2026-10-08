from fastapi import APIRouter
from app.api.v1 import auth, contacts, conversations, groups, messages, uploads, users

router = APIRouter()
router.include_router(auth.router)
router.include_router(users.router)
router.include_router(contacts.router)
router.include_router(conversations.router)
router.include_router(messages.router)
router.include_router(groups.router)
router.include_router(uploads.router)
