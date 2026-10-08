"""Small, additive SQLite upgrades for databases created by earlier project passes."""

from sqlalchemy import Engine, inspect, text

from app.db.base import Base

LEGACY_COLUMNS: dict[str, dict[str, str]] = {
    'users': {'avatar_storage_path': 'VARCHAR(255)'},
    'otp_challenges': {'created_at': 'DATETIME'},
    'conversations': {'description': 'TEXT', 'avatar_url': 'VARCHAR(500)'},
    'conversation_participants': {
        'joined_at': 'DATETIME',
        'left_at': 'DATETIME',
        'last_read_message_id': 'VARCHAR(36)',
    },
    'messages': {
        'reply_to_id': 'VARCHAR(36)',
        'edited_at': 'DATETIME',
        'expires_at': 'DATETIME',
    },
}


def upgrade_legacy_schema(engine: Engine) -> None:
    """Add columns that SQLite cannot create_all onto existing tables."""
    with engine.begin() as connection:
        inspector = inspect(connection)
        for table_name, columns in LEGACY_COLUMNS.items():
            if table_name not in inspector.get_table_names():
                continue
            existing = {column['name'] for column in inspector.get_columns(table_name)}
            for column_name, column_type in columns.items():
                if column_name not in existing:
                    connection.execute(text(
                        f'ALTER TABLE "{table_name}" ADD COLUMN "{column_name}" {column_type}'
                    ))
            if table_name == 'users' and 'avatar_url' in existing:
                connection.execute(text('''
                    UPDATE users
                    SET avatar_storage_path = substr(avatar_url, 10),
                        avatar_url = '/api/v1/media/avatars/' || id
                    WHERE avatar_url LIKE '/uploads/%' AND avatar_storage_path IS NULL
                '''))
            if table_name == 'conversation_participants':
                connection.execute(text(
                    'UPDATE conversation_participants SET joined_at = CURRENT_TIMESTAMP WHERE joined_at IS NULL'
                ))
        receipt_columns = {
            column['name']: column for column in inspect(connection).get_columns('message_receipts')
        } if 'message_receipts' in inspect(connection).get_table_names() else {}
        delivered_at = receipt_columns.get('delivered_at')
        if delivered_at is not None and not delivered_at['nullable']:
            connection.execute(text('''
                CREATE TABLE message_receipts_new (
                    id VARCHAR(36) PRIMARY KEY,
                    message_id VARCHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    status VARCHAR(12) NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent', 'delivered', 'read')),
                    delivered_at DATETIME,
                    read_at DATETIME,
                    UNIQUE (message_id, user_id)
                )
            '''))
            connection.execute(text('''
                INSERT INTO message_receipts_new (id, message_id, user_id, status, delivered_at, read_at)
                SELECT id, message_id, user_id, status, delivered_at, read_at FROM message_receipts
            '''))
            connection.execute(text('DROP TABLE message_receipts'))
            connection.execute(text('ALTER TABLE message_receipts_new RENAME TO message_receipts'))
        for table in Base.metadata.tables.values():
            if table.name in inspector.get_table_names():
                for index in table.indexes:
                    index.create(connection, checkfirst=True)
