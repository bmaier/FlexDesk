from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_user_roles
from app.db import get_db
from app.models.bookings import Approval, Booking, BookingAudit, DeskBooking, RoomBooking
from app.models.reference import User
from app.models.structure import Desk, Room, RoomResponsible
from app.routers.bookings import _booking_to_out, _err
from app.services.notifications import notify

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


def _is_approver_for_room(db: Session, user: User, room_id: int) -> bool:
    if "fm" in get_user_roles(user, db):
        return True
    return db.query(RoomResponsible).filter(RoomResponsible.room_id == room_id, RoomResponsible.user_id == user.id).first() is not None


class ApprovalQueueItem(BaseModel):
    booking_id: int
    requester_name: str
    requester_department: str | None
    resource_label: str
    start_at: datetime
    end_at: datetime
    created_at: datetime
    remark: str | None


@router.get("/inbox", response_model=list[ApprovalQueueItem])
def inbox(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Genehmigungscenter — Ausstehende Anfragen, für die der Nutzer Raumverantwortlicher/FM ist."""
    pending = db.query(Booking).filter(Booking.status == "pending_approval").all()
    out = []
    for b in pending:
        if b.kind == "room":
            link = db.query(RoomBooking).filter(RoomBooking.booking_id == b.id).first()
            room = db.get(Room, link.room_id)
            if not _is_approver_for_room(db, user, room.id):
                continue
            label = room.name
        else:
            link = db.query(DeskBooking).filter(DeskBooking.booking_id == b.id).first()
            desk = db.get(Desk, link.desk_id)
            room = db.get(Room, desk.room_id)
            if not _is_approver_for_room(db, user, room.id):
                continue
            label = f"{desk.desk_number} · {room.name}"
        requester = db.get(User, b.booked_by_user_id)
        out.append(ApprovalQueueItem(
            booking_id=b.id, requester_name=requester.display_name,
            requester_department=requester.department.name if requester.department else None,
            resource_label=label, start_at=b.start_at, end_at=b.end_at, created_at=b.created_at, remark=b.remark,
        ))
    return out


class DecisionIn(BaseModel):
    decision: str  # approved | rejected
    comment: str | None = None


@router.post("/{booking_id}/decide")
def decide(booking_id: int, payload: DecisionIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.get(Booking, booking_id)
    if booking is None or booking.status != "pending_approval":
        _err(404, "APPROVAL_NOT_FOUND", "Keine offene Genehmigungsanfrage gefunden.")

    if booking.kind == "room":
        room_id = db.query(RoomBooking).filter(RoomBooking.booking_id == booking.id).first().room_id
    else:
        desk = db.get(Desk, db.query(DeskBooking).filter(DeskBooking.booking_id == booking.id).first().desk_id)
        room_id = desk.room_id
    if not _is_approver_for_room(db, user, room_id):
        _err(403, "NOT_AUTHORIZED", "Sie sind für diesen Raum nicht als Genehmiger hinterlegt.")

    if payload.decision == "rejected" and not payload.comment:
        _err(400, "REASON_REQUIRED", "Für eine Ablehnung ist eine Begründung erforderlich.")

    booking.status = "confirmed" if payload.decision == "approved" else "rejected"
    if payload.decision == "rejected":
        booking.cancel_kind = "rejected"
        booking.cancel_reason = payload.comment

    db.add(Approval(booking_id=booking.id, decided_by_user_id=user.id, decision=payload.decision, comment=payload.comment))
    db.add(BookingAudit(booking_id=booking.id, actor_user_id=user.id, action=payload.decision))
    message = (
        f"Ihre Anfrage wurde genehmigt." if payload.decision == "approved"
        else f"Ihre Anfrage wurde abgelehnt (Grund: {payload.comment})."
    )
    notify(db, booking.booked_for_user_id, "approval_decided", message, related_booking_id=booking.id)
    db.commit()
    db.refresh(booking)
    return _booking_to_out(db, booking)
