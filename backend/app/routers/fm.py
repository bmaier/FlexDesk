from __future__ import annotations

import difflib
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.db import get_db
from app.models.bookings import Booking, BookingAudit, DeskBooking, RoomBooking
from app.models.locks import DeskLock, Lock, PropertyLock, RoomLock
from app.models.reference import Department, Label, Role, User
from app.models.structure import (
    Building,
    BuildingLabel,
    Desk,
    DeskLabel,
    Floor,
    Property,
    PropertyLabel,
    Room,
    RoomDepartment,
    RoomLabel,
    RoomResponsible,
    SeatingOption,
    Zone,
    ZoneDepartment,
    ZoneDesk,
)
from app.models.bookings import DefectReport
from app.routers.bookings import _booking_to_out, _err
from app.services.availability import desk_conflicts, room_conflicts
from app.services.notifications import notify

router = APIRouter(prefix="/api/fm", tags=["facility-management"])

FLOORPLAN_UPLOAD_DIR = Path(__file__).resolve().parent.parent / "static" / "floorplans"


# --------------------------------------------------------------------------
# Stammdaten-Baum anlegen (FR-22)
# --------------------------------------------------------------------------

class CreatePropertyIn(BaseModel):
    name: str
    address: str
    lat: float
    lon: float
    checkin_required: bool = False


class IdOut(BaseModel):
    id: int


