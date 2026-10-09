import asyncio
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import router as api_router
from app.core.config import settings
from app.db.base import Base
from app.db.seed import seed_if_empty
from app.db.session import SessionLocal, engine, get_db
from app import models
from app.ws.router import router as websocket_router
from app.core.logging import logger
from app.services.disappearing_service import purge_expired_and_broadcast
from app.ws.manager import manager


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    workers: list[asyncio.Task[None]] = []
    if not settings.testing:
        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        Base.metadata.create_all(engine)
        with SessionLocal() as session:
            seed_if_empty(session)
        workers = [
            asyncio.create_task(expiration_loop(), name='disappearing-message-purger'),
            asyncio.create_task(connection_sweeper(), name='websocket-connection-sweeper'),
        ]
    try:
        yield
    finally:
        for worker in workers:
            worker.cancel()
        await asyncio.gather(*workers, return_exceptions=True)


async def expiration_loop() -> None:
    while True:
        try:
            with SessionLocal() as session:
                await purge_expired_and_broadcast(session)
        except Exception:
            logger.exception('Failed to purge expired messages')
        await asyncio.sleep(2)


async def connection_sweeper() -> None:
    while True:
        try:
            await manager.drop_stale()
        except Exception:
            logger.exception('Failed to sweep stale websocket connections')
        await asyncio.sleep(10)


app = FastAPI(title='Signal Clone API', version='1.0.0', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.exception_handler(StarletteHTTPException)
async def handle_http_error(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = {
        401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT',
        422: 'VALIDATION_ERROR',
    }.get(exc.status_code, 'REQUEST_ERROR')
    message = exc.detail if isinstance(exc.detail, str) else 'Request could not be completed'
    return JSONResponse(
        status_code=exc.status_code,
        content={'error': {'code': code, 'message': message}},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = [error.get('loc', [])[-1] for error in exc.errors() if error.get('loc')]
    message = 'Invalid request' if not fields else f"Invalid value for: {', '.join(map(str, fields))}"
    return JSONResponse(
        status_code=422,
        content={'error': {'code': 'VALIDATION_ERROR', 'message': message}},
    )


@app.get('/health', response_model=None)
def health() -> JSONResponse | dict[str, str]:
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql('SELECT 1')
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={'status': 'not_ready'})
    return {'status': 'ok'}


app.include_router(api_router, prefix='/api/v1')
app.include_router(websocket_router)

__all__ = ['Base', 'app', 'get_db']
