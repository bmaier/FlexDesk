from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models.bookings import Notification
from app.models.reference import User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: int
    type: str
    message: str
    related_booking_id: int | None
    created_at: datetime
    read: bool


@router.get("", response_model=list[NotificationOut])
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).all()
    return [
        NotificationOut(id=n.id, type=n.type, message=n.message, related_booking_id=n.related_booking_id,
                        created_at=n.created_at, read=n.read_at is not None)
        for n in rows
    ]


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if n and n.user_id == user.id and n.read_at is None:
        n.read_at = datetime.utcnow()
        db.commit()
    return {"ok": True}
