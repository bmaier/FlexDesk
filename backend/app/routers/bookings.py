from __future__ import annotations

from datetime import date as date_type
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_user_roles
from app.db import get_db
from app.models.bookings import (
    Approval,
    Booking,
    BookingAudit,
    BookingSeries,
    CheckIn,
    DeskBooking,
    RoomBooking,
)
from app.models.reference import Delegation, Department, Label, User
from app.models.structure import (
    Building,
    Desk,
    DeskLabel,
    Floor,
    Property,
    Room,
    RoomDepartment,
    RoomLabel,
    SeatingOption,
    Zone,
    ZoneDepartment,
    ZoneDesk,
)
from app.services.availability import (
    desk_conflicts,
    desk_is_locked,
    preference_score,
    room_conflicts,
    room_is_locked,
    user_overlapping_bookings,
)
from app.services.notifications import notify
from app.services.org_hierarchy import is_authorized
from app.services.scheduling import desk_day_part_range, expand_series_dates

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


def _err(status: int, code: str, message: str, **extra):
    raise HTTPException(status_code=status, detail={"code": code, "message": message, **extra})


def resolve_target_user(db: Session, actor: User, for_user_id: int | None) -> User:
    if for_user_id is None or for_user_id == actor.id:
        return actor
    delegation = (
        db.query(Delegation)
        .filter(Delegation.manager_user_id == actor.id, Delegation.employee_user_id == for_user_id)
        .first()
    )
    if delegation is None:
        _err(403, "DELEGATION_MISSING", "Für diese Person liegt keine Vertretungsberechtigung vor.")
    target = db.get(User, for_user_id)
    if target is None:
        _err(404, "USER_NOT_FOUND", "Nutzer nicht gefunden.")
    return target


def property_of_desk(db: Session, desk: Desk) -> Property:
    room = db.get(Room, desk.room_id)
    floor = db.get(Floor, room.floor_id)
    building = db.get(Building, floor.building_id)
    return db.get(Property, building.property_id)


def property_of_room(db: Session, room: Room) -> Property:
    floor = db.get(Floor, room.floor_id)
    building = db.get(Building, floor.building_id)
    return db.get(Property, building.property_id)


def maybe_create_checkin(db: Session, booking: Booking, prop: Property, resource_checkin_required: bool = False) -> None:
    """Check-in ist ausschließlich abhängig davon, ob der konkrete Raum/Desk es verlangt
    (bei dessen Anlage/Bearbeitung konfiguriert) — die Liegenschaft liefert nur das
    Zeitfenster (checkin_window_minutes) und einen Vorschlagswert beim Anlegen neuer Räume/Desks."""
    if resource_checkin_required:
        deadline = booking.start_at + timedelta(minutes=prop.checkin_window_minutes)
        db.add(CheckIn(booking_id=booking.id, deadline_at=deadline))


class DoubleBookingInfo(BaseModel):
    booking_id: int
    resource_label: str
    start_at: datetime
    end_at: datetime


def _check_double_booking(db: Session, target_user_id: int, start_at: datetime, end_at: datetime,
                           override: bool, reason: str | None, kind: str, exclude_booking_id: int | None = None) -> None:
    """Überlappende Eigenbuchung DERSELBEN Art (Desk<->Desk bzw. Raum<->Raum) auf einer ANDEREN
    Ressource — Warnung statt Hard-Block, aber nur mit Begründung fortsetzbar. Ein Desk parallel zu
    einem Meetingraum-Termin ist der Normalfall (Arbeitsplatz + Teilnahme an einer Besprechung) und
    löst bewusst KEINE Warnung aus."""
    others = user_overlapping_bookings(db, target_user_id, start_at, end_at, kind=kind, exclude_booking_id=exclude_booking_id)
    if not others:
        return
    if override:
        if not reason or not reason.strip():
            _err(400, "DOUBLE_BOOKING_REASON_REQUIRED", "Für eine Doppelbuchung ist eine Begründung erforderlich.")
        return
    other = others[0]
    other_out = _booking_to_out(db, other)
    _err(409, "DOUBLE_BOOKING_WARNING",
         "Sie haben in diesem Zeitraum bereits eine andere Buchung.",
         other_booking_id=other.id, other_resource_label=other_out.resource_label,
         other_start_at=other.start_at.isoformat(), other_end_at=other.end_at.isoformat())


# --------------------------------------------------------------------------
# Schnellbuchung (FR-1) + Präferenz-Ranking (FR-3)
# --------------------------------------------------------------------------

class QuickDeskOut(BaseModel):
    desk_id: int
    desk_number: str
    room_name: str
    property_name: str
    score: int
    labels: list[str]


class QuickSuggestionOut(BaseModel):
    home_desk: QuickDeskOut | None
    home_desk_available: bool
    recommendations: list[QuickDeskOut]


