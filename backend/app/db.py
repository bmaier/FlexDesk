"""Database engine/session setup. SQLite file DB for the PoC."""
import os
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_default_path = Path(__file__).resolve().parent.parent / "deskshare.db"
DB_PATH = Path(os.environ.get("DESKSHARE_DB_PATH", str(_default_path)))
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def migrate_sqlite_schema() -> None:
    """Kleine additive PoC-Migrationen für bereits angelegte SQLite-Dateien."""
    with engine.begin() as connection:
        columns = {row[1] for row in connection.execute(text("PRAGMA table_info(floors)"))}
        if "floorplan_layout" not in columns:
            connection.execute(text("ALTER TABLE floors ADD COLUMN floorplan_layout VARCHAR(20000)"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