@router.post("/properties", response_model=IdOut)
def create_property(payload: CreatePropertyIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    existing = db.query(Property).filter(Property.name == payload.name.strip()).first()
    if existing:
        existing.address = payload.address
        existing.lat = payload.lat
        existing.lon = payload.lon
        existing.checkin_required = payload.checkin_required
        db.commit()
        return IdOut(id=existing.id)
    p = Property(name=payload.name, address=payload.address, lat=payload.lat, lon=payload.lon,
                 checkin_required=payload.checkin_required)
    db.add(p)
    db.commit()
    db.refresh(p)
    return IdOut(id=p.id)


class UpdatePropertyIn(BaseModel):
    name: str | None = None
    address: str | None = None
    lat: float | None = None
    lon: float | None = None
    checkin_required: bool | None = None


@router.patch("/properties/{property_id}", response_model=IdOut)
def update_property(property_id: int, payload: UpdatePropertyIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    prop = db.get(Property, property_id)
    if prop is None:
        _err(404, "PROPERTY_NOT_FOUND", "Liegenschaft nicht gefunden.")
    for field in ("name", "address", "lat", "lon", "checkin_required"):
        value = getattr(payload, field)
        if value is not None:
            setattr(prop, field, value)
    db.commit()
    return IdOut(id=prop.id)


@router.delete("/properties/{property_id}")
def delete_property(property_id: int, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    """Entfernt eine ungenutzte Liegenschaft samt Struktur; schützt Standardstandorte."""
    prop = db.get(Property, property_id)
    if prop is None:
        _err(404, "PROPERTY_NOT_FOUND", "Liegenschaft nicht gefunden.")
    if db.query(User).filter(User.home_property_id == property_id).first():
        _err(409, "PROPERTY_IN_USE", "Diese Liegenschaft ist als Standardstandort hinterlegt und kann nicht gelöscht werden.")
    zone_ids = [z.id for z in db.query(Zone).filter(Zone.property_id == property_id).all()]
    if zone_ids:
        db.query(ZoneDesk).filter(ZoneDesk.zone_id.in_(zone_ids)).delete(synchronize_session=False)
        db.query(ZoneDepartment).filter(ZoneDepartment.zone_id.in_(zone_ids)).delete(synchronize_session=False)
        db.query(Zone).filter(Zone.id.in_(zone_ids)).delete(synchronize_session=False)
    db.query(PropertyLabel).filter(PropertyLabel.property_id == property_id).delete(synchronize_session=False)
    db.delete(prop)
    db.commit()
    return {"ok": True}


class CreateBuildingIn(BaseModel):
    name: str


@router.post("/properties/{property_id}/buildings", response_model=IdOut)
def create_building(property_id: int, payload: CreateBuildingIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    if db.get(Property, property_id) is None:
        _err(400, "PROPERTY_REQUIRED", "Liegenschaft erforderlich.")
    b = Building(property_id=property_id, name=payload.name)
    db.add(b)
    db.commit()
    db.refresh(b)
    return IdOut(id=b.id)


class UpdateBuildingIn(BaseModel):
    name: str


@router.patch("/buildings/{building_id}", response_model=IdOut)
def update_building(building_id: int, payload: UpdateBuildingIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    building = db.get(Building, building_id)
    if building is None:
        _err(404, "BUILDING_NOT_FOUND", "Gebäude nicht gefunden.")
    building.name = payload.name
    db.commit()
    return IdOut(id=building.id)


class CreateFloorIn(BaseModel):
    name: str


@router.post("/buildings/{building_id}/floors", response_model=IdOut)
def create_floor(building_id: int, payload: CreateFloorIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    if db.get(Building, building_id) is None:
        _err(400, "BUILDING_REQUIRED", "Gebäude erforderlich.")
    f = Floor(building_id=building_id, name=payload.name)
    db.add(f)
    db.commit()
    db.refresh(f)
    return IdOut(id=f.id)


class UpdateFloorIn(BaseModel):
    name: str


@router.patch("/floors/{floor_id}", response_model=IdOut)
def update_floor(floor_id: int, payload: UpdateFloorIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    floor = db.get(Floor, floor_id)
    if floor is None:
        _err(404, "FLOOR_NOT_FOUND", "Etage nicht gefunden.")
    floor.name = payload.name
    db.commit()
    return IdOut(id=floor.id)


class FloorplanLayoutIn(BaseModel):
    layout: str


@router.get("/floors/{floor_id}/floorplan-layout")
def get_floorplan_layout(floor_id: int, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    floor = db.get(Floor, floor_id)
    if floor is None:
        _err(404, "FLOOR_NOT_FOUND", "Etage nicht gefunden.")
    return {"layout": floor.floorplan_layout}


@router.put("/floors/{floor_id}/floorplan-layout")
def save_floorplan_layout(floor_id: int, payload: FloorplanLayoutIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    floor = db.get(Floor, floor_id)
    if floor is None:
        _err(404, "FLOOR_NOT_FOUND", "Etage nicht gefunden.")
    if len(payload.layout) > 20000:
        _err(400, "FLOORPLAN_TOO_LARGE", "Der Grundriss ist zu groß.")
    floor.floorplan_layout = payload.layout
    db.commit()
    return {"ok": True}


class CreateRoomIn(BaseModel):
    room_number: str
    name: str
    room_type: str  # meeting | desk_area
    capacity: int | None = None
    approval_required: bool = False
    restricted_role_code: str | None = None
    checkin_required: bool = False
    pos_x: float | None = None
    pos_y: float | None = None
    width: float | None = None
    height: float | None = None
    label_names: list[str] = []


@router.post("/floors/{floor_id}/rooms", response_model=IdOut)
def create_room(floor_id: int, payload: CreateRoomIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    if db.get(Floor, floor_id) is None:
        _err(400, "FLOOR_REQUIRED", "Etage erforderlich.")
    r = Room(floor_id=floor_id, room_number=payload.room_number, name=payload.name, room_type=payload.room_type,
              capacity=payload.capacity, approval_required=payload.approval_required,
              restricted_role_code=payload.restricted_role_code, checkin_required=payload.checkin_required,
              pos_x=payload.pos_x, pos_y=payload.pos_y, width=payload.width, height=payload.height)
    db.add(r)
    db.flush()
    for name in payload.label_names:
        label = _get_or_suggest_label(db, name, auto_create=True)
        db.add(RoomLabel(room_id=r.id, label_id=label.id))
    db.commit()
    db.refresh(r)
    return IdOut(id=r.id)


class CreateDeskIn(BaseModel):
    desk_number: str
    pos_x: float | None = None
    pos_y: float | None = None
    approval_required: bool = False
    checkin_required: bool = False
    label_names: list[str] = []


@router.post("/rooms/{room_id}/desks", response_model=IdOut)
def create_desk(room_id: int, payload: CreateDeskIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if room is None:
        _err(400, "ROOM_REQUIRED", "Raum erforderlich.")
    if room.room_type != "desk_area":
        _err(400, "WRONG_ROOM_TYPE", "Desks können nur in Büro-/Desk-Flächen angelegt werden.")
    d = Desk(room_id=room_id, desk_number=payload.desk_number, pos_x=payload.pos_x, pos_y=payload.pos_y,
             approval_required=payload.approval_required, checkin_required=payload.checkin_required)
    db.add(d)
    db.flush()
    for name in payload.label_names:
        label = _get_or_suggest_label(db, name, auto_create=True)
        db.add(DeskLabel(desk_id=d.id, label_id=label.id))
    db.commit()
    db.refresh(d)
    return IdOut(id=d.id)


class UpdateRoomIn(BaseModel):
    approval_required: bool | None = None
    restricted_role_code: str | None = None
    name: str | None = None
    room_number: str | None = None
    capacity: int | None = None
    checkin_required: bool | None = None


@router.patch("/rooms/{room_id}", response_model=IdOut)
def update_room(room_id: int, payload: UpdateRoomIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if room is None:
        _err(404, "ROOM_NOT_FOUND", "Raum nicht gefunden.")
    if payload.approval_required is not None:
        room.approval_required = payload.approval_required
    if payload.restricted_role_code is not None:
        room.restricted_role_code = payload.restricted_role_code or None
    if payload.name is not None:
        room.name = payload.name
    if payload.room_number is not None:
        room.room_number = payload.room_number
    if payload.capacity is not None:
        room.capacity = payload.capacity
    if payload.checkin_required is not None:
        room.checkin_required = payload.checkin_required
    db.commit()
    return IdOut(id=room.id)


class UpdateDeskIn(BaseModel):
    desk_number: str | None = None
    approval_required: bool | None = None
    checkin_required: bool | None = None


@router.patch("/desks/{desk_id}", response_model=IdOut)
def update_desk(desk_id: int, payload: UpdateDeskIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    desk = db.get(Desk, desk_id)
    if desk is None:
        _err(404, "DESK_NOT_FOUND", "Arbeitsplatz nicht gefunden.")
    if payload.desk_number is not None:
        desk.desk_number = payload.desk_number
    if payload.approval_required is not None:
        desk.approval_required = payload.approval_required
    if payload.checkin_required is not None:
        desk.checkin_required = payload.checkin_required
    db.commit()
    return IdOut(id=desk.id)


class ResponsibleIn(BaseModel):
    user_id: int


@router.post("/rooms/{room_id}/responsibles", response_model=IdOut)
def add_responsible(room_id: int, payload: ResponsibleIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    """FR-42: mehrere Raumverantwortliche möglich."""
    existing = db.query(RoomResponsible).filter(RoomResponsible.room_id == room_id, RoomResponsible.user_id == payload.user_id).first()
    if not existing:
        db.add(RoomResponsible(room_id=room_id, user_id=payload.user_id))
        db.commit()
    return IdOut(id=room_id)


@router.delete("/rooms/{room_id}/responsibles/{user_id}")
def remove_responsible(room_id: int, user_id: int, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    db.query(RoomResponsible).filter(RoomResponsible.room_id == room_id, RoomResponsible.user_id == user_id).delete()
    db.commit()
    return {"ok": True}


# --------------------------------------------------------------------------
# Label-Zuordnung zu bestehenden R\u00e4umen/Desks (nachtr\u00e4gliches Bearbeiten)
# --------------------------------------------------------------------------

class AssignLabelIn(BaseModel):
    label_id: int


@router.post("/rooms/{room_id}/labels", response_model=IdOut)
def assign_room_label(room_id: int, payload: AssignLabelIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    if not db.query(RoomLabel).filter(RoomLabel.room_id == room_id, RoomLabel.label_id == payload.label_id).first():
        db.add(RoomLabel(room_id=room_id, label_id=payload.label_id))
        db.commit()
    return IdOut(id=room_id)


@router.delete("/rooms/{room_id}/labels/{label_id}")
def remove_room_label(room_id: int, label_id: int, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    db.query(RoomLabel).filter(RoomLabel.room_id == room_id, RoomLabel.label_id == label_id).delete()
    db.commit()
    return {"ok": True}


@router.post("/desks/{desk_id}/labels", response_model=IdOut)
def assign_desk_label(desk_id: int, payload: AssignLabelIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    if not db.query(DeskLabel).filter(DeskLabel.desk_id == desk_id, DeskLabel.label_id == payload.label_id).first():
        db.add(DeskLabel(desk_id=desk_id, label_id=payload.label_id))
        db.commit()
    return IdOut(id=desk_id)


@router.delete("/desks/{desk_id}/labels/{label_id}")
def remove_desk_label(desk_id: int, label_id: int, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    db.query(DeskLabel).filter(DeskLabel.desk_id == desk_id, DeskLabel.label_id == label_id).delete()
    db.commit()
    return {"ok": True}


@router.post("/properties/{property_id}/labels", response_model=IdOut)
def assign_property_label(property_id: int, payload: AssignLabelIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    """z.B. 'Barrierefrei' für die gesamte Liegenschaft."""
    if not db.query(PropertyLabel).filter(PropertyLabel.property_id == property_id, PropertyLabel.label_id == payload.label_id).first():
        db.add(PropertyLabel(property_id=property_id, label_id=payload.label_id))
        db.commit()
    return IdOut(id=property_id)


@router.delete("/properties/{property_id}/labels/{label_id}")
def remove_property_label(property_id: int, label_id: int, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    db.query(PropertyLabel).filter(PropertyLabel.property_id == property_id, PropertyLabel.label_id == label_id).delete()
    db.commit()
    return {"ok": True}


@router.post("/buildings/{building_id}/labels", response_model=IdOut)
def assign_building_label(building_id: int, payload: AssignLabelIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    """z.B. 'Schulungszentrum' für ein einzelnes Gebäude."""
    if not db.query(BuildingLabel).filter(BuildingLabel.building_id == building_id, BuildingLabel.label_id == payload.label_id).first():
        db.add(BuildingLabel(building_id=building_id, label_id=payload.label_id))
        db.commit()
    return IdOut(id=building_id)


@router.delete("/buildings/{building_id}/labels/{label_id}")
def remove_building_label(building_id: int, label_id: int, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    db.query(BuildingLabel).filter(BuildingLabel.building_id == building_id, BuildingLabel.label_id == label_id).delete()
    db.commit()
    return {"ok": True}


# --------------------------------------------------------------------------
# Raum <-> Organisationseinheit (Hierarchie-Kaskade konfigurierbar)
# --------------------------------------------------------------------------

class AssignRoomDepartmentIn(BaseModel):
    department_id: int
    include_descendants: bool = True


class RoomDepartmentOut(BaseModel):
    department_id: int
    department_name: str
    department_code: str
    include_descendants: bool


@router.get("/rooms/{room_id}/departments", response_model=list[RoomDepartmentOut])
def list_room_departments(room_id: int, db: Session = Depends(get_db)):
    rows = db.query(RoomDepartment).filter(RoomDepartment.room_id == room_id).all()
    out = []
    for r in rows:
        dept = db.get(Department, r.department_id)
        out.append(RoomDepartmentOut(department_id=dept.id, department_name=dept.name, department_code=dept.code,
                                      include_descendants=r.include_descendants))
    return out


@router.post("/rooms/{room_id}/departments", response_model=IdOut)
def assign_room_department(room_id: int, payload: AssignRoomDepartmentIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    """Ordnet einem Raum eine Org-Einheit zu. include_descendants=True (Default) gew\u00e4hrt auch allen
    untergeordneten Einheiten Zugriff (z.B. Abteilung "6" -> auch "6.1", "6.2", "6.2.1", ...);
    False beschr\u00e4nkt exakt auf die genannte Einheit (z.B. nur "6.2", nicht "6" oder "6.1")."""
    existing = db.query(RoomDepartment).filter(RoomDepartment.room_id == room_id, RoomDepartment.department_id == payload.department_id).first()
    if existing:
        existing.include_descendants = payload.include_descendants
    else:
        db.add(RoomDepartment(room_id=room_id, department_id=payload.department_id, include_descendants=payload.include_descendants))
    db.commit()
    return IdOut(id=room_id)


@router.delete("/rooms/{room_id}/departments/{department_id}")
def remove_room_department(room_id: int, department_id: int, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    db.query(RoomDepartment).filter(RoomDepartment.room_id == room_id, RoomDepartment.department_id == department_id).delete()
    db.commit()
    return {"ok": True}


# --------------------------------------------------------------------------
# Labels (FR-23/24/25)
# --------------------------------------------------------------------------

class LabelSuggestion(BaseModel):
    label_id: int
    label_name: str
    similarity: float


class LabelCreateResult(BaseModel):
    label_id: int
    label_name: str
    created: bool
    similar: list[LabelSuggestion]


VALID_LABEL_TYPES = {"property", "building", "room", "meeting_room", "desk"}


def _normalize_types(types: list[str]) -> str:
    cleaned = [t for t in dict.fromkeys(types) if t in VALID_LABEL_TYPES]
    if not cleaned:
        _err(400, "LABEL_TYPES_REQUIRED", "Mindestens ein Entitätstyp muss ausgewählt werden.")
    return ",".join(cleaned)


def _get_or_suggest_label(db: Session, name: str, auto_create: bool) -> Label:
    exact = db.query(Label).filter(Label.name == name).first()
    if exact:
        return exact
    if auto_create:
        label = Label(name=name)
        db.add(label)
        db.flush()
        return label
    raise ValueError("not found")


@router.get("/labels/similar", response_model=list[LabelSuggestion])
def similar_labels(name: str, db: Session = Depends(get_db)):
    """FR-24: unscharfer Textvergleich beim Anlegen — Vorschlag, kein Zwang."""
    all_labels = db.query(Label).all()
    out = []
    for l in all_labels:
        ratio = difflib.SequenceMatcher(None, name.lower(), l.name.lower()).ratio()
        if ratio >= 0.6:
            out.append(LabelSuggestion(label_id=l.id, label_name=l.name, similarity=round(ratio, 2)))
    out.sort(key=lambda s: -s.similarity)
    return out


class CreateLabelIn(BaseModel):
    name: str
    force: bool = False  # "trotzdem neu anlegen"
    applicable_types: list[str] = list(VALID_LABEL_TYPES)  # welche Entitätstypen dürfen dieses Label verwenden


@router.post("/labels", response_model=LabelCreateResult)
def create_label(payload: CreateLabelIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    existing = db.query(Label).filter(Label.name == payload.name).first()
    if existing:
        return LabelCreateResult(label_id=existing.id, label_name=existing.name, created=False, similar=[])
    similar = [] if payload.force else similar_labels(payload.name, db)
    label = Label(name=payload.name, applicable_types=_normalize_types(payload.applicable_types))
    db.add(label)
    db.commit()
    db.refresh(label)
    return LabelCreateResult(label_id=label.id, label_name=label.name, created=True, similar=similar)


class UpdateLabelIn(BaseModel):
    applicable_types: list[str]


@router.patch("/labels/{label_id}", response_model=IdOut)
def update_label(label_id: int, payload: UpdateLabelIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    """Nachträgliche Neu-Kategorisierung, z.B. wenn ein Label doch auch für Gebäude gelten soll."""
    label = db.get(Label, label_id)
    if label is None:
        _err(404, "LABEL_NOT_FOUND", "Label nicht gefunden.")
    label.applicable_types = _normalize_types(payload.applicable_types)
    db.commit()
    return IdOut(id=label.id)


class MergeLabelsIn(BaseModel):
    source_label_ids: list[int]
    target_label_id: int


@router.post("/labels/merge")
def merge_labels(payload: MergeLabelsIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    """FR-25: bestehende Duplikate zu einem kanonischen Label zusammenführen; alle Zuweisungen bleiben erhalten."""
    for source_id in payload.source_label_ids:
        if source_id == payload.target_label_id:
            continue
        for room_label in db.query(RoomLabel).filter(RoomLabel.label_id == source_id):
            if not db.query(RoomLabel).filter(RoomLabel.room_id == room_label.room_id, RoomLabel.label_id == payload.target_label_id).first():
                db.add(RoomLabel(room_id=room_label.room_id, label_id=payload.target_label_id))
        db.query(RoomLabel).filter(RoomLabel.label_id == source_id).delete()
        for desk_label in db.query(DeskLabel).filter(DeskLabel.label_id == source_id):
            if not db.query(DeskLabel).filter(DeskLabel.desk_id == desk_label.desk_id, DeskLabel.label_id == payload.target_label_id).first():
                db.add(DeskLabel(desk_id=desk_label.desk_id, label_id=payload.target_label_id))
        db.query(DeskLabel).filter(DeskLabel.label_id == source_id).delete()
        db.query(Label).filter(Label.id == source_id).delete()
    db.commit()
    return {"ok": True}


class LabelUsage(BaseModel):
    id: int
    name: str
    usage_count: int
    applicable_types: list[str]


@router.get("/labels/catalog", response_model=list[LabelUsage])
def label_catalog(user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    out = []
    for l in db.query(Label).order_by(Label.name).all():
        count = (
            db.query(RoomLabel).filter(RoomLabel.label_id == l.id).count()
            + db.query(DeskLabel).filter(DeskLabel.label_id == l.id).count()
            + db.query(PropertyLabel).filter(PropertyLabel.label_id == l.id).count()
            + db.query(BuildingLabel).filter(BuildingLabel.label_id == l.id).count()
        )
        out.append(LabelUsage(id=l.id, name=l.name, usage_count=count, applicable_types=l.applicable_types.split(",")))
    return out


# --------------------------------------------------------------------------
# Sperrungen (FR-26/27) + FM-Zwangsstorno (FR-43)
# --------------------------------------------------------------------------

class CreateLockIn(BaseModel):
    entity_type: str  # desk | room | property
    entity_id: int
    start_at: datetime
    end_at: datetime | None = None
    reason: str


@router.post("/locks", response_model=IdOut)
def create_lock(payload: CreateLockIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    lock = Lock(start_at=payload.start_at, end_at=payload.end_at, reason=payload.reason, created_by_user_id=user.id)
    db.add(lock)
    db.flush()

    affected_bookings: list[Booking] = []
    if payload.entity_type == "desk":
        db.add(DeskLock(lock_id=lock.id, desk_id=payload.entity_id))
        end_bound = payload.end_at or datetime.max
        for b in db.query(Booking).join(DeskBooking, DeskBooking.booking_id == Booking.id).filter(
            DeskBooking.desk_id == payload.entity_id, Booking.status == "confirmed",
        ):
            if b.start_at < end_bound and payload.start_at < b.end_at:
                affected_bookings.append(b)
    elif payload.entity_type == "room":
        db.add(RoomLock(lock_id=lock.id, room_id=payload.entity_id))
        end_bound = payload.end_at or datetime.max
        for b in db.query(Booking).join(RoomBooking, RoomBooking.booking_id == Booking.id).filter(
            RoomBooking.room_id == payload.entity_id, Booking.status == "confirmed",
        ):
            if b.start_at < end_bound and payload.start_at < b.end_at:
                affected_bookings.append(b)
    else:
        db.add(PropertyLock(lock_id=lock.id, property_id=payload.entity_id))

    for b in affected_bookings:
        b.status = "cancelled"
        b.cancel_kind = "lock"
        b.cancel_reason = payload.reason
        db.add(BookingAudit(booking_id=b.id, actor_user_id=user.id, action="cancelled_by_lock"))
        notify(db, b.booked_for_user_id, "foreign_cancel",
               f"Ihre Buchung wurde wegen einer Sperrung storniert (Grund: {payload.reason}).",
               related_booking_id=b.id)

    db.commit()
    db.refresh(lock)
    return IdOut(id=lock.id)


class ForceCancelIn(BaseModel):
    reason: str


@router.post("/bookings/{booking_id}/force-cancel")
def force_cancel(booking_id: int, payload: ForceCancelIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    if not payload.reason.strip():
        _err(400, "REASON_REQUIRED", "Für ein Zwangsstorno ist eine Begründung erforderlich.")
    booking = db.get(Booking, booking_id)
    if booking is None:
        _err(404, "BOOKING_NOT_FOUND", "Buchung nicht gefunden.")
    booking.status = "cancelled"
    booking.cancel_kind = "fm_force"
    booking.cancel_reason = payload.reason
    db.add(BookingAudit(booking_id=booking.id, actor_user_id=user.id, action="force_cancelled"))
    notify(db, booking.booked_for_user_id, "foreign_cancel",
           f"Ihre Buchung wurde durch Facility Management storniert (Grund: {payload.reason}).",
           related_booking_id=booking.id)
    db.commit()
    return _booking_to_out(db, booking)


# --------------------------------------------------------------------------
# Zonen (FR-44/45)
# --------------------------------------------------------------------------

class CreateZoneIn(BaseModel):
    property_id: int
    name: str


@router.post("/zones", response_model=IdOut)
def create_zone(payload: CreateZoneIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    if db.get(Property, payload.property_id) is None:
        _err(404, "PROPERTY_NOT_FOUND", "Liegenschaft nicht gefunden.")
    existing = db.query(Zone).filter(Zone.property_id == payload.property_id, Zone.name == payload.name.strip()).first()
    if existing:
        return IdOut(id=existing.id)
    z = Zone(property_id=payload.property_id, name=payload.name)
    db.add(z)
    db.commit()
    db.refresh(z)
    return IdOut(id=z.id)


class ZoneDepartmentIn(BaseModel):
    department_id: int
    include_descendants: bool = True


@router.post("/zones/{zone_id}/departments", response_model=IdOut)
def add_zone_department(zone_id: int, payload: ZoneDepartmentIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    if db.get(Zone, zone_id) is None:
        _err(404, "ZONE_NOT_FOUND", "Zone nicht gefunden.")
    if db.get(Department, payload.department_id) is None:
        _err(404, "DEPARTMENT_NOT_FOUND", "Organisationseinheit nicht gefunden.")
    existing = db.query(ZoneDepartment).filter(ZoneDepartment.zone_id == zone_id, ZoneDepartment.department_id == payload.department_id).first()
    if existing:
        existing.include_descendants = payload.include_descendants
    else:
        db.add(ZoneDepartment(zone_id=zone_id, department_id=payload.department_id, include_descendants=payload.include_descendants))
    db.commit()
    return IdOut(id=zone_id)


class ZoneDeskIn(BaseModel):
    desk_ids: list[int] = []
    room_ids: list[int] = []  # Kaskade: alle Desks des Raums (nur desk_area sinnvoll)
    building_ids: list[int] = []  # Kaskade: alle Desks aller Räume aller Etagen des Gebäudes


def _desk_ids_in_rooms(db: Session, room_ids: list[int]) -> list[int]:
    if not room_ids:
        return []
    return [d.id for d in db.query(Desk).filter(Desk.room_id.in_(room_ids)).all()]


def _desk_ids_in_buildings(db: Session, building_ids: list[int]) -> list[int]:
    if not building_ids:
        return []
    return [
        d.id for d in db.query(Desk).join(Room).join(Floor)
        .filter(Floor.building_id.in_(building_ids)).all()
    ]


@router.post("/zones/{zone_id}/desks", response_model=IdOut)
def assign_zone_desks(zone_id: int, payload: ZoneDeskIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    """Desks können einzeln oder kaskadierend über einen ganzen Raum bzw. ein ganzes Gebäude
    zugeordnet werden — ein Desk gehört immer höchstens einer Zone an (FR-45); ist es bereits
    einer anderen Zone zugeordnet, wird es dorthin verschoben statt übersprungen."""
    zone = db.get(Zone, zone_id)
    if zone is None:
        _err(404, "ZONE_NOT_FOUND", "Zone nicht gefunden.")
    if not db.query(ZoneDepartment).filter(ZoneDepartment.zone_id == zone_id).first():
        _err(400, "ZONE_DEPARTMENT_REQUIRED", "Ordnen Sie der Zone zuerst mindestens eine Organisationseinheit zu.")

    desk_ids = set(payload.desk_ids) | set(_desk_ids_in_rooms(db, payload.room_ids)) | set(_desk_ids_in_buildings(db, payload.building_ids))
    if not desk_ids:
        _err(400, "NO_DESKS_SELECTED", "Die Auswahl enthält keine Arbeitsplätze.")
    valid_desk_ids = {
        d.id for d in db.query(Desk).join(Room).join(Floor).join(Building)
        .filter(Desk.id.in_(desk_ids), Building.property_id == zone.property_id).all()
    }
    if valid_desk_ids != desk_ids:
        _err(400, "ZONE_RESOURCE_OUTSIDE_PROPERTY", "Alle zugewiesenen Desks müssen zur Liegenschaft der Zone gehören.")
    for desk_id in valid_desk_ids:
        existing = db.query(ZoneDesk).filter(ZoneDesk.desk_id == desk_id).first()
        if existing:
            if existing.zone_id == zone_id:
                continue
            existing.zone_id = zone_id
        else:
            db.add(ZoneDesk(zone_id=zone_id, desk_id=desk_id))
    db.commit()
    return IdOut(id=zone_id)


@router.delete("/zones/{zone_id}/desks/{desk_id}")
def remove_zone_desk(zone_id: int, desk_id: int, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    db.query(ZoneDesk).filter(ZoneDesk.zone_id == zone_id, ZoneDesk.desk_id == desk_id).delete()
    db.commit()
    return {"ok": True}


@router.delete("/zones/{zone_id}")
def dissolve_zone(zone_id: int, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    """FR-45: Auflösen -> sofortige Rückkehr zum FR-5-Standardverhalten, keine Buchungsstornierung."""
    db.query(ZoneDesk).filter(ZoneDesk.zone_id == zone_id).delete()
    db.query(ZoneDepartment).filter(ZoneDepartment.zone_id == zone_id).delete()
    db.query(Zone).filter(Zone.id == zone_id).delete()
    db.commit()
    return {"ok": True}


class ZoneOut(BaseModel):
    id: int
    name: str
    property_id: int
    departments: list[str]
    desk_count: int


@router.get("/zones", response_model=list[ZoneOut])
def list_zones(property_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Zone)
    if property_id:
        q = q.filter(Zone.property_id == property_id)
    out = []
    for z in q.all():
        depts = [db.get(Department, zd.department_id).name for zd in db.query(ZoneDepartment).filter(ZoneDepartment.zone_id == z.id)]
        count = db.query(ZoneDesk).filter(ZoneDesk.zone_id == z.id).count()
        out.append(ZoneOut(id=z.id, name=z.name, property_id=z.property_id, departments=depts, desk_count=count))
    return out


# --------------------------------------------------------------------------
# Bestuhlungsoptionen (FR-53/55)
# --------------------------------------------------------------------------

class SeatingOptionIn(BaseModel):
    name: str
    is_standard: bool = False
    changeover_days: int = 0


@router.post("/rooms/{room_id}/seating-options", response_model=IdOut)
def add_seating_option(room_id: int, payload: SeatingOptionIn, user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    so = SeatingOption(room_id=room_id, name=payload.name, is_standard=payload.is_standard, changeover_days=payload.changeover_days)
    db.add(so)
    db.commit()
    db.refresh(so)
    return IdOut(id=so.id)


class SeatingOptionOut(BaseModel):
    id: int
    name: str
    is_standard: bool
    changeover_days: int


@router.get("/rooms/{room_id}/seating-options", response_model=list[SeatingOptionOut])
def list_seating_options(room_id: int, db: Session = Depends(get_db)):
    rows = db.query(SeatingOption).filter(SeatingOption.room_id == room_id).all()
    return [SeatingOptionOut(id=r.id, name=r.name, is_standard=r.is_standard, changeover_days=r.changeover_days) for r in rows]


# --------------------------------------------------------------------------
# Defektmeldungen (FR-28)
# --------------------------------------------------------------------------

class CreateDefectIn(BaseModel):
    entity_kind: str  # desk | room
    desk_id: int | None = None
    room_id: int | None = None
    description: str


@router.post("/defects", response_model=IdOut)
def report_defect(payload: CreateDefectIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = DefectReport(entity_kind=payload.entity_kind, desk_id=payload.desk_id, room_id=payload.room_id,
                      description=payload.description, reported_by_user_id=user.id)
    db.add(d)
    db.commit()
    db.refresh(d)
    return IdOut(id=d.id)


class DefectOut(BaseModel):
    id: int
    entity_kind: str
    desk_id: int | None
    room_id: int | None
    description: str
    status: str
    reported_by: str
    created_at: datetime


@router.get("/defects", response_model=list[DefectOut])
def list_defects(user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    rows = db.query(DefectReport).order_by(DefectReport.created_at.desc()).all()
    return [
        DefectOut(id=r.id, entity_kind=r.entity_kind, desk_id=r.desk_id, room_id=r.room_id,
                  description=r.description, status=r.status, reported_by=db.get(User, r.reported_by_user_id).display_name,
                  created_at=r.created_at)
        for r in rows
    ]


# --------------------------------------------------------------------------
# Auslastungsauswertung (FR-50)
# --------------------------------------------------------------------------

MIN_GROUP_SIZE = 3  # FR-50 assumption: Mindestgruppengröße gegen Re-Identifikation


class OccupancyOut(BaseModel):
    property_id: int
    property_name: str
    total_desks: int
    booked_today: int | str  # int, or "Zu wenige Buchungen für Auswertung"
    occupancy_pct: int | str


@router.get("/occupancy", response_model=list[OccupancyOut])
def occupancy(user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start.replace(hour=23, minute=59, second=59)
    out = []
    for p in db.query(Property).all():
        desk_ids = [d.id for d in db.query(Desk).join(Room).join(Floor).join(Building).filter(Building.property_id == p.id)]
        total = len(desk_ids)
        booked = 0
        if desk_ids:
            booked = (
                db.query(DeskBooking)
                .join(Booking, Booking.id == DeskBooking.booking_id)
                .filter(DeskBooking.desk_id.in_(desk_ids), Booking.status == "confirmed",
                        Booking.start_at <= today_end, Booking.end_at >= today_start)
                .count()
            )
        if booked < MIN_GROUP_SIZE:
            out.append(OccupancyOut(property_id=p.id, property_name=p.name, total_desks=total,
                                     booked_today="Zu wenige Buchungen für Auswertung", occupancy_pct="—"))
        else:
            out.append(OccupancyOut(property_id=p.id, property_name=p.name, total_desks=total, booked_today=booked,
                                     occupancy_pct=round((booked / total) * 100) if total else 0))
    return out


# --------------------------------------------------------------------------
# Grundriss-Upload (FR-51) + Referenzdaten
# --------------------------------------------------------------------------

@router.post("/floors/{floor_id}/floorplan")
async def upload_floorplan(floor_id: int, file: UploadFile = File(...), user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    floor = db.get(Floor, floor_id)
    if floor is None:
        _err(404, "FLOOR_NOT_FOUND", "Etage nicht gefunden.")
    FLOORPLAN_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "plan").suffix or ".png"
    dest = FLOORPLAN_UPLOAD_DIR / f"uploaded-floor-{floor_id}{suffix}"
    content = await file.read()
    dest.write_bytes(content)
    floor.floorplan_image_path = f"/static/floorplans/{dest.name}"
    db.commit()
    return {"floorplan_image_path": floor.floorplan_image_path}


class DepartmentOut(BaseModel):
    id: int
    code: str
    name: str
    parent_id: int | None


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    """Flache Liste mit parent_id — das Frontend baut daraus den Org-Baum (BAMF-Hierarchie)."""
    return [DepartmentOut(id=d.id, code=d.code, name=d.name, parent_id=d.parent_id) for d in db.query(Department).order_by(Department.code).all()]


class RoleOut(BaseModel):
    id: int
    code: str
    name: str


@router.get("/roles", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db)):
    return [RoleOut(id=r.id, code=r.code, name=r.name) for r in db.query(Role).order_by(Role.name).all()]


# --------------------------------------------------------------------------
# Datenübernahme (FR-51/52) — bewusst knapp gehalten, kein eigener Screen
# --------------------------------------------------------------------------

class ImportResult(BaseModel):
    rows_read: int
    rows_imported: int
    errors: list[str]


@router.post("/import/room-master-data", response_model=ImportResult)
async def import_room_master_data(floor_id: int, file: UploadFile = File(...), user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    """FR-51: CSV mit Spalten room_number,name,room_type,capacity -> legt Räume unter der Etage an."""
    floor = db.get(Floor, floor_id)
    if floor is None:
        _err(404, "FLOOR_NOT_FOUND", "Etage nicht gefunden.")
    content = (await file.read()).decode("utf-8", errors="ignore")
    lines = [l for l in content.splitlines() if l.strip()]
    errors: list[str] = []
    imported = 0
    for line in lines[1:] if lines and "room_number" in lines[0] else lines:
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 3:
            errors.append(f"Zeile übersprungen (zu wenige Spalten): {line}")
            continue
        room_number, name, room_type = parts[0], parts[1], parts[2]
        capacity = int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else None
        db.add(Room(floor_id=floor_id, room_number=room_number, name=name, room_type=room_type, capacity=capacity))
        imported += 1
    db.commit()
    return ImportResult(rows_read=len(lines), rows_imported=imported, errors=errors)


@router.post("/import/legacy-bookings", response_model=ImportResult)
async def import_legacy_bookings(file: UploadFile = File(...), user: User = Depends(require_roles("fm")), db: Session = Depends(get_db)):
    """FR-52: nur zukünftige Meetingraum-Buchungen aus dem Vorgängertool. CSV: room_id,user_idm_code,start_at,end_at."""
    content = (await file.read()).decode("utf-8", errors="ignore")
    lines = [l for l in content.splitlines() if l.strip()]
    errors: list[str] = []
    imported = 0
    now = datetime.utcnow()
    for line in lines[1:] if lines and "room_id" in lines[0] else lines:
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 4:
            errors.append(f"Zeile übersprungen: {line}")
            continue
        try:
            room_id = int(parts[0])
            person = db.query(User).filter(User.idm_code == parts[1]).first()
            start_at = datetime.fromisoformat(parts[2])
            end_at = datetime.fromisoformat(parts[3])
        except (ValueError, IndexError):
            errors.append(f"Ungültige Zeile: {line}")
            continue
        if person is None or start_at < now:
            errors.append(f"Übersprungen (Person unbekannt oder in der Vergangenheit): {line}")
            continue
        booking = Booking(kind="room", status="confirmed", booked_for_user_id=person.id,
                           booked_by_user_id=user.id, start_at=start_at, end_at=end_at)
        db.add(booking)
        db.flush()
        db.add(RoomBooking(booking_id=booking.id, room_id=room_id))
        imported += 1
    db.commit()
    return ImportResult(rows_read=len(lines), rows_imported=imported, errors=errors)
