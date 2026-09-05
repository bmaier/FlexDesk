from __future__ import annotations

from datetime import date as date_type
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.bookings import Booking, DeskBooking
from app.models.reference import Label
from app.models.structure import Building, Desk, Floor, Property, Room

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


class PropertyOut(BaseModel):
    id: int
    name: str
    address: str
    lat: float
    lon: float
    checkin_required: bool
    total_desks: int
    free_desks: int
    occupancy_pct: int
    building_count: int
    labels: list[str]


def _labels_for(db: Session, model, id_field: str, entity_id: int) -> list[str]:
    rows = db.query(model).filter(getattr(model, id_field) == entity_id).all()
    return [db.get(Label, r.label_id).name for r in rows]


@router.get("/properties", response_model=list[PropertyOut])
def list_properties(target_date: date_type | None = None, db: Session = Depends(get_db)):
    """Standort-Exploration Kartenansicht: Liegenschaften mit Auslastungs-Marker für ein Datum
    (Default: heute)."""
    from app.models.structure import PropertyLabel

    out: list[PropertyOut] = []
    the_day = target_date or datetime.utcnow().date()
    day_start = datetime.combine(the_day, datetime.min.time())
    day_end = datetime.combine(the_day, datetime.max.time())
    for p in db.query(Property).order_by(Property.name).all():
        desk_ids = [
            d.id for d in db.query(Desk).join(Room).join(Floor).join(Building)
            .filter(Building.property_id == p.id).all()
        ]
        total = len(desk_ids)
        labels = _labels_for(db, PropertyLabel, "property_id", p.id)
        if total == 0:
            out.append(PropertyOut(id=p.id, name=p.name, address=p.address, lat=p.lat, lon=p.lon,
                                    checkin_required=p.checkin_required, total_desks=0, free_desks=0,
                                    occupancy_pct=0, building_count=len(p.buildings), labels=labels))
            continue
        booked_desk_ids = set()
        if desk_ids:
            rows = (
                db.query(DeskBooking.desk_id)
                .join(Booking, Booking.id == DeskBooking.booking_id)
                .filter(DeskBooking.desk_id.in_(desk_ids), Booking.status == "confirmed",
                        Booking.start_at <= day_end, Booking.end_at >= day_start)
                .all()
            )
            booked_desk_ids = {r[0] for r in rows}
        free = total - len(booked_desk_ids)
        occ_pct = round((len(booked_desk_ids) / total) * 100) if total else 0
        out.append(PropertyOut(
            id=p.id, name=p.name, address=p.address, lat=p.lat, lon=p.lon,
            checkin_required=p.checkin_required, total_desks=total, free_desks=free,
            occupancy_pct=occ_pct, building_count=len(p.buildings), labels=labels,
        ))
    return out


class DeskNode(BaseModel):
    id: int
    desk_number: str
    labels: list[str]
    approval_required: bool
    checkin_required: bool


class RoomNode(BaseModel):
    id: int
    room_number: str
    name: str
    room_type: str
    capacity: int | None
    approval_required: bool
    restricted_role_code: str | None
    checkin_required: bool
    labels: list[str]
    desks: list[DeskNode]


class FloorNode(BaseModel):
    id: int
    name: str
    floorplan_image_path: str | None
    floorplan_layout: str | None
    rooms: list[RoomNode]


class BuildingNode(BaseModel):
    id: int
    name: str
    labels: list[str]
    floors: list[FloorNode]


class PropertyTree(BaseModel):
    id: int
    name: str
    address: str
    labels: list[str]
    buildings: list[BuildingNode]


@router.get("/properties/{property_id}/tree", response_model=PropertyTree)
def property_tree(property_id: int, db: Session = Depends(get_db)):
    """Full Liegenschaft->Gebäude->Etage->Raum->Desk tree, for FM-Baumstruktur & Gebäude/Etagen-Navigator."""
    from app.models.structure import BuildingLabel, DeskLabel, PropertyLabel, RoomLabel

    p = db.get(Property, property_id)
    buildings_out = []
    for b in sorted(p.buildings, key=lambda x: x.name):
        floors_out = []
        for f in sorted(b.floors, key=lambda x: x.name):
            rooms_out = []
            for r in sorted(f.rooms, key=lambda x: x.room_number):
                desks_out = [
                    DeskNode(id=d.id, desk_number=d.desk_number,
                             labels=_labels_for(db, DeskLabel, "desk_id", d.id),
                             approval_required=d.approval_required, checkin_required=d.checkin_required)
                    for d in sorted(r.desks, key=lambda x: x.desk_number)
                ]
                rooms_out.append(RoomNode(
                    id=r.id, room_number=r.room_number, name=r.name, room_type=r.room_type,
                    capacity=r.capacity, approval_required=r.approval_required,
                    restricted_role_code=r.restricted_role_code, checkin_required=r.checkin_required,
                    labels=_labels_for(db, RoomLabel, "room_id", r.id), desks=desks_out,
                ))
            floors_out.append(FloorNode(id=f.id, name=f.name, floorplan_image_path=f.floorplan_image_path,
                                        floorplan_layout=f.floorplan_layout, rooms=rooms_out))
        buildings_out.append(BuildingNode(id=b.id, name=b.name, labels=_labels_for(db, BuildingLabel, "building_id", b.id), floors=floors_out))
    return PropertyTree(id=p.id, name=p.name, address=p.address,
                         labels=_labels_for(db, PropertyLabel, "property_id", p.id), buildings=buildings_out)


