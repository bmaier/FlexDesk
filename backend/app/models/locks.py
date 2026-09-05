"""Locks (Sperrung, FR-26/27) and confidential room blocking (FR-16/17)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Lock(Base):
    """Common lock header, subtyped below to keep FKs non-nullable per subtype."""

    __tablename__ = "locks"

    id: Mapped[int] = mapped_column(primary_key=True)
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # open-ended allowed
    reason: Mapped[str] = mapped_column(String(500))
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class DeskLock(Base):
    __tablename__ = "desk_locks"

    lock_id: Mapped[int] = mapped_column(ForeignKey("locks.id"), primary_key=True)
    desk_id: Mapped[int] = mapped_column(ForeignKey("desks.id"))


class RoomLock(Base):
    __tablename__ = "room_locks"

    lock_id: Mapped[int] = mapped_column(ForeignKey("locks.id"), primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))


class PropertyLock(Base):
    __tablename__ = "property_locks"

    lock_id: Mapped[int] = mapped_column(ForeignKey("locks.id"), primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id"))


class ConfidentialBlock(Base):
    """Vertrauliche Raumblockierung, FR-16/17. No approval check by design."""

    __tablename__ = "confidential_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    category: Mapped[str] = mapped_column(String(100))
    justification: Mapped[str] = mapped_column(String(1000))
    file_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    requested_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | rejected | ended
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ConfidentialBlockFeature(Base):
    """Security feature selection (Abhörschutz, Biometrie, ...) - junction avoids repeating group."""

    __tablename__ = "confidential_block_features"

    block_id: Mapped[int] = mapped_column(ForeignKey("confidential_blocks.id"), primary_key=True)
    feature_name: Mapped[str] = mapped_column(String(100), primary_key=True)


class ConfidentialAuditLog(Base):
    """Access-restricted audit trail, separate from the regular FM protocol (FR-17)."""

    __tablename__ = "confidential_audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    block_id: Mapped[int | None] = mapped_column(ForeignKey("confidential_blocks.id"), nullable=True)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(40))  # requested | rejected | ended
    details: Mapped[str] = mapped_column(String(1000))
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
