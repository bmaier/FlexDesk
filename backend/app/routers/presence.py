from __future__ import annotations

from datetime import date as date_type
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models.bookings import Booking, DeskBooking
from app.models.reference import User
from app.models.structure import Building, Desk, Floor, Room

router = APIRouter(prefix="/api/presence", tags=["presence"])


class PresenceEntry(BaseModel):
    booking_id: int
    desk_id: int
    desk_number: str
    room_name: str
    building_name: str
    property_name: str
    pos_x: float | None
    pos_y: float | None
    idm_code: str
    display_name: str | None  # only populated if klarname_opt_in (FR-21) — otherwise use /reveal
    department: str | None


@router.get("", response_model=list[PresenceEntry])
def presence(q: str | None = None, property_id: int | None = None, target_date: date_type | None = None,
             user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Pseudonymisierte Standardansicht (FR-18); Klarname nur bei Opt-in (FR-21) direkt sichtbar.
    Zeigt alle Desk-Buchungen, die den gewählten Tag (Default: heute) abdecken."""
    the_date = target_date or datetime.utcnow().date()
    day_start = datetime.combine(the_date, datetime.min.time())
    day_end = datetime.combine(the_date, datetime.max.time())
    query = (
        db.query(Booking)
        .join(DeskBooking, DeskBooking.booking_id == Booking.id)
        .filter(Booking.status == "confirmed", Booking.start_at <= day_end, Booking.end_at >= day_start)
    )
    out: list[PresenceEntry] = []
    for b in query.all():
        link = db.query(DeskBooking).filter(DeskBooking.booking_id == b.id).first()
        desk = db.get(Desk, link.desk_id)
        room = db.get(Room, desk.room_id)
        floor = db.get(Floor, room.floor_id)
        building = db.get(Building, floor.building_id)
        if property_id and building.property_id != property_id:
            continue
        person = db.get(User, b.booked_for_user_id)
        if q:
            haystack = f"{person.idm_code} {person.display_name} {person.department.name if person.department else ''}".lower()
            if q.lower() not in haystack:
                continue
        out.append(PresenceEntry(
            booking_id=b.id, desk_id=desk.id, desk_number=desk.desk_number, room_name=room.name,
            building_name=building.name, property_name=building.property.name,
            pos_x=desk.pos_x, pos_y=desk.pos_y, idm_code=person.idm_code,
            display_name=person.display_name if person.klarname_opt_in else None,
            department=person.department.name if person.department else None,
        ))
    return out


class RevealOut(BaseModel):
    idm_code: str
    display_name: str


@router.get("/reveal/{idm_code}", response_model=RevealOut)
def reveal(idm_code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """FR-20: bewusster, separater Klarnamen-Lookup-Schritt (kein automatisches Auflösen)."""
    person = db.query(User).filter(User.idm_code == idm_code).first()
    if person is None:
        return RevealOut(idm_code=idm_code, display_name="Unbekannt")
    return RevealOut(idm_code=person.idm_code, display_name=person.display_name)
