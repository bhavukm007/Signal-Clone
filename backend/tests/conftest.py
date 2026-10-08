import os
os.environ.setdefault('TESTING', '1')

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import Base, app, get_db

_test_engine = create_engine(
    'sqlite://',
    connect_args={'check_same_thread': False},
    poolclass=StaticPool,
)
_TestSession = sessionmaker(bind=_test_engine, expire_on_commit=False)

@pytest.fixture(scope='session', autouse=True)
def database():
    Base.metadata.create_all(_test_engine)
    yield
    Base.metadata.drop_all(_test_engine)

@pytest.fixture
def db_session(database):
    session = _TestSession()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client(database):
    def override_db():
        session = _TestSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    with _TestSession() as session:
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()
