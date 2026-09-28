"""Database engine, session factory and schema bootstrap."""

from collections.abc import Iterator

from sqlalchemy import create_engine, inspect
from sqlalchemy import text as sql_text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def _build_engine(database_url: str):
    if database_url.startswith("sqlite"):
        # Used by the test-suite: one shared in-memory connection across threads.
        return create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    return create_engine(database_url, pool_pre_ping=True)


engine = _build_engine(get_settings().database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_user_auth_columns() -> None:
    """Back-fill auth columns on databases created before Google sign-in existed.

    Postgres only. Replace with proper Alembic migrations when possible.
    """
    if engine.dialect.name != "postgresql":
        return

    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    column_names = {column["name"] for column in inspector.get_columns("users")}

    with engine.begin() as connection:
        if "auth_provider" not in column_names:
            connection.execute(sql_text(
                "ALTER TABLE users ADD COLUMN auth_provider VARCHAR(30) NOT NULL DEFAULT 'local'"
            ))

        if "provider_id" not in column_names:
            connection.execute(sql_text(
                "ALTER TABLE users ADD COLUMN provider_id VARCHAR(255)"
            ))

        if "oauth_email_verified" not in column_names:
            connection.execute(sql_text(
                "ALTER TABLE users ADD COLUMN oauth_email_verified BOOLEAN NOT NULL DEFAULT FALSE"
            ))

        connection.execute(sql_text(
            "ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL"
        ))

        connection.execute(sql_text(
            "UPDATE users "
            "SET auth_provider = CASE "
            "WHEN provider_id IS NOT NULL AND hashed_password IS NOT NULL THEN 'hybrid' "
            "WHEN provider_id IS NOT NULL THEN 'google' "
            "ELSE COALESCE(auth_provider, 'local') "
            "END"
        ))

        connection.execute(sql_text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_provider_id ON users (provider_id)"
        ))


def init_db() -> None:
    from app import models  # noqa: F401  (registers the tables on Base.metadata)

    Base.metadata.create_all(bind=engine)
    ensure_user_auth_columns()
