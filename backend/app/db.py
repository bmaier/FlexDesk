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
        # floors
        floor_cols = {row[1] for row in connection.execute(text("PRAGMA table_info(floors)"))}
        if "floorplan_layout" not in floor_cols:
            connection.execute(text("ALTER TABLE floors ADD COLUMN floorplan_layout VARCHAR(20000)"))

        # rooms
        room_cols = {row[1] for row in connection.execute(text("PRAGMA table_info(rooms)"))}
        if "floorplan_layout" not in room_cols:
            connection.execute(text("ALTER TABLE rooms ADD COLUMN floorplan_layout VARCHAR(20000)"))
        if "seating_layout" not in room_cols:
            connection.execute(text("ALTER TABLE rooms ADD COLUMN seating_layout VARCHAR(50) DEFAULT 'boardroom'"))

        # departments
        dept_cols = {row[1] for row in connection.execute(text("PRAGMA table_info(departments)"))}
        if "cost_center" not in dept_cols:
            connection.execute(text("ALTER TABLE departments ADD COLUMN cost_center VARCHAR(50) DEFAULT 'KST-1000'"))

        # users
        user_cols = {row[1] for row in connection.execute(text("PRAGMA table_info(users)"))}
        if "cost_center" not in user_cols:
            connection.execute(text("ALTER TABLE users ADD COLUMN cost_center VARCHAR(50)"))

        # bookings
        booking_cols = {row[1] for row in connection.execute(text("PRAGMA table_info(bookings)"))}
        if "has_catering" not in booking_cols:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN has_catering BOOLEAN DEFAULT 0"))
        if "catering_notes" not in booking_cols:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN catering_notes VARCHAR(500)"))
        if "cost_center" not in booking_cols:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN cost_center VARCHAR(50)"))
        if "billing_department_id" not in booking_cols:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN billing_department_id INTEGER"))
        if "cost_center_warning_acknowledged" not in booking_cols:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN cost_center_warning_acknowledged BOOLEAN DEFAULT 0"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
