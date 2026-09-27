"""Populates the SQLite DB with Ihre Organisation demo master data (Stammdaten).

Run via `uv run python -m app.seed_data` (also auto-invoked by main.py on first boot
when the DB file does not yet exist).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from app.db import Base, SessionLocal, engine
from app.models.bookings import Booking, DeskBooking
from app.models.reference import Delegation, Department, Label, Role, User, UserPreference, UserRole
from app.models.structure import (
    Building,
    Desk,
    DeskLabel,
    Floor,
    Property,
    Room,
    RoomDepartment,
    RoomLabel,
    RoomResponsible,
    SeatingOption,
)

FLOORPLAN_DIR = Path(__file__).resolve().parent / "static" / "floorplans"

ROLES = [
    ("mitarbeiter", "Mitarbeiter"),
    ("team_assistenz", "Team-Assistenz/Manager (Geschäftszimmer)"),
    ("fm", "Facility Manager"),
    ("raumverantwortlicher", "Raumverantwortlicher"),
    ("vsnfd", "Mitarbeiter mit vertraulicher Aufgabe"),
    ("vm", "Veranstaltungsmanagement"),
]

# Generische, fiktive Organisationsstruktur (keine reale Organisation) — dient nur als plausibles
# Demo-Beispiel für eine mehrstufige Abteilungsgliederung. Format: (code, name, parent_code | None).
# Dot-Notation bildet die Hierarchie ab, z.B. "6.2" ist Kind von "6", "6.2.1" ist Kind von "6.2".
ORG_UNITS: list[tuple[str, str, str | None]] = [
    ("P", "Geschäftsleitung / Vorstand", None),
    ("P.GZ", "Geschäftszimmer der Geschäftsleitung", "P"),
    ("P.PR", "Presse- und Öffentlichkeitsarbeit", "P"),
    ("1", "Abteilung 1 — Zentrale Dienstleistungen, Personal, Organisation, Infrastruktur", None),
    ("1.1", "Referat 11 — Personal", "1"),
    ("1.2", "Referat 12 — Liegenschaften, Innerer Dienst", "1"),
    ("1.2.1", "Referat 12E — Liegenschaftsmanagement", "1.2"),
    ("1.2.2", "Referat 12F — Bauunterhalt", "1.2"),
    ("1.3", "Referat 13 — Haushalt", "1"),
    ("2", "Abteilung 2 — Digitale Technologien, CIO, Innovationsmanagement", None),
    ("2.1", "Referat 21 — IT-Betrieb & Infrastruktur", "2"),
    ("2.2", "Referat 22 — Innovationsmanagement", "2"),
    ("3", "Abteilung 3 — Geschäftsprozesse & Fachverfahren", None),
    ("3.1", "Referat 31 — Fachverfahren Grundsatz", "3"),
    ("3.2", "Referat 32 — Verfahrenskoordination", "3"),
    ("4", "Abteilung 4 — Region Nord, West", None),
    ("4.1", "Referat 41 — Region Nord", "4"),
    ("4.2", "Referat 42 — Region West", "4"),
    ("5", "Abteilung 5 — Region Ost, Südwest, Süd", None),
    ("5.1", "Referat 51 — Region Ost", "5"),
    ("5.2", "Referat 52 — Region Süd", "5"),
    ("6", "Abteilung 6 — Grundsatzfragen, Qualitätssicherung, Prozessführung", None),
    ("6.1", "Referat 61 — Grundsatzfragen & Fachthemen", "6"),
    ("6.2", "Referat 62 — Qualitätssicherung & IT-Fachverfahren", "6"),
    ("6.2.1", "Referat 62.1 — Prozessführung", "6.2"),
    ("7", "Abteilung 7 — Sicherheit, Recht, Compliance", None),
    ("7.1", "Referat 71 — Sicherheit", "7"),
    ("7.2", "Referat 72 — Recht & Compliance", "7"),
    ("8", "Abteilung 8 — Weiterbildung & gesellschaftliches Engagement", None),
    ("8.1", "Referat 81 — Weiterbildungsprogramme", "8"),
    ("8.2", "Referat 82 — Gesellschaftliches Engagement", "8"),
    ("9", "Abteilung 9 — Internationale Beziehungen, Grundsatzfragen, Förderprogramme", None),
    ("9.1", "Referat 91 — Internationale Beziehungen", "9"),
    ("9.2", "Referat 92 — Förderprogramm-Verwaltung", "9"),
    ("FZ", "Forschungsabteilung", None),
]

LABELS = [
    "Fensterplatz", "Doppelmonitor", "Stehpult", "Ruhebereich", "Nähe zum Aufzug",
    "Team-Nähe", "Beamer", "Whiteboard", "Videokonferenz", "85\" Screen",
    "Akustik-isoliert", "Barrierefrei", "Highspeed-WLAN", "VS-NFD zertifiziert",
    "Ergonomischer Stuhl", "Kabelloses Laden", "Headset-Ablage",
]


def _get_or_create_floorplan(building: str, floor_name: str, desks: list[tuple[str, float, float]]) -> str:
    """Generate a simple schematic SVG floorplan with desk rectangles and return its relative path."""
    FLOORPLAN_DIR.mkdir(parents=True, exist_ok=True)
    safe = f"{building}-{floor_name}".replace(" ", "_").replace("/", "_").replace(".", "")
    filename = f"{safe}.svg"
    path = FLOORPLAN_DIR / filename
    rects = []
    for label, x, y in desks:
        rects.append(
            f'<g class="desk" data-desk="{label}">'
            f'<rect x="{x}" y="{y}" width="40" height="40" rx="4" fill="#ffffff" stroke="#43474f" stroke-width="1.5"/>'
            f'<text x="{x + 20}" y="{y + 24}" font-size="10" text-anchor="middle" fill="#191c1e">{label}</text>'
            f"</g>"
        )
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500">'
        '<rect x="0" y="0" width="900" height="500" fill="#f7f9fb"/>'
        '<rect x="10" y="10" width="880" height="480" fill="none" stroke="#c3c6d1" stroke-width="3"/>'
        + "".join(rects)
        + "</svg>"
    )
    path.write_text(svg, encoding="utf-8")
    return f"/static/floorplans/{filename}"


def _assign_labels_round_robin(db: Session, desks: list[Desk], label_ids: list[list[int]]) -> None:
    """Verteilt Label-Kombinationen zyklisch auf eine Desk-Liste, damit in der Demo jeder
    Arbeitsplatz mindestens ein sichtbares Merkmal trägt (statt nur einzelner Ausnahmen)."""
    for i, desk in enumerate(desks):
        combo = label_ids[i % len(label_ids)]
        for label_id in combo:
            db.add(DeskLabel(desk_id=desk.id, label_id=label_id))


def _make_floor_layout(rooms: list[dict], extra_objects: list[dict] | None = None) -> str:
    """Erzeugt ein valides JSON-Layout für einen Etagen-Grundriss (Platzierung von Räumen & Infrastruktur)."""
    objects = []
    for r in rooms:
        is_meeting = r.get("room_type") == "meeting"
        objects.append({
            "id": f"room-{r['id']}",
            "type": "meeting_room" if is_meeting else "room",
            "x": r["x"],
            "y": r["y"],
            "width": r["width"],
            "height": r["height"],
            "label": f"{r['number']} {r['name']}",
            "roomId": r["id"],
            "roomType": "meeting" if is_meeting else "desk_area",
        })
    if extra_objects:
        objects.extend(extra_objects)
    return json.dumps({"objects": objects})


def _make_room_desk_area_layout(desks: list[Desk], room_name: str, width: int = 860, height: int = 460) -> str:
    """Erzeugt ein valides JSON-Innenlayout für einen Büroraum mit Desks, Stühlen, Fenstern und Schränken."""
    objects = [
        {"id": "door-1", "type": "door", "x": 35, "y": 20, "width": 44, "height": 12, "label": "Zimmertür"},
        {"id": "win-1", "type": "window", "x": 180, "y": 20, "width": 80, "height": 10, "label": "Fenster"},
        {"id": "win-2", "type": "window", "x": 420, "y": 20, "width": 80, "height": 10, "label": "Fenster"},
        {"id": "cab-1", "type": "cabinet", "x": width - 110, "y": 40, "width": 80, "height": 36, "label": "Aktenschrank"},
        {"id": "plant-1", "type": "planter", "x": width - 60, "y": height - 60, "width": 30, "height": 30, "label": "Büropflanze"},
        {"id": "wb-1", "type": "whiteboard", "x": width - 130, "y": height // 2 - 30, "width": 10, "height": 80, "label": "Whiteboard"},
    ]
    for idx, d in enumerate(desks):
        col = idx % 4
        row = idx // 4
        dx = 60 + col * 180
        dy = 80 + row * 150
        objects.append({
            "id": f"desk-{d.id}",
            "type": "desk",
            "x": dx,
            "y": dy,
            "width": 110,
            "height": 55,
            "label": d.desk_number,
            "deskId": d.id,
        })
        objects.append({
            "id": f"chair-{d.id}",
            "type": "chair",
            "x": dx + 42,
            "y": dy + 62,
            "width": 26,
            "height": 26,
            "label": "Bürostuhl",
        })
    return json.dumps({"objects": objects})


def _make_meeting_room_layout(capacity: int, seating: str = "boardroom", width: int = 860, height: int = 460) -> str:
    """Erzeugt ein valides JSON-Innenlayout für einen Meetingraum mit passender Bestuhlung."""
    objects = [
        {"id": "door-1", "type": "door", "x": 35, "y": 20, "width": 44, "height": 12, "label": "Eingangstür"},
        {"id": "wb-1", "type": "whiteboard", "x": width // 2 - 90, "y": 20, "width": 180, "height": 12, "label": "85\" Konferenz-Screen & Whiteboard"},
        {"id": "plant-1", "type": "planter", "x": width - 60, "y": 40, "width": 30, "height": 30, "label": "Akustik-Begrünung"},
    ]
    cx = width // 2
    cy = height // 2 + 15
    if seating in ("boardroom", "conference"):
        tbl_w = min(480, max(260, (capacity // 2) * 60))
        tbl_h = 130
        objects.append({
            "id": "tbl-main",
            "type": "table",
            "x": cx - tbl_w // 2,
            "y": cy - tbl_h // 2,
            "width": tbl_w,
            "height": tbl_h,
            "label": f"Konferenztisch ({capacity} Pers.)",
        })
        side_count = max(1, capacity // 2)
        step = tbl_w / side_count
        for i in range(side_count):
            ox = cx - tbl_w // 2 + int((i + 0.5) * step) - 12
            objects.append({"id": f"chair-top-{i}", "type": "chair", "x": ox, "y": cy - tbl_h // 2 - 32, "width": 24, "height": 24, "label": "Konferenzstuhl"})
            objects.append({"id": f"chair-bot-{i}", "type": "chair", "x": ox, "y": cy + tbl_h // 2 + 8, "width": 24, "height": 24, "label": "Konferenzstuhl"})
    elif seating == "u_shape":
        objects.append({"id": "tbl-u1", "type": "table", "x": cx - 180, "y": cy - 100, "width": 45, "height": 200, "label": "Flügel Links"})
        objects.append({"id": "tbl-u2", "type": "table", "x": cx - 135, "y": cy - 100, "width": 270, "height": 45, "label": "Kopftisch"})
        objects.append({"id": "tbl-u3", "type": "table", "x": cx + 135, "y": cy - 100, "width": 45, "height": 200, "label": "Flügel Rechts"})
        for i in range(capacity):
            objects.append({"id": f"chair-u-{i}", "type": "chair", "x": cx - 160 + (i % 6) * 55, "y": cy - 40 + (i // 6) * 60, "width": 24, "height": 24, "label": "Stuhl"})
    else:
        objects.append({"id": "tbl-gen", "type": "table", "x": cx - 130, "y": cy - 50, "width": 260, "height": 100, "label": "Besprechungstisch"})
        for i in range(capacity):
            objects.append({"id": f"chair-gen-{i}", "type": "chair", "x": cx - 120 + (i % 6) * 45, "y": cy + 60 + (i // 6) * 35, "width": 22, "height": 22, "label": "Stuhl"})
    return json.dumps({"objects": objects})


def _enrich_existing_data(db: Session) -> None:
    """Aktualisiert bestehende DB-Bestände additiv um Grundrisse, Bestuhlungen und Kostenstellen."""
    f_1og = db.query(Floor).filter(Floor.name == "1. OG").first()
    if f_1og and not f_1og.floorplan_layout:
        rooms_1og = db.query(Room).filter(Room.floor_id == f_1og.id).all()
        room_data = []
        for r in rooms_1og:
            room_data.append({
                "id": r.id,
                "number": r.room_number,
                "name": r.name,
                "room_type": r.room_type,
                "x": r.pos_x or 40,
                "y": r.pos_y or 40,
                "width": r.width or 200,
                "height": r.height or 150,
            })
            desks = db.query(Desk).filter(Desk.room_id == r.id).order_by(Desk.id).all()
            if r.room_type == "desk_area" and desks and not r.floorplan_layout:
                r.floorplan_layout = _make_room_desk_area_layout(desks, r.name)
            elif r.room_type == "meeting" and not r.floorplan_layout:
                r.floorplan_layout = _make_meeting_room_layout(r.capacity or 10, r.seating_layout or "boardroom")

        extra_infra = [
            {"id": "stairs-fl1", "type": "stairs", "x": 350, "y": 270, "width": 140, "height": 100, "label": "Treppenhaus / Aufzug"},
            {"id": "door-fl1", "type": "door", "x": 220, "y": 240, "width": 45, "height": 12, "label": "Zugang Nord"},
            {"id": "door-fl2", "type": "door", "x": 520, "y": 240, "width": 45, "height": 12, "label": "Zugang Flex"},
            {"id": "door-fl3", "type": "door", "x": 730, "y": 240, "width": 45, "height": 12, "label": "Zugang Konferenz A"},
        ]
        f_1og.floorplan_layout = _make_floor_layout(room_data, extra_infra)

    users = db.query(User).all()
    for u in users:
        if not u.cost_center and u.department_id:
            dept = db.query(Department).filter(Department.id == u.department_id).first()
            if dept and dept.cost_center:
                u.cost_center = dept.cost_center

    db.commit()


def seed(db: Session, force: bool = False) -> None:
    if not force and db.query(Role).first():
        _enrich_existing_data(db)
        return  # already seeded

    roles = {code: Role(code=code, name=name) for code, name in ROLES}
    db.add_all(roles.values())

    labels = {name: Label(name=name) for name in LABELS}
    db.add_all(labels.values())
    db.flush()

    # ---- Organisationsstruktur (Abteilungen/Referate, hierarchisch) -------------
    COST_CENTERS: dict[str, str] = {
        "P": "KST-100-LEITUNG", "P.GZ": "KST-110-GZ", "P.PR": "KST-120-PRESSE",
        "1": "KST-1000-ZD", "1.1": "KST-1100-PERS", "1.2": "KST-1200-LIEG", "1.2.1": "KST-1210-FM", "1.2.2": "KST-1220-BAU", "1.3": "KST-1300-HH",
        "2": "KST-2000-IT", "2.1": "KST-2100-OPS", "2.2": "KST-2200-INNO",
        "3": "KST-3000-FACH", "3.1": "KST-3100-GRUND", "3.2": "KST-3200-KOORD",
        "4": "KST-4000-NW", "4.1": "KST-4100-NORD", "4.2": "KST-4200-WEST",
        "5": "KST-5000-OSS", "5.1": "KST-5100-OST", "5.2": "KST-5200-SUED",
        "6": "KST-6000-QS", "6.1": "KST-6100-GRUND", "6.2": "KST-6200-ITFV", "6.2.1": "KST-6210-PROZ",
        "7": "KST-7000-SI", "7.1": "KST-7100-SI", "7.2": "KST-7200-RECHT",
        "8": "KST-8000-WB", "8.1": "KST-8100-PROG", "8.2": "KST-8200-ZUS",
        "9": "KST-9000-INTL", "9.1": "KST-9100-INTL", "9.2": "KST-9200-FOERDER",
        "FZ": "KST-9900-FZ",
    }

    departments: dict[str, Department] = {}
    for code, name, parent_code in ORG_UNITS:
        parent = departments[parent_code] if parent_code else None
        cc = COST_CENTERS.get(code, f"KST-{code.replace('.', '')}")
        dept = Department(code=code, name=name, parent=parent, cost_center=cc)
        departments[code] = dept
        db.add(dept)
        db.flush()  # damit parent.id für die nächste Iteration gesetzt ist

    # ---- Liegenschaften -------------------------------------------------
    nuernberg = Property(
        name="Nürnberg Zentrale", address="Frankenstraße 210, 90461 Nürnberg",
        lat=49.4600, lon=11.0900, checkin_required=True, checkin_window_minutes=90,
    )
    berlin = Property(
        name="Berlin Außenstelle", address="Badstraße 2, 13357 Berlin",
        lat=52.5490, lon=13.3880, checkin_required=False,
    )
    muenchen = Property(
        name="München West", address="Streitfeldstraße 39, 81673 München",
        lat=48.1140, lon=11.6360, checkin_required=False,
    )
    hamburg = Property(
        name="Hamburg City", address="Sachsenstraße 12, 20097 Hamburg",
        lat=53.5680, lon=9.9950, checkin_required=False,
    )
    db.add_all([nuernberg, berlin, muenchen, hamburg])
    db.flush()

    # ---- Gebäude / Etagen -------------------------------------------------
    haus_a = Building(property_id=nuernberg.id, name="Haus A")
    haus_b = Building(property_id=nuernberg.id, name="Haus B")
    berlin_haus1 = Building(property_id=berlin.id, name="Haus 1")
    muenchen_haus1 = Building(property_id=muenchen.id, name="Haus 1")
    hamburg_haus1 = Building(property_id=hamburg.id, name="Haus 1")
    db.add_all([haus_a, haus_b, berlin_haus1, muenchen_haus1, hamburg_haus1])
    db.flush()

    floor_eg = Floor(building_id=haus_a.id, name="EG")
    floor_1og = Floor(building_id=haus_a.id, name="1. OG")
    floor_2og = Floor(building_id=haus_a.id, name="2. OG")
    haus_b_eg = Floor(building_id=haus_b.id, name="EG")
    berlin_1og = Floor(building_id=berlin_haus1.id, name="1. OG")
    muenchen_1og = Floor(building_id=muenchen_haus1.id, name="1. OG")
    hamburg_1og = Floor(building_id=hamburg_haus1.id, name="1. OG")
    db.add_all([floor_eg, floor_1og, floor_2og, haus_b_eg, berlin_1og, muenchen_1og, hamburg_1og])
    db.flush()

    # ---- Räume + Desks: Haus A / 1. OG (Hauptdemo-Etage) ------------------
    room_team_nord = Room(
        floor_id=floor_1og.id, room_number="1.01", name="Team Nord", room_type="desk_area",
        pos_x=40, pos_y=40, width=380, height=200,
    )
    room_flex = Room(
        floor_id=floor_1og.id, room_number="1.02", name="Flex", room_type="desk_area",
        pos_x=440, pos_y=40, width=200, height=200,
    )
    room_meeting_a101 = Room(
        floor_id=floor_1og.id, room_number="1.03", name="Konferenzraum A", room_type="meeting",
        capacity=12, approval_required=True, pos_x=660, pos_y=40, width=200, height=200,
    )
    room_ruhezone = Room(
        floor_id=floor_1og.id, room_number="1.10", name="Ruhezone", room_type="desk_area",
        pos_x=40, pos_y=280, width=260, height=180,
    )
    room_team_sued = Room(
        floor_id=floor_1og.id, room_number="1.11", name="Team Süd", room_type="desk_area",
        pos_x=660, pos_y=280, width=200, height=180,
    )
    # FR-44/45-Beispiel für die Orgstruktur-Hierarchie (Nutzeranforderung): Räume A-12/A-13
    # sind Abteilung 6 (inkl. aller Unter-Referate) vorbehalten; ein weiterer Raum ausschließlich
    # dem Unter-Referat 6.2 (inkl. 6.2.1, aber NICHT 6 oder 6.1).
    room_a12 = Room(
        floor_id=floor_1og.id, room_number="A-12", name="Projektbüro A-12", room_type="desk_area",
        pos_x=40, pos_y=470, width=200, height=140,
    )
    room_a13 = Room(
        floor_id=floor_1og.id, room_number="A-13", name="Projektbüro A-13", room_type="desk_area",
        pos_x=260, pos_y=470, width=200, height=140,
    )
    room_qs62 = Room(
        floor_id=floor_1og.id, room_number="1.20", name="Referatsbüro Qualitätssicherung", room_type="desk_area",
        pos_x=480, pos_y=470, width=200, height=140,
    )
    db.add_all([room_team_nord, room_flex, room_meeting_a101, room_ruhezone, room_team_sued,
                room_a12, room_a13, room_qs62])
    db.flush()

    db.add_all([
        RoomDepartment(room_id=room_a12.id, department_id=departments["6"].id, include_descendants=True),
        RoomDepartment(room_id=room_a13.id, department_id=departments["6"].id, include_descendants=True),
        RoomDepartment(room_id=room_qs62.id, department_id=departments["6.2"].id, include_descendants=True),
    ])

    def add_desks(room: Room, count: int, base_x: float, base_y: float, prefix: str, checkin_required: bool = False) -> list[Desk]:
        made = []
        for i in range(count):
            d = Desk(room_id=room.id, desk_number=f"{prefix}-{i+1:02d}", pos_x=base_x + i * 55, pos_y=base_y,
                      checkin_required=checkin_required)
            made.append(d)
        db.add_all(made)
        return made

    desks_nord = add_desks(room_team_nord, 5, 70, 90, "N")
    desks_flex = add_desks(room_flex, 3, 470, 90, "F")
    desks_ruhe = add_desks(room_ruhezone, 3, 70, 340, "R")
    desks_sued = add_desks(room_team_sued, 3, 690, 340, "S")
    desks_a12 = add_desks(room_a12, 3, 60, 520, "A12")
    desks_a13 = add_desks(room_a13, 3, 280, 520, "A13")
    # Desk-Level Check-in-Beispiel (Nutzeranforderung): diese zwei Desks verlangen Check-in,
    # obwohl der Raum/die Liegenschaft es nicht pauschal vorschreiben.
    desks_qs62 = add_desks(room_qs62, 2, 500, 520, "QS", checkin_required=True)
    db.flush()

    # ---- Labels: jeder Desk trägt mindestens ein Merkmal (Rundlauf-Zuordnung) --
    label_combos = [
        [labels["Fensterplatz"].id],
        [labels["Doppelmonitor"].id, labels["Stehpult"].id],
        [labels["Ruhebereich"].id, labels["Highspeed-WLAN"].id],
        [labels["Nähe zum Aufzug"].id],
        [labels["Team-Nähe"].id, labels["Ergonomischer Stuhl"].id],
        [labels["Barrierefrei"].id, labels["Kabelloses Laden"].id],
        [labels["Doppelmonitor"].id],
        [labels["Headset-Ablage"].id, labels["Highspeed-WLAN"].id],
    ]
    for desk_group in (desks_nord, desks_flex, desks_ruhe, desks_sued, desks_a12, desks_a13, desks_qs62):
        _assign_labels_round_robin(db, desk_group, label_combos)

    db.add_all([
        RoomLabel(room_id=room_meeting_a101.id, label_id=labels["Beamer"].id),
        RoomLabel(room_id=room_meeting_a101.id, label_id=labels["Whiteboard"].id),
        RoomLabel(room_id=room_meeting_a101.id, label_id=labels["Videokonferenz"].id),
        RoomLabel(room_id=room_meeting_a101.id, label_id=labels["Akustik-isoliert"].id),
    ])

    seating_std = SeatingOption(room_id=room_meeting_a101.id, name="Standard (Konferenz)", is_standard=True, changeover_days=0)
    seating_u = SeatingOption(room_id=room_meeting_a101.id, name="U-Form", is_standard=False, changeover_days=1)
    seating_block = SeatingOption(room_id=room_meeting_a101.id, name="Blockbestuhlung", is_standard=False, changeover_days=1)
    seating_theater = SeatingOption(room_id=room_meeting_a101.id, name="Theater / Kino", is_standard=False, changeover_days=2)
    seating_parl = SeatingOption(room_id=room_meeting_a101.id, name="Parlamentarisch", is_standard=False, changeover_days=1)
    seating_circle = SeatingOption(room_id=room_meeting_a101.id, name="Stuhlkreis", is_standard=False, changeover_days=0)
    db.add_all([seating_std, seating_u, seating_block, seating_theater, seating_parl, seating_circle])

    # ---- Raum-Innenlayouts (Möblierung, Desks, Stühle, etc.) Haus A / 1. OG ----
    room_team_nord.floorplan_layout = _make_room_desk_area_layout(desks_nord, "Team Nord")
    room_flex.floorplan_layout = _make_room_desk_area_layout(desks_flex, "Flex")
    room_ruhezone.floorplan_layout = _make_room_desk_area_layout(desks_ruhe, "Ruhezone")
    room_team_sued.floorplan_layout = _make_room_desk_area_layout(desks_sued, "Team Süd")
    room_a12.floorplan_layout = _make_room_desk_area_layout(desks_a12, "Projektbüro A-12")
    room_a13.floorplan_layout = _make_room_desk_area_layout(desks_a13, "Projektbüro A-13")
    room_qs62.floorplan_layout = _make_room_desk_area_layout(desks_qs62, "Referatsbüro Qualitätssicherung")
    room_meeting_a101.floorplan_layout = _make_meeting_room_layout(12, "boardroom")
    room_meeting_a101.seating_layout = "boardroom"

    # ---- Etagen-Grundriss Haus A / 1. OG (Räume, Treppenhaus, Türen) --------
    floor_1og.floorplan_layout = _make_floor_layout([
        {"id": room_team_nord.id, "number": room_team_nord.room_number, "name": room_team_nord.name, "room_type": "desk_area", "x": 40, "y": 40, "width": 380, "height": 200},
        {"id": room_flex.id, "number": room_flex.room_number, "name": room_flex.name, "room_type": "desk_area", "x": 440, "y": 40, "width": 200, "height": 200},
        {"id": room_meeting_a101.id, "number": room_meeting_a101.room_number, "name": room_meeting_a101.name, "room_type": "meeting", "x": 660, "y": 40, "width": 200, "height": 200},
        {"id": room_ruhezone.id, "number": room_ruhezone.room_number, "name": room_ruhezone.name, "room_type": "desk_area", "x": 40, "y": 280, "width": 260, "height": 170},
        {"id": room_team_sued.id, "number": room_team_sued.room_number, "name": room_team_sued.name, "room_type": "desk_area", "x": 660, "y": 280, "width": 200, "height": 170},
        {"id": room_a12.id, "number": room_a12.room_number, "name": room_a12.name, "room_type": "desk_area", "x": 40, "y": 470, "width": 200, "height": 140},
        {"id": room_a13.id, "number": room_a13.room_number, "name": room_a13.name, "room_type": "desk_area", "x": 260, "y": 470, "width": 200, "height": 140},
        {"id": room_qs62.id, "number": room_qs62.room_number, "name": room_qs62.name, "room_type": "desk_area", "x": 480, "y": 470, "width": 200, "height": 140},
    ], [
        {"id": "stairs-fl1", "type": "stairs", "x": 340, "y": 280, "width": 140, "height": 110, "label": "Treppenhaus / Aufzug"},
        {"id": "door-fl1", "type": "door", "x": 220, "y": 240, "width": 45, "height": 12, "label": "Tür Flur Nord"},
        {"id": "door-fl2", "type": "door", "x": 520, "y": 240, "width": 45, "height": 12, "label": "Tür Flex"},
        {"id": "door-fl3", "type": "door", "x": 730, "y": 240, "width": 45, "height": 12, "label": "Tür Konferenz A"},
        {"id": "door-fl4", "type": "door", "x": 160, "y": 450, "width": 45, "height": 12, "label": "Tür Flur A12"},
        {"id": "door-fl5", "type": "door", "x": 330, "y": 450, "width": 45, "height": 12, "label": "Tür Flur A13"},
    ])

    # ---- weitere Etagen Haus A (für Navigator, ohne Grundriss -> Listenansicht) --
    room_2og_a = Room(floor_id=floor_2og.id, room_number="2.01", name="Projektraum C", room_type="desk_area")
    db.add(room_2og_a)
    db.flush()
    desks_2og = add_desks(room_2og_a, 6, 0, 0, "P")
    db.flush()
    _assign_labels_round_robin(db, desks_2og, label_combos)

    room_eg_a = Room(floor_id=floor_eg.id, room_number="0.01", name="Empfangsbereich", room_type="desk_area")
    db.add(room_eg_a)
    db.flush()
    desks_eg = add_desks(room_eg_a, 4, 0, 0, "E")
    db.flush()
    _assign_labels_round_robin(db, desks_eg, label_combos)

    # ---- Haus B: Meetingräume + Bürobereich mit Grundriss -------------
    room_videostudio = Room(floor_id=haus_b_eg.id, room_number="B.01", name="Videostudio B", room_type="meeting",
                             capacity=4, approval_required=False, pos_x=40, pos_y=40, width=240, height=200)
    room_kleiner_sitzungsraum = Room(floor_id=haus_b_eg.id, room_number="B.02", name="Kleiner Sitzungsraum",
                                      room_type="meeting", capacity=6, approval_required=False, pos_x=310, pos_y=40, width=240, height=200)
    room_muenchen_konferenz = Room(  # zugriffsbeschränkt Beispiel (Rolle statt Org-Einheit)
        floor_id=haus_b_eg.id, room_number="B.03", name="Boardroom Wien", room_type="meeting", capacity=8,
        restricted_role_code="vm", pos_x=580, pos_y=40, width=260, height=200,
    )
    room_haus_b_team = Room(
        floor_id=haus_b_eg.id, room_number="B.04", name="Projektteam B-04", room_type="desk_area",
        pos_x=40, pos_y=270, width=380, height=190,
    )
    db.add_all([room_videostudio, room_kleiner_sitzungsraum, room_muenchen_konferenz, room_haus_b_team])
    db.flush()

    desks_haus_b = add_desks(room_haus_b_team, 4, 70, 310, "B")
    db.flush()
    _assign_labels_round_robin(db, desks_haus_b, label_combos)

    db.add_all([
        RoomLabel(room_id=room_videostudio.id, label_id=labels["Videokonferenz"].id),
        RoomLabel(room_id=room_videostudio.id, label_id=labels["85\" Screen"].id),
        RoomLabel(room_id=room_kleiner_sitzungsraum.id, label_id=labels["Whiteboard"].id),
        RoomLabel(room_id=room_muenchen_konferenz.id, label_id=labels["Videokonferenz"].id),
        RoomLabel(room_id=room_muenchen_konferenz.id, label_id=labels["85\" Screen"].id),
    ])

    db.add_all([
        SeatingOption(room_id=room_videostudio.id, name="Studio-Setup", is_standard=True, changeover_days=0),
        SeatingOption(room_id=room_videostudio.id, name="Talkrunde / Podcast", is_standard=False, changeover_days=0),
        SeatingOption(room_id=room_kleiner_sitzungsraum.id, name="Standard (Besprechung)", is_standard=True, changeover_days=0),
        SeatingOption(room_id=room_kleiner_sitzungsraum.id, name="Blockbestuhlung", is_standard=False, changeover_days=1),
        SeatingOption(room_id=room_muenchen_konferenz.id, name="Executive Boardroom", is_standard=True, changeover_days=0),
        SeatingOption(room_id=room_muenchen_konferenz.id, name="U-Form", is_standard=False, changeover_days=1),
    ])

    room_videostudio.floorplan_layout = _make_meeting_room_layout(4, "boardroom")
    room_kleiner_sitzungsraum.floorplan_layout = _make_meeting_room_layout(6, "boardroom")
    room_muenchen_konferenz.floorplan_layout = _make_meeting_room_layout(8, "boardroom")
    room_haus_b_team.floorplan_layout = _make_room_desk_area_layout(desks_haus_b, "Projektteam B-04")

    haus_b_eg.floorplan_layout = _make_floor_layout([
        {"id": room_videostudio.id, "number": room_videostudio.room_number, "name": room_videostudio.name, "room_type": "meeting", "x": 40, "y": 40, "width": 240, "height": 200},
        {"id": room_kleiner_sitzungsraum.id, "number": room_kleiner_sitzungsraum.room_number, "name": room_kleiner_sitzungsraum.name, "room_type": "meeting", "x": 310, "y": 40, "width": 240, "height": 200},
        {"id": room_muenchen_konferenz.id, "number": room_muenchen_konferenz.room_number, "name": room_muenchen_konferenz.name, "room_type": "meeting", "x": 580, "y": 40, "width": 260, "height": 200},
        {"id": room_haus_b_team.id, "number": room_haus_b_team.room_number, "name": room_haus_b_team.name, "room_type": "desk_area", "x": 40, "y": 270, "width": 380, "height": 190},
    ], [
        {"id": "hb-stairs", "type": "stairs", "x": 500, "y": 280, "width": 120, "height": 100, "label": "Treppenhaus"},
        {"id": "hb-door1", "type": "door", "x": 150, "y": 240, "width": 45, "height": 12, "label": "Tür Studio"},
        {"id": "hb-door2", "type": "door", "x": 420, "y": 240, "width": 45, "height": 12, "label": "Tür Sitzungsraum"},
        {"id": "hb-door3", "type": "door", "x": 690, "y": 240, "width": 45, "height": 12, "label": "Tür Boardroom"},
    ])

    # ---- Berlin Außenstelle: 1 Etage mit Desks + Meetingraum ---------------
    room_berlin_team = Room(floor_id=berlin_1og.id, room_number="1.01", name="Team Berlin", room_type="desk_area", pos_x=40, pos_y=40, width=380, height=220)
    room_berlin_meeting = Room(floor_id=berlin_1og.id, room_number="1.02", name="Meetingraum Berlin", room_type="meeting", capacity=12, approval_required=False, pos_x=460, pos_y=40, width=360, height=220)
    db.add_all([room_berlin_team, room_berlin_meeting])
    db.flush()
    berlin_desks = add_desks(room_berlin_team, 8, 70, 90, "BE")
    db.flush()
    _assign_labels_round_robin(db, berlin_desks, label_combos)
    db.add(RoomLabel(room_id=room_berlin_meeting.id, label_id=labels["Videokonferenz"].id))
    db.add(RoomLabel(room_id=room_berlin_meeting.id, label_id=labels["Whiteboard"].id))
    db.add_all([
        SeatingOption(room_id=room_berlin_meeting.id, name="Standard (Konferenz)", is_standard=True, changeover_days=0),
        SeatingOption(room_id=room_berlin_meeting.id, name="U-Form", is_standard=False, changeover_days=1),
        SeatingOption(room_id=room_berlin_meeting.id, name="Stuhlkreis", is_standard=False, changeover_days=0),
    ])

    room_berlin_team.floorplan_layout = _make_room_desk_area_layout(berlin_desks, "Team Berlin")
    room_berlin_meeting.floorplan_layout = _make_meeting_room_layout(12, "boardroom")
    room_berlin_meeting.seating_layout = "boardroom"

    berlin_1og.floorplan_layout = _make_floor_layout([
        {"id": room_berlin_team.id, "number": room_berlin_team.room_number, "name": room_berlin_team.name, "room_type": "desk_area", "x": 40, "y": 40, "width": 380, "height": 220},
        {"id": room_berlin_meeting.id, "number": room_berlin_meeting.room_number, "name": room_berlin_meeting.name, "room_type": "meeting", "x": 460, "y": 40, "width": 360, "height": 220},
    ], [
        {"id": "b-stairs", "type": "stairs", "x": 370, "y": 290, "width": 120, "height": 100, "label": "Treppenhaus"},
        {"id": "b-door1", "type": "door", "x": 210, "y": 260, "width": 45, "height": 12, "label": "Tür Büro"},
        {"id": "b-door2", "type": "door", "x": 620, "y": 260, "width": 45, "height": 12, "label": "Tür Meeting"},
    ])

    # ---- München West: nahezu ausgebucht (4 frei) + Meetingraum -------------
    room_muc_team = Room(floor_id=muenchen_1og.id, room_number="1.01", name="Team München", room_type="desk_area", pos_x=40, pos_y=40, width=480, height=260)
    room_muc_meeting = Room(floor_id=muenchen_1og.id, room_number="1.02", name="Konferenzraum Isar", room_type="meeting", capacity=10, approval_required=False, pos_x=560, pos_y=40, width=280, height=260)
    db.add_all([room_muc_team, room_muc_meeting])
    db.flush()
    muc_desks = add_desks(room_muc_team, 20, 70, 90, "M")
    db.flush()
    _assign_labels_round_robin(db, muc_desks, label_combos)
    db.add_all([
        RoomLabel(room_id=room_muc_meeting.id, label_id=labels["Videokonferenz"].id),
        RoomLabel(room_id=room_muc_meeting.id, label_id=labels["Whiteboard"].id),
        SeatingOption(room_id=room_muc_meeting.id, name="Standard (Konferenz)", is_standard=True, changeover_days=0),
        SeatingOption(room_id=room_muc_meeting.id, name="U-Form", is_standard=False, changeover_days=1),
    ])
    room_muc_team.floorplan_layout = _make_room_desk_area_layout(muc_desks, "Team München")
    room_muc_meeting.floorplan_layout = _make_meeting_room_layout(10, "boardroom")
    muenchen_1og.floorplan_layout = _make_floor_layout([
        {"id": room_muc_team.id, "number": room_muc_team.room_number, "name": room_muc_team.name, "room_type": "desk_area", "x": 40, "y": 40, "width": 480, "height": 260},
        {"id": room_muc_meeting.id, "number": room_muc_meeting.room_number, "name": room_muc_meeting.name, "room_type": "meeting", "x": 560, "y": 40, "width": 280, "height": 260},
    ], [{"id": "muc-door", "type": "door", "x": 260, "y": 300, "width": 50, "height": 12, "label": "Tür Flur"}])

    # ---- Hamburg City: komplett ausgebucht (0 frei) + Meetingraum ----------
    room_hh_team = Room(floor_id=hamburg_1og.id, room_number="1.01", name="Team Hamburg", room_type="desk_area", pos_x=40, pos_y=40, width=310, height=220)
    room_hh_meeting = Room(floor_id=hamburg_1og.id, room_number="1.02", name="Besprechungsraum Alster", room_type="meeting", capacity=8, approval_required=False, pos_x=380, pos_y=40, width=280, height=220)
    db.add_all([room_hh_team, room_hh_meeting])
    db.flush()
    hh_desks = add_desks(room_hh_team, 6, 70, 90, "H")
    db.flush()
    _assign_labels_round_robin(db, hh_desks, label_combos)
    db.add_all([
        RoomLabel(room_id=room_hh_meeting.id, label_id=labels["Beamer"].id),
        RoomLabel(room_id=room_hh_meeting.id, label_id=labels["Whiteboard"].id),
        SeatingOption(room_id=room_hh_meeting.id, name="Standard (Konferenz)", is_standard=True, changeover_days=0),
        SeatingOption(room_id=room_hh_meeting.id, name="Blockbestuhlung", is_standard=False, changeover_days=1),
    ])
    room_hh_team.floorplan_layout = _make_room_desk_area_layout(hh_desks, "Team Hamburg")
    room_hh_meeting.floorplan_layout = _make_meeting_room_layout(8, "boardroom")
    hamburg_1og.floorplan_layout = _make_floor_layout([
        {"id": room_hh_team.id, "number": room_hh_team.room_number, "name": room_hh_team.name, "room_type": "desk_area", "x": 40, "y": 40, "width": 310, "height": 220},
        {"id": room_hh_meeting.id, "number": room_hh_meeting.room_number, "name": room_hh_meeting.name, "room_type": "meeting", "x": 380, "y": 40, "width": 280, "height": 220},
    ], [{"id": "hh-door", "type": "door", "x": 180, "y": 260, "width": 50, "height": 12, "label": "Tür Flur"}])

    # ---- Floorplan-SVGs generieren -----------------------------------------
    floor_1og.floorplan_image_path = _get_or_create_floorplan(
        "haus-a", "1og",
        [(d.desk_number, d.pos_x, d.pos_y) for d in desks_nord + desks_flex + desks_ruhe + desks_sued
         + desks_a12 + desks_a13 + desks_qs62],
    )
    berlin_1og.floorplan_image_path = _get_or_create_floorplan(
        "berlin-haus1", "1og", [(d.desk_number, d.pos_x, d.pos_y) for d in berlin_desks],
    )
    muenchen_1og.floorplan_image_path = _get_or_create_floorplan(
        "muenchen-haus1", "1og", [(d.desk_number, d.pos_x, d.pos_y) for d in muc_desks],
    )
    hamburg_1og.floorplan_image_path = _get_or_create_floorplan(
        "hamburg-haus1", "1og", [(d.desk_number, d.pos_x, d.pos_y) for d in hh_desks],
    )
    # floor_2og / floor_eg / haus_b_eg bleiben ohne floorplan_image_path -> Listenansicht-Fallback (FR-51)

    db.flush()

    # ---- Nutzer -------------------------------------------------------------
    maria = User(idm_code="U-1001", display_name="Dr. Maria Schmidt", email="maria.schmidt@organisation.example",
                 department_id=departments["P.GZ"].id, home_property_id=nuernberg.id, klarname_opt_in=True,
                 cost_center="KST-110-GZ")
    ali = User(idm_code="U-1002", display_name="Ali Yilmaz", email="ali.yilmaz@organisation.example",
               department_id=departments["2.1"].id, home_property_id=nuernberg.id, home_desk_id=desks_nord[0].id,
               cost_center="KST-2100-OPS")
    johannes = User(idm_code="U-1003", display_name="Johannes Schneider", email="johannes.schneider@organisation.example",
                    department_id=departments["6.1"].id, home_property_id=nuernberg.id,
                    cost_center="KST-6100-GRUND")
    elena = User(idm_code="U-1004", display_name="Elena Petrova", email="elena.petrova@organisation.example",
                 department_id=departments["9.2"].id, home_property_id=berlin.id,
                 cost_center="KST-9200-FOERDER")
    kessler = User(idm_code="U-1005", display_name="Frau Kessler", email="kessler@organisation.example",
                   department_id=departments["P.PR"].id, home_property_id=berlin.id,
                   cost_center="KST-120-PRESSE")
    kaya = User(idm_code="U-1006", display_name="Frau Kaya", email="kaya@organisation.example",
                department_id=departments["P.GZ"].id, home_property_id=nuernberg.id,
                cost_center="KST-110-GZ")
    mueller = User(idm_code="U-1007", display_name="Hans Müller", email="hans.mueller@organisation.example",
                   department_id=departments["2.1"].id, home_property_id=nuernberg.id,
                   cost_center="KST-2100-OPS")
    demir = User(idm_code="U-1008", display_name="Herr Demir", email="demir@organisation.example",
                 department_id=departments["P.PR"].id, home_property_id=nuernberg.id,
                 cost_center="KST-120-PRESSE")
    ostermann = User(idm_code="U-1009", display_name="Frau Ostermann", email="ostermann@organisation.example",
                     department_id=departments["1.2.1"].id, home_property_id=nuernberg.id,
                     cost_center="KST-1210-FM")
    brandt = User(idm_code="U-1010", display_name="Herr Brandt", email="brandt@organisation.example",
                  department_id=departments["1.2.1"].id, home_property_id=nuernberg.id, security_clearance="Ue2",
                  cost_center="KST-1210-FM")
    weber = User(idm_code="U-1011", display_name="Thomas Weber", email="weber@organisation.example",
                 department_id=departments["2.1"].id, home_property_id=nuernberg.id,
                 cost_center="KST-2100-OPS")
    kraus = User(idm_code="U-1012", display_name="Sabine Kraus", email="kraus@organisation.example",
                 department_id=departments["2.1"].id, home_property_id=nuernberg.id,
                 cost_center="KST-2100-OPS")
    fischer = User(idm_code="U-1013", display_name="Julia Fischer", email="fischer@organisation.example",
                   department_id=departments["P.PR"].id, home_property_id=nuernberg.id,
                   cost_center="KST-120-PRESSE")
    # Zusätzliche FM-Rolle mit klarem Planungs-Fokus (München West), unabhängig von 12E Nürnberg
    facility_manager_muc = User(idm_code="U-1014", display_name="Herr Wagner", email="wagner@organisation.example",
                                department_id=departments["1.2.2"].id, home_property_id=muenchen.id,
                                cost_center="KST-1220-BAU")
    # Org-Hierarchie-Demo (Nutzeranforderung): 6 / 6.1 / 6.2 / 6.2.1
    lehmann = User(idm_code="U-1015", display_name="Frau Lehmann", email="lehmann@organisation.example",
                   department_id=departments["6"].id, home_property_id=nuernberg.id,
                   cost_center="KST-6000-QS")
    kaiser = User(idm_code="U-1016", display_name="Herr Kaiser", email="kaiser@organisation.example",
                  department_id=departments["6.2"].id, home_property_id=nuernberg.id,
                  cost_center="KST-6200-ITFV")
    nowak = User(idm_code="U-1017", display_name="Frau Nowak", email="nowak@organisation.example",
                 department_id=departments["6.2.1"].id, home_property_id=nuernberg.id,
                 cost_center="KST-6210-PROZ")

    all_users = [maria, ali, johannes, elena, kessler, kaya, mueller, demir, ostermann, brandt, weber, kraus,
                 fischer, facility_manager_muc, lehmann, kaiser, nowak]
    db.add_all(all_users)
    db.flush()

    # ---- Rollen ---------------------------------------------------------
    db.add_all([
        UserRole(user_id=maria.id, role_id=roles["fm"].id),
        UserRole(user_id=maria.id, role_id=roles["raumverantwortlicher"].id),
        UserRole(user_id=ali.id, role_id=roles["mitarbeiter"].id),
        UserRole(user_id=johannes.id, role_id=roles["mitarbeiter"].id),
        UserRole(user_id=elena.id, role_id=roles["mitarbeiter"].id),
        UserRole(user_id=kessler.id, role_id=roles["mitarbeiter"].id),
        UserRole(user_id=kaya.id, role_id=roles["team_assistenz"].id),
        UserRole(user_id=mueller.id, role_id=roles["mitarbeiter"].id),
        UserRole(user_id=demir.id, role_id=roles["mitarbeiter"].id),
        UserRole(user_id=ostermann.id, role_id=roles["raumverantwortlicher"].id),
        UserRole(user_id=brandt.id, role_id=roles["fm"].id),
        UserRole(user_id=brandt.id, role_id=roles["vsnfd"].id),
        UserRole(user_id=weber.id, role_id=roles["mitarbeiter"].id),
        UserRole(user_id=kraus.id, role_id=roles["mitarbeiter"].id),
        UserRole(user_id=fischer.id, role_id=roles["mitarbeiter"].id),
        UserRole(user_id=facility_manager_muc.id, role_id=roles["fm"].id),
        UserRole(user_id=lehmann.id, role_id=roles["mitarbeiter"].id),
        UserRole(user_id=kaiser.id, role_id=roles["mitarbeiter"].id),
        UserRole(user_id=nowak.id, role_id=roles["mitarbeiter"].id),
    ])

    # Raumverantwortliche
    db.add(RoomResponsible(room_id=room_meeting_a101.id, user_id=ostermann.id))
    db.add(RoomResponsible(room_id=room_meeting_a101.id, user_id=maria.id))

    # Vertretung: Kaya (Geschäftszimmer) vertritt Müller (line_org) und Elena (self_service)
    db.add(Delegation(manager_user_id=kaya.id, employee_user_id=mueller.id, source="line_org"))
    db.add(Delegation(manager_user_id=kaya.id, employee_user_id=elena.id, source="self_service"))
    db.add(Delegation(manager_user_id=kaya.id, employee_user_id=demir.id, source="line_org"))

    # Präferenzen
    db.add_all([
        UserPreference(user_id=maria.id, label_id=labels["Doppelmonitor"].id),
        UserPreference(user_id=maria.id, label_id=labels["Stehpult"].id),
        UserPreference(user_id=maria.id, label_id=labels["Ruhebereich"].id),
        UserPreference(user_id=kessler.id, label_id=labels["Fensterplatz"].id),
        UserPreference(user_id=kessler.id, label_id=labels["Doppelmonitor"].id),
    ])

    db.flush()

    # ---- Demo-Buchungen (ein paar bestehende, damit Listen nicht leer sind) --
    now = datetime.utcnow()
    tomorrow = now + timedelta(days=1)
    today_9 = now.replace(hour=8, minute=0, second=0, microsecond=0)
    today_17 = now.replace(hour=17, minute=0, second=0, microsecond=0)
    tomorrow_9 = tomorrow.replace(hour=8, minute=0, second=0, microsecond=0)
    tomorrow_17 = tomorrow.replace(hour=17, minute=0, second=0, microsecond=0)

    # Ali: heute UND morgen gebucht, damit "Wer sitzt wo" unabhängig von der Tageszeit Treffer zeigt
    b1 = Booking(kind="desk", status="confirmed", booked_for_user_id=ali.id, booked_by_user_id=ali.id,
                 start_at=today_9, end_at=today_17)
    b1b = Booking(kind="desk", status="confirmed", booked_for_user_id=ali.id, booked_by_user_id=ali.id,
                  start_at=tomorrow_9, end_at=tomorrow_17)
    db.add_all([b1, b1b])
    db.flush()
    db.add(DeskBooking(booking_id=b1.id, desk_id=desks_nord[2].id))
    db.add(DeskBooking(booking_id=b1b.id, desk_id=desks_nord[2].id))

    # München fast voll: belege 16 von 20 Desks heute + morgen
    for d in muc_desks[:16]:
        for start_at, end_at in ((today_9, today_17), (tomorrow_9, tomorrow_17)):
            b = Booking(kind="desk", status="confirmed", booked_for_user_id=weber.id, booked_by_user_id=weber.id,
                        start_at=start_at, end_at=end_at)
            db.add(b)
            db.flush()
            db.add(DeskBooking(booking_id=b.id, desk_id=d.id))

    # Hamburg komplett voll (alle 6 Desks), heute + morgen
    for d in hh_desks:
        for start_at, end_at in ((today_9, today_17), (tomorrow_9, tomorrow_17)):
            b = Booking(kind="desk", status="confirmed", booked_for_user_id=kraus.id, booked_by_user_id=kraus.id,
                        start_at=start_at, end_at=end_at)
            db.add(b)
            db.flush()
            db.add(DeskBooking(booking_id=b.id, desk_id=d.id))

    db.commit()


def main() -> None:
    import sys
    force_reset = "--reset" in sys.argv or "--force" in sys.argv
    if force_reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db, force=force_reset)
    finally:
        db.close()


if __name__ == "__main__":
    main()
