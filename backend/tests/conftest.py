import os
os.environ.setdefault('TESTING', '1')

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import Base, app, get_db

_test_engines = []


@pytest.fixture
def database():
    engine = create_engine(
        'sqlite://',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, 'connect')
    def enable_foreign_keys(connection, _record):
        connection.execute('PRAGMA foreign_keys=ON')

    Base.metadata.create_all(engine)
    _test_engines.append(engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    yield session_factory


@pytest.fixture
def db_session(database):
    session = database()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(database):
    from app.core.rate_limit import auth_rate_limiter

    auth_rate_limiter._events.clear()

    def override_db():
        session = database()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
