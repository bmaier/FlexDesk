"""Booking domain: series, bookings (subtyped desk/room), approvals, check-ins."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class BookingSeries(Base):
    """Serienbuchung, FR-9."""

    __tablename__ = "booking_series"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    for_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    interval: Mapped[str] = mapped_column(String(20))  # weekly | biweekly | monthly
    end_date: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SeriesWeekday(Base):
    """Weekday pattern, junction table avoids a repeating-group column."""

    __tablename__ = "series_weekdays"

    series_id: Mapped[int] = mapped_column(ForeignKey("booking_series.id"), primary_key=True)
    weekday: Mapped[int] = mapped_column(Integer, primary_key=True)  # 0=Mon ... 6=Sun


class Booking(Base):
    """Common booking header. Subtyped into desk_bookings/room_bookings below."""

    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(10))  # 'desk' | 'room'
    status: Mapped[str] = mapped_column(String(20), default="confirmed")
    # confirmed | pending_approval | rejected | cancelled
    booked_for_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    booked_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))  # FR-19 klarname context
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    series_id: Mapped[int | None] = mapped_column(ForeignKey("booking_series.id"), nullable=True)
    seating_option_id: Mapped[int | None] = mapped_column(ForeignKey("seating_options.id"), nullable=True)
    is_changeover_slot: Mapped[bool] = mapped_column(Boolean, default=False)  # FR-54 auto-reserved day
    remark: Mapped[str | None] = mapped_column(String(500), nullable=True)  # FR-57, VM-only field
    double_booking_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Pflichtbegruendung, wenn bewusst trotz ueberlappender Eigenbuchung fortgefahren wurde
    cancel_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cancelled_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    cancel_kind: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # 'lock' | 'fm_force' | 'series_conflict' | 'checkin_missed' | 'self' | 'rejected'
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    booked_for = relationship("User", foreign_keys=[booked_for_user_id])
    booked_by = relationship("User", foreign_keys=[booked_by_user_id])


class DeskBooking(Base):
    __tablename__ = "desk_bookings"

    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), primary_key=True)
    desk_id: Mapped[int] = mapped_column(ForeignKey("desks.id"))
    day_part: Mapped[str] = mapped_column(String(10), default="full")  # full | am | pm


class RoomBooking(Base):
    __tablename__ = "room_bookings"

    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))


class Approval(Base):
    """Entscheidung über eine Buchungsanfrage, FR-40."""

    __tablename__ = "approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"))
    decided_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[str] = mapped_column(String(20))  # approved | rejected
    comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CheckIn(Base):
    """FR-47/48."""

    __tablename__ = "checkins"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), unique=True)
    deadline_at: Mapped[datetime] = mapped_column(DateTime)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | done | missed


class BookingAudit(Base):
    """Auditierbarkeit von Vertretungshandlungen, FR-13."""

    __tablename__ = "booking_audit"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"))
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(40))  # created | cancelled | approved | rejected
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DefectReport(Base):
    """FR-28. Pragmatic single table (documented simplification) instead of subtyping."""

    __tablename__ = "defect_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_kind: Mapped[str] = mapped_column(String(10))  # 'desk' | 'room'
    desk_id: Mapped[int | None] = mapped_column(ForeignKey("desks.id"), nullable=True)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id"), nullable=True)
    description: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | locked | resolved
    reported_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Notification(Base):
    """FR-29/FR-49."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String(30))
    # foreign_cancel | approval_decided | reminder | checkin_missed
    message: Mapped[str] = mapped_column(String(500))
    related_booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
