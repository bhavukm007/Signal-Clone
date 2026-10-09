from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app import models  # noqa: F401 - register all model tables


def test_fresh_database_schema_matches_model_constraints_indexes_and_foreign_keys() -> None:
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    inspector = inspect(engine)

    assert set(inspector.get_table_names()) == set(Base.metadata.tables)
    for table in Base.metadata.tables.values():
        actual_checks = {
            ' '.join(item['sqltext'].split()) for item in inspector.get_check_constraints(table.name)
        }
        expected_checks = {
            ' '.join(str(item.sqltext).split()) for item in table.constraints if item.__class__.__name__ == 'CheckConstraint'
        }
        assert actual_checks == expected_checks, table.name

        actual_unique = {
            frozenset(item['column_names']) for item in inspector.get_unique_constraints(table.name)
        }
        expected_unique = {
            frozenset(column.name for column in item.columns)
            for item in table.constraints if item.__class__.__name__ == 'UniqueConstraint'
        }
        assert actual_unique == expected_unique, table.name

        actual_foreign_keys = {
            (tuple(item['constrained_columns']), item['referred_table'], tuple(item['referred_columns']),
             tuple(sorted((key, value.upper()) for key, value in item['options'].items())))
            for item in inspector.get_foreign_keys(table.name)
        }
        expected_foreign_keys = {
            ((item.parent.name,), item.column.table.name, (item.column.name,),
             (('ondelete', item.ondelete.upper()),) if item.ondelete else ())
            for item in table.foreign_keys
        }
        assert actual_foreign_keys == expected_foreign_keys, table.name

        actual_indexes = {item['name'] for item in inspector.get_indexes(table.name)}
        expected_indexes = {item.name for item in table.indexes}
        assert actual_indexes == expected_indexes, table.name

    engine.dispose()