@router.get("/quick-suggestion", response_model=QuickSuggestionOut)
def quick_suggestion(target_date: date_type | None = None, for_user_id: int | None = None,
                      user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Schnellbuchung-Hero: gewohnter Platz + präferenzsortierte Alternativen (UJ-1)."""
    target = resolve_target_user(db, user, for_user_id)
    the_date = target_date or datetime.utcnow().date()
    home_desk_out = None
    home_available = False
    if target.home_desk_id:
        desk = db.get(Desk, target.home_desk_id)
        prop = property_of_desk(db, desk)
        start_at, end_at = desk_day_part_range(the_date, "full", prop.day_part_switch_hour)
        conflicts = desk_conflicts(db, desk.id, start_at, end_at)
        locked = desk_is_locked(db, desk.id, start_at, end_at)
        home_available = not conflicts and not locked
        room = db.get(Room, desk.room_id)
        labels = [db.get(Label, dl.label_id).name
                  for dl in db.query(DeskLabel).filter(DeskLabel.desk_id == desk.id)]
        home_desk_out = QuickDeskOut(desk_id=desk.id, desk_number=desk.desk_number, room_name=room.name,
                                     property_name=prop.name, score=preference_score(db, target.id, desk.id), labels=labels)

    recs: list[QuickDeskOut] = []
    if target.home_property_id:
        desks = (
            db.query(Desk).join(Room).join(Floor).join(Building)
            .filter(Building.property_id == target.home_property_id, Room.room_type == "desk_area")
            .all()
        )
        for d in desks:
            if target.home_desk_id and d.id == target.home_desk_id:
                continue
            prop = property_of_desk(db, d)
            start_at, end_at = desk_day_part_range(the_date, "full", prop.day_part_switch_hour)
            if desk_conflicts(db, d.id, start_at, end_at) or desk_is_locked(db, d.id, start_at, end_at):
                continue
            room = db.get(Room, d.room_id)
            labels = [db.get(Label, dl.label_id).name for dl in db.query(DeskLabel).filter(DeskLabel.desk_id == d.id)]
            recs.append(QuickDeskOut(desk_id=d.id, desk_number=d.desk_number, room_name=room.name,
                                      property_name=prop.name, score=preference_score(db, target.id, d.id), labels=labels))
        recs.sort(key=lambda r: -r.score)
        recs = recs[:8]

    return QuickSuggestionOut(home_desk=home_desk_out, home_desk_available=home_available, recommendations=recs)


# --------------------------------------------------------------------------
# Gezielte Buchung / Floorplan-Verfügbarkeit
# --------------------------------------------------------------------------

class FloorDeskStatus(BaseModel):
    desk_id: int
    desk_number: str
    room_id: int
    room_name: str
    pos_x: float | None
    pos_y: float | None
    status: str  # available | occupied | locked | zone_restricted | top_match | mine
    zone_name: str | None
    match_score: int
    labels: list[str]
    own_booking_id: int | None = None


@router.get("/floors/{floor_id}/desk-status", response_model=list[FloorDeskStatus])
def floor_desk_status(floor_id: int, target_date: date_type | None = None, day_part: str = "full",
                       for_user_id: int | None = None,
                       user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Desk-Zustände für den SVG-Grundriss (Gezielte Buchung), inkl. Zonen/Präferenzen (FR-2/3/44)."""
    target = resolve_target_user(db, user, for_user_id)
    the_date = target_date or datetime.utcnow().date()
    floor = db.get(Floor, floor_id)
    if floor is None:
        _err(404, "FLOOR_NOT_FOUND", "Etage nicht gefunden.")
    building = db.get(Building, floor.building_id)
    prop = db.get(Property, building.property_id)
    start_at, end_at = desk_day_part_range(the_date, day_part, prop.day_part_switch_hour)

    out: list[FloorDeskStatus] = []
    for room in db.query(Room).filter(Room.floor_id == floor_id, Room.room_type == "desk_area"):
        room_depts = db.query(RoomDepartment).filter(RoomDepartment.room_id == room.id).all()
        for desk in db.query(Desk).filter(Desk.room_id == room.id):
            score = preference_score(db, target.id, desk.id)
            labels = [db.get(Label, dl.label_id).name for dl in db.query(DeskLabel).filter(DeskLabel.desk_id == desk.id)]
            zone_link = db.query(ZoneDesk).filter(ZoneDesk.desk_id == desk.id).first()
            zone_name = None
            if zone_link:
                zone = db.get(Zone, zone_link.zone_id)
                zone_name = zone.name
                zone_depts = db.query(ZoneDepartment).filter(ZoneDepartment.zone_id == zone.id).all()
                authorized = any(is_authorized(db, target.department_id, zd.department_id, zd.include_descendants) for zd in zone_depts)
                if not authorized:
                    out.append(FloorDeskStatus(desk_id=desk.id, desk_number=desk.desk_number, room_id=room.id,
                                                room_name=room.name, pos_x=desk.pos_x, pos_y=desk.pos_y,
                                                status="zone_restricted", zone_name=zone_name, match_score=score, labels=labels))
                    continue
            if room_depts and not any(is_authorized(db, target.department_id, rd.department_id, rd.include_descendants) for rd in room_depts):
                dept_names = ", ".join(db.get(Department, rd.department_id).name for rd in room_depts)
                out.append(FloorDeskStatus(desk_id=desk.id, desk_number=desk.desk_number, room_id=room.id,
                                            room_name=room.name, pos_x=desk.pos_x, pos_y=desk.pos_y,
                                            status="zone_restricted", zone_name=dept_names, match_score=score, labels=labels))
                continue
            own_booking_id = None
            if desk_is_locked(db, desk.id, start_at, end_at):
                status = "locked"
            else:
                conflicts = desk_conflicts(db, desk.id, start_at, end_at)
                own = next((c for c in conflicts if c.booked_for_user_id == target.id), None)
                if own:
                    status = "mine"
                    own_booking_id = own.id
                elif conflicts:
                    status = "occupied"
                elif score > 0:
                    status = "top_match"
                else:
                    status = "available"
            out.append(FloorDeskStatus(desk_id=desk.id, desk_number=desk.desk_number, room_id=room.id,
                                        room_name=room.name, pos_x=desk.pos_x, pos_y=desk.pos_y,
                                        status=status, zone_name=zone_name, match_score=score, labels=labels,
                                        own_booking_id=own_booking_id))
    return out


# --------------------------------------------------------------------------
# Desk-Buchung (Schnell + Gezielt)
# --------------------------------------------------------------------------

class CreateDeskBookingIn(BaseModel):
    desk_id: int
    date: date_type
    day_part: str = "full"  # full | am | pm
    for_user_id: int | None = None
    override_double_booking: bool = False
    double_booking_reason: str | None = None


class BookingOut(BaseModel):
    id: int
    kind: str
    status: str
    start_at: datetime
    end_at: datetime
    booked_for_user_id: int
    booked_for_name: str
    booked_by_user_id: int
    booked_by_name: str
    resource_label: str
    property_name: str | None = None
    property_id: int | None = None
    floor_id: int | None = None
    room_id: int | None = None
    desk_id: int | None = None
    labels: list[str] = []
    series_id: int | None = None
    cancel_reason: str | None = None
    remark: str | None = None
    double_booking_reason: str | None = None
    checkin_status: str | None = None
    checkin_deadline: datetime | None = None
    has_catering: bool = False
    catering_notes: str | None = None
    cost_center: str | None = None
    billing_department_id: int | None = None
    billing_department_name: str | None = None


def _booking_to_out(db: Session, b: Booking) -> BookingOut:
    resource_label = ""
    property_name = None
    property_id = None
    floor_id = None
    room_id = None
    desk_id = None
    labels: list[str] = []
    if b.kind == "desk":
        db_link = db.query(DeskBooking).filter(DeskBooking.booking_id == b.id).first()
        desk = db.get(Desk, db_link.desk_id)
        room = db.get(Room, desk.room_id)
        resource_label = f"{desk.desk_number} · {room.name}"
        prop = property_of_desk(db, desk)
        property_name = prop.name
        property_id = prop.id
        floor_id = room.floor_id
        room_id = room.id
        desk_id = desk.id
        labels = [db.get(Label, dl.label_id).name for dl in db.query(DeskLabel).filter(DeskLabel.desk_id == desk.id)]
    else:
        r_link = db.query(RoomBooking).filter(RoomBooking.booking_id == b.id).first()
        room = db.get(Room, r_link.room_id)
        resource_label = room.name
        prop = property_of_room(db, room)
        property_name = prop.name
        property_id = prop.id
        floor_id = room.floor_id
        room_id = room.id
        labels = [db.get(Label, rl.label_id).name for rl in db.query(RoomLabel).filter(RoomLabel.room_id == room.id)]
    checkin = db.query(CheckIn).filter(CheckIn.booking_id == b.id).first()
    billing_dept_name = None
    if b.billing_department_id:
        dept = db.get(Department, b.billing_department_id)
        billing_dept_name = dept.name if dept else None
    return BookingOut(
        id=b.id, kind=b.kind, status=b.status, start_at=b.start_at, end_at=b.end_at,
        booked_for_user_id=b.booked_for_user_id, booked_for_name=b.booked_for.display_name,
        booked_by_user_id=b.booked_by_user_id, booked_by_name=b.booked_by.display_name,
        resource_label=resource_label, property_name=property_name, property_id=property_id,
        floor_id=floor_id, room_id=room_id, desk_id=desk_id, labels=labels, series_id=b.series_id,
        cancel_reason=b.cancel_reason,
        remark=b.remark, checkin_status=checkin.status if checkin else None,
        checkin_deadline=checkin.deadline_at if checkin else None, double_booking_reason=b.double_booking_reason,
        has_catering=b.has_catering, catering_notes=b.catering_notes,
        cost_center=b.cost_center, billing_department_id=b.billing_department_id,
        billing_department_name=billing_dept_name,
    )


@router.post("/desks", response_model=BookingOut)
def create_desk_booking(payload: CreateDeskBookingIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    target = resolve_target_user(db, user, payload.for_user_id)
    desk = db.get(Desk, payload.desk_id)
    if desk is None:
        _err(404, "DESK_NOT_FOUND", "Arbeitsplatz nicht gefunden.")
    room = db.get(Room, desk.room_id)
    prop = property_of_desk(db, desk)

    zone_link = db.query(ZoneDesk).filter(ZoneDesk.desk_id == desk.id).first()
    if zone_link:
        zone_depts = db.query(ZoneDepartment).filter(ZoneDepartment.zone_id == zone_link.zone_id).all()
        if not any(is_authorized(db, target.department_id, zd.department_id, zd.include_descendants) for zd in zone_depts):
            _err(403, "ZONE_RESTRICTED", "Dieser Arbeitsplatz ist einem Referats-Kontingent vorbehalten.")

    room_depts = db.query(RoomDepartment).filter(RoomDepartment.room_id == room.id).all()
    if room_depts and "fm" not in get_user_roles(user, db):
        if not any(is_authorized(db, target.department_id, rd.department_id, rd.include_descendants) for rd in room_depts):
            _err(403, "ZONE_RESTRICTED", "Dieser Arbeitsplatz ist bestimmten Organisationseinheiten vorbehalten.")

    start_at, end_at = desk_day_part_range(payload.date, payload.day_part, prop.day_part_switch_hour)

    if desk_is_locked(db, desk.id, start_at, end_at):
        _err(409, "DESK_LOCKED", "Dieser Arbeitsplatz ist für den gewählten Zeitraum gesperrt.")
    conflicts = desk_conflicts(db, desk.id, start_at, end_at)
    if conflicts:
        alt = _suggest_alternative_desk(db, prop.id, target.id, payload.date, payload.day_part, exclude_desk_id=desk.id)
        _err(409, "DESK_CONFLICT", "Dieser Arbeitsplatz ist im gewählten Zeitraum bereits belegt.",
             alternative_desk_id=alt.id if alt else None,
             alternative_desk_number=alt.desk_number if alt else None)

    _check_double_booking(db, target.id, start_at, end_at, payload.override_double_booking, payload.double_booking_reason, kind="desk")

    approval_needed = bool(desk.approval_required or room.approval_required)
    booking = Booking(kind="desk", status="pending_approval" if approval_needed else "confirmed",
                       booked_for_user_id=target.id, booked_by_user_id=user.id, start_at=start_at, end_at=end_at,
                       double_booking_reason=payload.double_booking_reason if payload.override_double_booking else None)
    db.add(booking)
    db.flush()
    db.add(DeskBooking(booking_id=booking.id, desk_id=desk.id, day_part=payload.day_part))
    db.add(BookingAudit(booking_id=booking.id, actor_user_id=user.id, action="created"))
    maybe_create_checkin(db, booking, prop, resource_checkin_required=bool(desk.checkin_required or room.checkin_required))
    db.commit()
    db.refresh(booking)
    return _booking_to_out(db, booking)


def _suggest_alternative_desk(db: Session, property_id: int, user_id: int, the_date: date_type, day_part: str, exclude_desk_id: int) -> Desk | None:
    prop = db.get(Property, property_id)
    start_at, end_at = desk_day_part_range(the_date, day_part, prop.day_part_switch_hour)
    candidates = (
        db.query(Desk).join(Room).join(Floor).join(Building)
        .filter(Building.property_id == property_id, Room.room_type == "desk_area", Desk.id != exclude_desk_id)
        .all()
    )
    best = None
    best_score = -1
    for d in candidates:
        if desk_conflicts(db, d.id, start_at, end_at) or desk_is_locked(db, d.id, start_at, end_at):
            continue
        zone_link = db.query(ZoneDesk).filter(ZoneDesk.desk_id == d.id).first()
        user = db.get(User, user_id)
        if zone_link:
            zone_depts = db.query(ZoneDepartment).filter(ZoneDepartment.zone_id == zone_link.zone_id).all()
            if not any(is_authorized(db, user.department_id, zd.department_id, zd.include_descendants) for zd in zone_depts):
                continue
        room_depts = db.query(RoomDepartment).filter(RoomDepartment.room_id == d.room_id).all()
        if room_depts and not any(is_authorized(db, user.department_id, rd.department_id, rd.include_descendants) for rd in room_depts):
            continue
        score = preference_score(db, user_id, d.id)
        if score > best_score:
            best_score = score
            best = d
    return best


# --------------------------------------------------------------------------
# Meetingraum-Buchung
# --------------------------------------------------------------------------

class CreateRoomBookingIn(BaseModel):
    room_id: int
    start_at: datetime
    end_at: datetime
    seating_option_id: int | None = None
    remark: str | None = None
    for_user_id: int | None = None
    override_double_booking: bool = False
    double_booking_reason: str | None = None
    has_catering: bool = False
    catering_notes: str | None = None
    cost_center: str | None = None
    billing_department_id: int | None = None
    cost_center_warning_acknowledged: bool = False


@router.post("/rooms", response_model=BookingOut)
def create_room_booking(payload: CreateRoomBookingIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    target = resolve_target_user(db, user, payload.for_user_id)
    room = db.get(Room, payload.room_id)
    if room is None or room.room_type != "meeting":
        _err(404, "ROOM_NOT_FOUND", "Meetingraum nicht gefunden.")

    actor_roles = get_user_roles(user, db)
    if room.restricted_role_code and "fm" not in actor_roles:
        if room.restricted_role_code not in get_user_roles(target, db) and room.restricted_role_code not in actor_roles:
            _err(403, "NOT_AUTHORIZED_ROOM", "Dieser Raum ist einer bestimmten Rolle/Einheit vorbehalten.")

    room_depts = db.query(RoomDepartment).filter(RoomDepartment.room_id == room.id).all()
    if room_depts and "fm" not in actor_roles:
        if not any(is_authorized(db, target.department_id, rd.department_id, rd.include_descendants) for rd in room_depts):
            _err(403, "NOT_AUTHORIZED_ORG_UNIT", "Dieser Raum ist bestimmten Organisationseinheiten vorbehalten.")

    if room_is_locked(db, room.id, payload.start_at, payload.end_at):
        _err(409, "ROOM_LOCKED", "Dieser Raum ist für den gewählten Zeitraum gesperrt.")
    if room_conflicts(db, room.id, payload.start_at, payload.end_at):
        _err(409, "ROOM_CONFLICT", "Dieser Slot ist bereits belegt oder angefragt.")

    _check_double_booking(db, target.id, payload.start_at, payload.end_at, payload.override_double_booking, payload.double_booking_reason, kind="room")

    booking_cost_center = None
    booking_billing_dept_id = None
    if payload.has_catering:
        target_dept_id = target.department_id
        chosen_dept_id = payload.billing_department_id or target_dept_id
        booking_billing_dept_id = chosen_dept_id

        # Fremde Organisationseinheit prüfen
        is_foreign = chosen_dept_id is not None and target_dept_id is not None and chosen_dept_id != target_dept_id
        if is_foreign and not payload.cost_center_warning_acknowledged:
            _err(400, "FOREIGN_COST_CENTER_NOT_ACKNOWLEDGED",
                 "Für die Abrechnung über eine abweichende Organisationseinheit/Kostenstelle ist eine Bestätigung der vorliegenden Genehmigung erforderlich.")

        if payload.cost_center and payload.cost_center.strip():
            booking_cost_center = payload.cost_center.strip()
        elif chosen_dept_id:
            dept = db.get(Department, chosen_dept_id)
            booking_cost_center = dept.cost_center if dept else "KST-1000"
        else:
            booking_cost_center = target.cost_center or (target.department.cost_center if target.department else "KST-1000")

    changeover_bookings: list[tuple[datetime, datetime]] = []
    if payload.seating_option_id:
        seating = db.get(SeatingOption, payload.seating_option_id)
        if seating and not seating.is_standard and seating.changeover_days > 0:
            for i in range(1, seating.changeover_days + 1):
                day_start = (payload.start_at - timedelta(days=i)).replace(hour=8, minute=0, second=0, microsecond=0)
                day_end = day_start.replace(hour=18)
                if room_conflicts(db, room.id, day_start, day_end) or room_is_locked(db, room.id, day_start, day_end):
                    _err(409, "CHANGEOVER_CONFLICT",
                         "Für die gewählte Bestuhlung wird ein Umbautag benötigt, der bereits belegt ist.")
                changeover_bookings.append((day_start, day_end))

    approval_needed = room.approval_required
    booking = Booking(
        kind="room",
        status="pending_approval" if approval_needed else "confirmed",
        booked_for_user_id=target.id,
        booked_by_user_id=user.id,
        start_at=payload.start_at,
        end_at=payload.end_at,
        seating_option_id=payload.seating_option_id,
        remark=payload.remark,
        double_booking_reason=payload.double_booking_reason if payload.override_double_booking else None,
        has_catering=payload.has_catering,
        catering_notes=payload.catering_notes if payload.has_catering else None,
        cost_center=booking_cost_center,
        billing_department_id=booking_billing_dept_id,
        cost_center_warning_acknowledged=payload.cost_center_warning_acknowledged,
    )
    db.add(booking)
    db.flush()
    db.add(RoomBooking(booking_id=booking.id, room_id=room.id))
    db.add(BookingAudit(booking_id=booking.id, actor_user_id=user.id, action="created"))
    prop = property_of_room(db, room)
    maybe_create_checkin(db, booking, prop, resource_checkin_required=room.checkin_required)

    for day_start, day_end in changeover_bookings:
        changeover_booking = Booking(kind="room", status=booking.status, booked_for_user_id=target.id,
                                      booked_by_user_id=user.id, start_at=day_start, end_at=day_end,
                                      is_changeover_slot=True, remark="Umbautag")
        db.add(changeover_booking)
        db.flush()
        db.add(RoomBooking(booking_id=changeover_booking.id, room_id=room.id))

    db.commit()
    db.refresh(booking)
    return _booking_to_out(db, booking)


# --------------------------------------------------------------------------
# Serienbuchung (FR-9/10)
# --------------------------------------------------------------------------

class SeriesPreviewIn(BaseModel):
    kind: str  # desk | room
    resource_id: int
    weekdays: list[int]
    interval: str = "weekly"
    start_date: date_type
    end_date: date_type
    day_part: str = "full"
    for_user_id: int | None = None


class SeriesOccurrencePreview(BaseModel):
    date: date_type
    resource_id: int
    resource_label: str
    labels: list[str]
    available: bool
    conflict_reason: str | None = None


class SeriesPreviewOut(BaseModel):
    occurrences: list[SeriesOccurrencePreview]


def _room_label_names(db: Session, room_id: int) -> list[str]:
    return [db.get(Label, rl.label_id).name for rl in db.query(RoomLabel).filter(RoomLabel.room_id == room_id)]


def _desk_label_names(db: Session, desk_id: int) -> list[str]:
    return [db.get(Label, dl.label_id).name for dl in db.query(DeskLabel).filter(DeskLabel.desk_id == desk_id)]


@router.post("/series/preview", response_model=SeriesPreviewOut)
def preview_series(payload: SeriesPreviewIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Zeigt die vorgeschlagenen Termine VOR dem Anlegen — mit Labels zur Entscheidungshilfe und
    Ersatzvorschlag bei Konflikt, statt sofort ungefragt zu buchen. Der Nutzer kann jeden Tag
    einzeln aus der Serie entfernen oder die Ressource wechseln, bevor final gebucht wird."""
    target = resolve_target_user(db, user, payload.for_user_id)
    dates = expand_series_dates(payload.start_date, payload.weekdays, payload.interval, payload.end_date)
    if not dates:
        _err(400, "NO_OCCURRENCES", "Für dieses Muster ergeben sich keine Termine.")

    occurrences: list[SeriesOccurrencePreview] = []
    if payload.kind == "desk":
        desk = db.get(Desk, payload.resource_id)
        room = db.get(Room, desk.room_id)
        prop = property_of_desk(db, desk)
        for d in dates:
            start_at, end_at = desk_day_part_range(d, payload.day_part, prop.day_part_switch_hour)
            if desk_is_locked(db, desk.id, start_at, end_at) or desk_conflicts(db, desk.id, start_at, end_at):
                alt = _suggest_alternative_desk(db, prop.id, target.id, d, payload.day_part, exclude_desk_id=desk.id)
                if alt:
                    alt_room = db.get(Room, alt.room_id)
                    occurrences.append(SeriesOccurrencePreview(
                        date=d, resource_id=alt.id, resource_label=f"{alt.desk_number} · {alt_room.name}",
                        labels=_desk_label_names(db, alt.id), available=True,
                        conflict_reason=f"{desk.desk_number} belegt — Ersatz vorgeschlagen"))
                else:
                    occurrences.append(SeriesOccurrencePreview(
                        date=d, resource_id=desk.id, resource_label=f"{desk.desk_number} · {room.name}",
                        labels=_desk_label_names(db, desk.id), available=False,
                        conflict_reason="Kein freier Arbeitsplatz verfügbar"))
                continue
            occurrences.append(SeriesOccurrencePreview(
                date=d, resource_id=desk.id, resource_label=f"{desk.desk_number} · {room.name}",
                labels=_desk_label_names(db, desk.id), available=True))
    else:
        room = db.get(Room, payload.resource_id)
        for d in dates:
            start_at = datetime.combine(d, datetime.min.time()).replace(hour=9)
            end_at = datetime.combine(d, datetime.min.time()).replace(hour=10)
            conflict = room_is_locked(db, room.id, start_at, end_at) or room_conflicts(db, room.id, start_at, end_at)
            occurrences.append(SeriesOccurrencePreview(
                date=d, resource_id=room.id, resource_label=room.name, labels=_room_label_names(db, room.id),
                available=not conflict, conflict_reason="Raum in diesem Slot bereits belegt" if conflict else None))

    return SeriesPreviewOut(occurrences=occurrences)


class SeriesOccurrenceIn(BaseModel):
    date: date_type
    resource_id: int


class CreateSeriesIn(BaseModel):
    kind: str  # desk | room
    day_part: str = "full"
    for_user_id: int | None = None
    occurrences: list[SeriesOccurrenceIn]
    # Nur zur Nachvollziehbarkeit auf dem Series-Datensatz, Buchungen entstehen ausschließlich aus `occurrences`:
    interval: str = "weekly"
    end_date: date_type | None = None


class SeriesConflict(BaseModel):
    date: date_type
    reason: str
    alternative_desk_id: int | None = None
    alternative_desk_number: str | None = None


class SeriesResultOut(BaseModel):
    series_id: int
    total_attempted: int
    booked: int
    conflicts: list[SeriesConflict]
    booking_ids: list[int]


@router.post("/series", response_model=SeriesResultOut)
def create_series(payload: CreateSeriesIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    target = resolve_target_user(db, user, payload.for_user_id)
    if not payload.occurrences:
        _err(400, "NO_OCCURRENCES", "Es wurde kein Termin zur Buchung ausgewählt.")

    end_date = payload.end_date or max(o.date for o in payload.occurrences)
    series = BookingSeries(created_by_user_id=user.id, for_user_id=target.id, interval=payload.interval,
                            end_date=datetime.combine(end_date, datetime.min.time()))
    db.add(series)
    db.flush()

    booked_ids: list[int] = []
    conflicts: list[SeriesConflict] = []

    if payload.kind == "desk":
        for occ in payload.occurrences:
            desk = db.get(Desk, occ.resource_id)
            if desk is None:
                conflicts.append(SeriesConflict(date=occ.date, reason="Arbeitsplatz nicht gefunden"))
                continue
            prop = property_of_desk(db, desk)
            start_at, end_at = desk_day_part_range(occ.date, payload.day_part, prop.day_part_switch_hour)
            if desk_is_locked(db, desk.id, start_at, end_at) or desk_conflicts(db, desk.id, start_at, end_at):
                conflicts.append(SeriesConflict(date=occ.date, reason="Zwischenzeitlich belegt — bitte erneut prüfen"))
                continue
            booking = Booking(kind="desk", status="confirmed", booked_for_user_id=target.id,
                               booked_by_user_id=user.id, start_at=start_at, end_at=end_at, series_id=series.id)
            db.add(booking)
            db.flush()
            db.add(DeskBooking(booking_id=booking.id, desk_id=desk.id, day_part=payload.day_part))
            db.add(BookingAudit(booking_id=booking.id, actor_user_id=user.id, action="created"))
            booked_ids.append(booking.id)
    else:
        for occ in payload.occurrences:
            room = db.get(Room, occ.resource_id)
            if room is None:
                conflicts.append(SeriesConflict(date=occ.date, reason="Raum nicht gefunden"))
                continue
            start_at = datetime.combine(occ.date, datetime.min.time()).replace(hour=9)
            end_at = datetime.combine(occ.date, datetime.min.time()).replace(hour=10)
            if room_is_locked(db, room.id, start_at, end_at) or room_conflicts(db, room.id, start_at, end_at):
                conflicts.append(SeriesConflict(date=occ.date, reason="Raum in diesem Slot bereits belegt"))
                continue
            status = "pending_approval" if room.approval_required else "confirmed"
            booking = Booking(kind="room", status=status, booked_for_user_id=target.id, booked_by_user_id=user.id,
                               start_at=start_at, end_at=end_at, series_id=series.id)
            db.add(booking)
            db.flush()
            db.add(RoomBooking(booking_id=booking.id, room_id=room.id))
            db.add(BookingAudit(booking_id=booking.id, actor_user_id=user.id, action="created"))
            booked_ids.append(booking.id)

    db.commit()
    return SeriesResultOut(series_id=series.id, total_attempted=len(payload.occurrences), booked=len(booked_ids),
                            conflicts=conflicts, booking_ids=booked_ids)


# --------------------------------------------------------------------------
# Meine Buchungen / Stornierung / Check-in
# --------------------------------------------------------------------------

@router.get("/mine", response_model=list[BookingOut])
def my_bookings(scope: str = "upcoming", for_user_id: int | None = None,
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """`for_user_id` erlaubt einer Vertretung, die Buchungen der vertretenen Person einzusehen
    (z.B. um sie im Krankheits-/Urlaubsfall zu stornieren) — Berechtigung wie beim Buchen (FR-11/12)."""
    target = resolve_target_user(db, user, for_user_id)
    q = db.query(Booking).filter(Booking.booked_for_user_id == target.id)
    now = datetime.utcnow()
    if scope == "upcoming":
        q = q.filter(Booking.end_at >= now, Booking.status != "cancelled")
    elif scope == "history":
        q = q.filter((Booking.end_at < now) | (Booking.status == "cancelled"))
    bookings = q.order_by(Booking.start_at.desc()).all()
    return [_booking_to_out(db, b) for b in bookings]


def _can_cancel(db: Session, user: User, booking: Booking) -> bool:
    if booking.booked_for_user_id == user.id:
        return True
    delegation = (
        db.query(Delegation)
        .filter(Delegation.manager_user_id == user.id, Delegation.employee_user_id == booking.booked_for_user_id)
        .first()
    )
    return delegation is not None


def _do_cancel(db: Session, user: User, booking: Booking) -> None:
    booking.status = "cancelled"
    booking.cancel_kind = "self"
    db.add(BookingAudit(booking_id=booking.id, actor_user_id=user.id, action="cancelled"))


class CancelResult(BaseModel):
    ok: bool


@router.post("/{booking_id}/cancel", response_model=CancelResult)
def cancel_booking(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.get(Booking, booking_id)
    if booking is None:
        _err(404, "BOOKING_NOT_FOUND", "Buchung nicht gefunden.")
    if not _can_cancel(db, user, booking):
        _err(403, "NOT_AUTHORIZED", "Sie sind nicht berechtigt, diese Buchung zu stornieren.")
    _do_cancel(db, user, booking)
    db.commit()
    return CancelResult(ok=True)


class BulkCancelIn(BaseModel):
    booking_ids: list[int]


class BulkCancelResult(BaseModel):
    cancelled_ids: list[int]
    failed: list[dict]


@router.post("/bulk-cancel", response_model=BulkCancelResult)
def bulk_cancel(payload: BulkCancelIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Sammel-Stornierung, z.B. bei Krankheit/Urlaub: mehrere Buchungen auf einmal auswählen
    und stornieren, statt jede einzeln durchzuklicken."""
    cancelled: list[int] = []
    failed: list[dict] = []
    for booking_id in payload.booking_ids:
        booking = db.get(Booking, booking_id)
        if booking is None:
            failed.append({"id": booking_id, "reason": "BOOKING_NOT_FOUND"})
            continue
        if booking.status == "cancelled":
            failed.append({"id": booking_id, "reason": "ALREADY_CANCELLED"})
            continue
        if not _can_cancel(db, user, booking):
            failed.append({"id": booking_id, "reason": "NOT_AUTHORIZED"})
            continue
        _do_cancel(db, user, booking)
        cancelled.append(booking_id)
    db.commit()
    return BulkCancelResult(cancelled_ids=cancelled, failed=failed)


@router.post("/series/{series_id}/cancel", response_model=BulkCancelResult)
def cancel_series(series_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Storniert alle noch aktiven Termine einer Serienbuchung auf einmal."""
    bookings = db.query(Booking).filter(Booking.series_id == series_id, Booking.status != "cancelled").all()
    if not bookings:
        _err(404, "SERIES_NOT_FOUND", "Keine aktiven Termine für diese Serie gefunden.")
    cancelled: list[int] = []
    failed: list[dict] = []
    for booking in bookings:
        if not _can_cancel(db, user, booking):
            failed.append({"id": booking.id, "reason": "NOT_AUTHORIZED"})
            continue
        _do_cancel(db, user, booking)
        cancelled.append(booking.id)
    db.commit()
    return BulkCancelResult(cancelled_ids=cancelled, failed=failed)


class CheckInResult(BaseModel):
    status: str
    checked_in_at: datetime | None


@router.post("/{booking_id}/checkin", response_model=CheckInResult)
def checkin(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.get(Booking, booking_id)
    if booking is None or booking.booked_for_user_id != user.id:
        _err(404, "BOOKING_NOT_FOUND", "Buchung nicht gefunden.")
    ci = db.query(CheckIn).filter(CheckIn.booking_id == booking_id).first()
    if ci is None:
        _err(400, "NO_CHECKIN_REQUIRED", "Für diese Buchung ist kein Check-in erforderlich.")
    if ci.status == "missed":
        _err(409, "CHECKIN_WINDOW_EXPIRED", "Das Check-in-Zeitfenster ist bereits abgelaufen.")
    ci.checked_in_at = datetime.utcnow()
    ci.status = "done"
    db.commit()
    return CheckInResult(status=ci.status, checked_in_at=ci.checked_in_at)
