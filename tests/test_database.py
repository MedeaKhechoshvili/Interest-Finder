import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import NullPool

# Importing this module registers the application's connection listener.
from app.core import database  # noqa: F401


def test_sqlite_connections_reject_invalid_foreign_keys(tmp_path):
    test_engine = create_engine(
        f"sqlite:///{tmp_path / 'foreign_keys_test.db'}",
        poolclass=NullPool,
    )

    try:
        # NullPool ensures each iteration opens a fresh connection.
        for _ in range(2):
            with test_engine.begin() as connection:
                enabled = connection.exec_driver_sql(
                    "PRAGMA foreign_keys"
                ).scalar_one()
                assert enabled == 1

                connection.exec_driver_sql(
                    "CREATE TABLE IF NOT EXISTS parent "
                    "(id INTEGER PRIMARY KEY)"
                )
                connection.exec_driver_sql(
                    "CREATE TABLE IF NOT EXISTS child "
                    "(id INTEGER PRIMARY KEY, "
                    "parent_id INTEGER REFERENCES parent(id))"
                )

                with pytest.raises(
                    IntegrityError,
                    match="FOREIGN KEY constraint failed",
                ):
                    connection.exec_driver_sql(
                        "INSERT INTO child (parent_id) VALUES (999)"
                    )
    finally:
        test_engine.dispose()