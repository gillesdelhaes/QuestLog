import os
from sqlalchemy import text
from sqlmodel import create_engine, SQLModel, Session

from .config import settings


def _ensure_db_dir():
    db_dir = os.path.dirname(settings.DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)


_ensure_db_dir()

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def init_db():
    SQLModel.metadata.create_all(engine)
    # Additive migrations for columns added after initial schema
    _migrations = [
        "ALTER TABLE quest ADD COLUMN goal_direction TEXT DEFAULT 'above'",
        "ALTER TABLE quest ADD COLUMN numeric_start REAL",
    ]
    with engine.connect() as conn:
        for stmt in _migrations:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass  # column already exists


def get_session():
    with Session(engine) as session:
        yield session
