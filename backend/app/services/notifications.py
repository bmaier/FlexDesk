"""Notification creation helper (FR-29/FR-49). In-DB only, no email/EventGrid for the PoC."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.bookings import Notification


def notify(db: Session, user_id: int, type_: str, message: str, related_booking_id: int | None = None) -> Notification:
    n = Notification(user_id=user_id, type=type_, message=message, related_booking_id=related_booking_id)
    db.add(n)
    return n
