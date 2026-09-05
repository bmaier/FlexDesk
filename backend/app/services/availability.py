"""Overlap / conflict checks and ranking helpers shared by booking routers.

FR-5a (desk conflict), FR-8 (room conflict incl. pending-as-blocking), FR-4
(day-part switch time), FR-3 (preference ranking, soft).
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.bookings import Booking, DeskBooking, RoomBooking
from app.models.locks import DeskLock, Lock, RoomLock
from app.models.reference import UserPreference
from app.models.structure import Desk, DeskLabel, Room, RoomLabel

ACTIVE_STATUSES = ("confirmed", "pending_approval")


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def desk_conflicts(db: Session, desk_id: int, start_at: datetime, end_at: datetime, exclude_booking_id: int | None = None) -> list[Booking]:
    q = (
        db.query(Booking)
        .join(DeskBooking, DeskBooking.booking_id == Booking.id)
        .filter(DeskBooking.desk_id == desk_id, Booking.status.in_(ACTIVE_STATUSES))
    )
    if exclude_booking_id:
        q = q.filter(Booking.id != exclude_booking_id)
    return [b for b in q.all() if _overlaps(b.start_at, b.end_at, start_at, end_at)]


def room_conflicts(db: Session, room_id: int, start_at: datetime, end_at: datetime, exclude_booking_id: int | None = None) -> list[Booking]:
    q = (
        db.query(Booking)
        .join(RoomBooking, RoomBooking.booking_id == Booking.id)
        .filter(RoomBooking.room_id == room_id, Booking.status.in_(ACTIVE_STATUSES))
    )
    if exclude_booking_id:
        q = q.filter(Booking.id != exclude_booking_id)
    return [b for b in q.all() if _overlaps(b.start_at, b.end_at, start_at, end_at)]


def desk_is_locked(db: Session, desk_id: int, start_at: datetime, end_at: datetime) -> Lock | None:
    q = (
        db.query(Lock)
        .join(DeskLock, DeskLock.lock_id == Lock.id)
        .filter(DeskLock.desk_id == desk_id, Lock.active.is_(True))
    )
    for lock in q.all():
        lock_end = lock.end_at or datetime.max
        if _overlaps(lock.start_at, lock_end, start_at, end_at):
            return lock
    return None


def room_is_locked(db: Session, room_id: int, start_at: datetime, end_at: datetime) -> Lock | None:
    q = (
        db.query(Lock)
        .join(RoomLock, RoomLock.lock_id == Lock.id)
        .filter(RoomLock.room_id == room_id, Lock.active.is_(True))
    )
    for lock in q.all():
        lock_end = lock.end_at or datetime.max
        if _overlaps(lock.start_at, lock_end, start_at, end_at):
            return lock
    return None


def user_overlapping_bookings(db: Session, user_id: int, start_at: datetime, end_at: datetime,
                               kind: str | None = None, exclude_booking_id: int | None = None) -> list[Booking]:
    """Aktive Buchungen einer Person, die sich mit dem Zeitraum überlappen — Grundlage für die
    Doppelbuchungs-Warnung. `kind` schränkt auf dieselbe Buchungsart ein (Desk sitzt neben einer
    Meetingraum-Teilnahme ist normal, zwei überlappende Desks bzw. zwei überlappende Meetingräume
    für dieselbe Person sind es nicht — daher wird nur innerhalb derselben Art verglichen)."""
    q = db.query(Booking).filter(Booking.booked_for_user_id == user_id, Booking.status.in_(ACTIVE_STATUSES))
    if kind:
        q = q.filter(Booking.kind == kind)
    if exclude_booking_id:
        q = q.filter(Booking.id != exclude_booking_id)
    return [b for b in q.all() if _overlaps(b.start_at, b.end_at, start_at, end_at)]


def preference_score(db: Session, user_id: int, desk_id: int) -> int:
    """Number of matching labels between the user's preferences and the desk's labels (FR-3 soft ranking)."""
    pref_label_ids = {row.label_id for row in db.query(UserPreference).filter(UserPreference.user_id == user_id)}
    if not pref_label_ids:
        return 0
    desk_label_ids = {row.label_id for row in db.query(DeskLabel).filter(DeskLabel.desk_id == desk_id)}
    return len(pref_label_ids & desk_label_ids)
