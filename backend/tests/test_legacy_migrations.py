from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool

from app.db.migrations import upgrade_legacy_schema


def test_additive_upgrade_fills_columns_missing_from_legacy_tables() -> None:
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE otp_challenges (id VARCHAR PRIMARY KEY, identifier VARCHAR)'))
        connection.execute(text(
            'CREATE TABLE conversation_participants '
            '(id VARCHAR PRIMARY KEY, user_id VARCHAR, conversation_id VARCHAR)'
        ))
        connection.execute(text('CREATE TABLE users (id VARCHAR PRIMARY KEY)'))
        connection.execute(text(
            'CREATE TABLE messages (id VARCHAR PRIMARY KEY, conversation_id VARCHAR, created_at DATETIME)'
        ))
        connection.execute(text('''CREATE TABLE message_receipts (
            id VARCHAR PRIMARY KEY, message_id VARCHAR NOT NULL, user_id VARCHAR NOT NULL,
            status VARCHAR NOT NULL, delivered_at DATETIME NOT NULL, read_at DATETIME,
            UNIQUE (message_id, user_id)
        )'''))

    upgrade_legacy_schema(engine)

    inspector = inspect(engine)
    otp_columns = {column['name'] for column in inspector.get_columns('otp_challenges')}
    participant_columns = {column['name'] for column in inspector.get_columns('conversation_participants')}
    receipt_columns = {column['name']: column for column in inspector.get_columns('message_receipts')}
    assert 'created_at' in otp_columns
    assert {'joined_at', 'left_at', 'last_read_message_id'} <= participant_columns
    assert receipt_columns['delivered_at']['nullable']
    engine.dispose()