class LabelOut(BaseModel):
    id: int
    name: str
    applicable_types: list[str]


@router.get("/labels", response_model=list[LabelOut])
def list_labels(entity_type: str | None = None, db: Session = Depends(get_db)):
    """`entity_type` filtert auf Labels, die f\u00fcr diesen Typ zul\u00e4ssig sind
    (property | building | room | meeting_room | desk) \u2014 z.B. damit "Barrierefrei" nicht
    getrennt f\u00fcr jeden Typ neu angelegt werden muss, aber pro Kontext nur Sinnvolles auswählbar ist."""
    out = []
    for l in db.query(Label).order_by(Label.name).all():
        types = l.applicable_types.split(",")
        if entity_type and entity_type not in types:
            continue
        out.append(LabelOut(id=l.id, name=l.name, applicable_types=types))
    return out


class RoomBookingSlot(BaseModel):
    booking_id: int
    start_at: datetime
    end_at: datetime
    status: str
    booked_for_name: str
    booked_for_department: str | None
    remark: str | None


@router.get("/rooms/{room_id}/bookings", response_model=list[RoomBookingSlot])
def room_bookings_for_date(room_id: int, target_date: str, db: Session = Depends(get_db)):
    """Mini-Timeline-Daten für einen Meetingraum an einem Tag (FR-56: Klarname statt Pseudonym)."""
    from app.models.bookings import Booking, RoomBooking

    day_start = datetime.fromisoformat(target_date)
    day_end = day_start.replace(hour=23, minute=59, second=59)
    rows = (
        db.query(Booking)
        .join(RoomBooking, RoomBooking.booking_id == Booking.id)
        .filter(RoomBooking.room_id == room_id, Booking.status.in_(("confirmed", "pending_approval")),
                Booking.start_at <= day_end, Booking.end_at >= day_start)
        .all()
    )
    out = []
    for b in rows:
        person = b.booked_for
        out.append(RoomBookingSlot(
            booking_id=b.id, start_at=b.start_at, end_at=b.end_at, status=b.status,
            booked_for_name=person.display_name, booked_for_department=person.department.name if person.department else None,
            remark=b.remark,
        ))
    return out


class MeetingRoomOut(BaseModel):
    id: int
    floor_id: int | None = None
    floor_name: str | None = None
    building_id: int | None = None
    building_name: str | None = None
    room_number: str
    name: str
    capacity: int | None
    approval_required: bool
    restricted_role_code: str | None
    labels: list[str]
    is_occupied_now: bool
    pos_x: float | None = None
    pos_y: float | None = None
    width: float | None = None
    height: float | None = None


@router.get("/properties/{property_id}/meeting-rooms", response_model=list[MeetingRoomOut])
def meeting_rooms_for_property(property_id: int, db: Session = Depends(get_db)):
    from app.models.bookings import Booking, RoomBooking
    from app.models.structure import RoomLabel

    now = datetime.utcnow()
    out = []
    rooms = (
        db.query(Room).join(Floor).join(Building)
        .filter(Building.property_id == property_id, Room.room_type == "meeting")
        .all()
    )
    for r in rooms:
        occupied = (
            db.query(Booking).join(RoomBooking, RoomBooking.booking_id == Booking.id)
            .filter(RoomBooking.room_id == r.id, Booking.status == "confirmed",
                    Booking.start_at <= now, Booking.end_at >= now)
            .first()
            is not None
        )
        floor = db.get(Floor, r.floor_id)
        building = db.get(Building, floor.building_id) if floor else None
        out.append(MeetingRoomOut(
            id=r.id, floor_id=r.floor_id, floor_name=floor.name if floor else None,
            building_id=building.id if building else None, building_name=building.name if building else None,
            room_number=r.room_number, name=r.name, capacity=r.capacity,
            approval_required=r.approval_required, restricted_role_code=r.restricted_role_code,
            labels=_labels_for(db, RoomLabel, "room_id", r.id), is_occupied_now=occupied,
            pos_x=r.pos_x, pos_y=r.pos_y, width=r.width, height=r.height,
        ))
    return out


@router.get("/floors/{floor_id}/meeting-rooms", response_model=list[MeetingRoomOut])
def meeting_rooms_for_floor(floor_id: int, db: Session = Depends(get_db)):
    from app.models.bookings import Booking, RoomBooking
    from app.models.structure import RoomLabel

    now = datetime.utcnow()
    out = []
    floor = db.get(Floor, floor_id)
    if not floor:
        return []
    building = db.get(Building, floor.building_id) if floor else None
    rooms = db.query(Room).filter(Room.floor_id == floor_id, Room.room_type == "meeting").all()
    for r in rooms:
        occupied = (
            db.query(Booking).join(RoomBooking, RoomBooking.booking_id == Booking.id)
            .filter(RoomBooking.room_id == r.id, Booking.status == "confirmed",
                    Booking.start_at <= now, Booking.end_at >= now)
            .first()
            is not None
        )
        out.append(MeetingRoomOut(
            id=r.id, floor_id=r.floor_id, floor_name=floor.name if floor else None,
            building_id=building.id if building else None, building_name=building.name if building else None,
            room_number=r.room_number, name=r.name, capacity=r.capacity,
            approval_required=r.approval_required, restricted_role_code=r.restricted_role_code,
            labels=_labels_for(db, RoomLabel, "room_id", r.id), is_occupied_now=occupied,
            pos_x=r.pos_x, pos_y=r.pos_y, width=r.width, height=r.height,
        ))
    return out

