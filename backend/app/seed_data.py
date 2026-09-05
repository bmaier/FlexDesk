"""Populates the SQLite DB with BAMF demo master data (Stammdaten).

Run via `uv run python -m app.seed_data` (also auto-invoked by main.py on first boot
when the DB file does not yet exist).
"""
from __future__ import annotations

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

# BAMF-Orgstruktur (reale Abteilungsgliederung lt. bamf.de/Wikipedia, Referate darunter sind
# plausibel nach üblicher Bundesbehörden-Konvention ergänzt, da nicht öffentlich im Detail
# dokumentiert). Format: (code, name, parent_code | None). Dot-Notation bildet die Hierarchie ab,
# z.B. "6.2" ist Kind von "6", "6.2.1" ist Kind von "6.2".
ORG_UNITS: list[tuple[str, str, str | None]] = [
    ("P", "Präsidium / Leitungsstab", None),
    ("P.GZ", "Geschäftszimmer Abteilungsleitung", "P"),
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
    ("3", "Abteilung 3 — Geschäftsprozesse Asylbereich, Dublinverfahren", None),
    ("3.1", "Referat 31 — Asylverfahren Grundsatz", "3"),
    ("3.2", "Referat 32 — Dublinverfahren", "3"),
    ("4", "Abteilung 4 — Region Nord, West", None),
    ("4.1", "Referat 41 — Region Nord", "4"),
    ("4.2", "Referat 42 — Region West", "4"),
    ("5", "Abteilung 5 — Region Ost, Südwest, Süd", None),
    ("5.1", "Referat 51 — Region Ost", "5"),
    ("5.2", "Referat 52 — Region Süd", "5"),
    ("6", "Abteilung 6 — Grundlagen des Asylverfahrens, Qualitätssicherung, IZAM, Prozessführung", None),
    ("6.1", "Referat 61 — Grundsatzfragen Asylverfahren & Migration", "6"),
    ("6.2", "Referat 62 — Qualitätssicherung & IZAM", "6"),
    ("6.2.1", "Referat 62.1 — Prozessführung", "6.2"),
    ("7", "Abteilung 7 — Sicherheit, Aufenthaltsrecht, Rückkehr", None),
    ("7.1", "Referat 71 — Sicherheit", "7"),
    ("7.2", "Referat 72 — Aufenthaltsrecht, Rückkehr", "7"),
    ("8", "Abteilung 8 — Integration und gesellschaftlicher Zusammenhalt", None),
    ("8.1", "Referat 81 — Integrationsprogramme", "8"),
    ("8.2", "Referat 82 — Gesellschaftlicher Zusammenhalt", "8"),
    ("9", "Abteilung 9 — Internationale Aufgaben, Grundsatzfragen der Migration, EU-Fondsverwaltung", None),
    ("9.1", "Referat 91 — Internationale Aufgaben", "9"),
    ("9.2", "Referat 92 — EU-Fondsverwaltung", "9"),
    ("FZ", "Forschungszentrum Migration, Integration und Asyl", None),
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


def seed(db: Session) -> None:
    if db.query(Role).first():
        return  # already seeded

    roles = {code: Role(code=code, name=name) for code, name in ROLES}
    db.add_all(roles.values())

    labels = {name: Label(name=name) for name in LABELS}
    db.add_all(labels.values())
    db.flush()

    # ---- BAMF-Orgstruktur (Abteilungen/Referate, hierarchisch) -------------
    departments: dict[str, Department] = {}
    for code, name, parent_code in ORG_UNITS:
        parent = departments[parent_code] if parent_code else None
        dept = Department(code=code, name=name, parent=parent)
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
    db.add_all([seating_std, seating_u, seating_block])

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

    # ---- Haus B: Meetingräume ohne UND mit Genehmigungspflicht -------------
    room_videostudio = Room(floor_id=haus_b_eg.id, room_number="B.01", name="Videostudio B", room_type="meeting",
                             capacity=4, approval_required=False)
    room_kleiner_sitzungsraum = Room(floor_id=haus_b_eg.id, room_number="B.02", name="Kleiner Sitzungsraum",
                                      room_type="meeting", capacity=6, approval_required=False)
    room_muenchen_konferenz = Room(  # zugriffsbeschränkt Beispiel (Rolle statt Org-Einheit)
        floor_id=haus_b_eg.id, room_number="B.03", name="Boardroom Wien", room_type="meeting", capacity=8,
        restricted_role_code="vm",
    )
    db.add_all([room_videostudio, room_kleiner_sitzungsraum, room_muenchen_konferenz])
    db.flush()
    db.add_all([
        RoomLabel(room_id=room_videostudio.id, label_id=labels["Videokonferenz"].id),
        RoomLabel(room_id=room_videostudio.id, label_id=labels["85\" Screen"].id),
        RoomLabel(room_id=room_kleiner_sitzungsraum.id, label_id=labels["Whiteboard"].id),
        RoomLabel(room_id=room_muenchen_konferenz.id, label_id=labels["Videokonferenz"].id),
        RoomLabel(room_id=room_muenchen_konferenz.id, label_id=labels["85\" Screen"].id),
    ])

    # ---- Berlin Außenstelle: 1 Etage mit Desks + Meetingraum ---------------
    room_berlin_team = Room(floor_id=berlin_1og.id, room_number="1.01", name="Team Berlin", room_type="desk_area", pos_x=40, pos_y=40, width=380, height=200)
    room_berlin_meeting = Room(floor_id=berlin_1og.id, room_number="1.02", name="Meetingraum Berlin", room_type="meeting", capacity=12, approval_required=False, pos_x=460, pos_y=40, width=200, height=200)
    db.add_all([room_berlin_team, room_berlin_meeting])
    db.flush()
    berlin_desks = add_desks(room_berlin_team, 8, 70, 90, "BE")
    db.flush()
    _assign_labels_round_robin(db, berlin_desks, label_combos)
    db.add(RoomLabel(room_id=room_berlin_meeting.id, label_id=labels["Videokonferenz"].id))

    # ---- München West: nahezu ausgebucht (4 frei) --------------------------
    room_muc_team = Room(floor_id=muenchen_1og.id, room_number="1.01", name="Team München", room_type="desk_area", pos_x=40, pos_y=40, width=500, height=260)
    db.add(room_muc_team)
    db.flush()
    muc_desks = add_desks(room_muc_team, 20, 70, 90, "M")
    db.flush()
    _assign_labels_round_robin(db, muc_desks, label_combos)

    # ---- Hamburg City: komplett ausgebucht (0 frei), zeigt "keine Treffer" ---
    room_hh_team = Room(floor_id=hamburg_1og.id, room_number="1.01", name="Team Hamburg", room_type="desk_area", pos_x=40, pos_y=40, width=300, height=160)
    db.add(room_hh_team)
    db.flush()
    hh_desks = add_desks(room_hh_team, 6, 70, 90, "H")
    db.flush()
    _assign_labels_round_robin(db, hh_desks, label_combos)

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
    maria = User(idm_code="U-1001", display_name="Dr. Maria Schmidt", email="maria.schmidt@bamf.bund.de",
                 department_id=departments["P.GZ"].id, home_property_id=nuernberg.id, klarname_opt_in=True)
    ali = User(idm_code="U-1002", display_name="Ali Yilmaz", email="ali.yilmaz@bamf.bund.de",
               department_id=departments["2.1"].id, home_property_id=nuernberg.id, home_desk_id=desks_nord[0].id)
    johannes = User(idm_code="U-1003", display_name="Johannes Schneider", email="johannes.schneider@bamf.bund.de",
                    department_id=departments["6.1"].id, home_property_id=nuernberg.id)
    elena = User(idm_code="U-1004", display_name="Elena Petrova", email="elena.petrova@bamf.bund.de",
                 department_id=departments["9.2"].id, home_property_id=berlin.id)
    kessler = User(idm_code="U-1005", display_name="Frau Kessler", email="kessler@bamf.bund.de",
                   department_id=departments["P.PR"].id, home_property_id=berlin.id)
    kaya = User(idm_code="U-1006", display_name="Frau Kaya", email="kaya@bamf.bund.de",
                department_id=departments["P.GZ"].id, home_property_id=nuernberg.id)
    mueller = User(idm_code="U-1007", display_name="Hans Müller", email="hans.mueller@bamf.bund.de",
                   department_id=departments["2.1"].id, home_property_id=nuernberg.id)
    demir = User(idm_code="U-1008", display_name="Herr Demir", email="demir@bamf.bund.de",
                 department_id=departments["P.PR"].id, home_property_id=nuernberg.id)
    ostermann = User(idm_code="U-1009", display_name="Frau Ostermann", email="ostermann@bamf.bund.de",
                     department_id=departments["1.2.1"].id, home_property_id=nuernberg.id)
    brandt = User(idm_code="U-1010", display_name="Herr Brandt", email="brandt@bamf.bund.de",
                  department_id=departments["1.2.1"].id, home_property_id=nuernberg.id, security_clearance="Ue2")
    weber = User(idm_code="U-1011", display_name="Thomas Weber", email="weber@bamf.bund.de",
                 department_id=departments["2.1"].id, home_property_id=nuernberg.id)
    kraus = User(idm_code="U-1012", display_name="Sabine Kraus", email="kraus@bamf.bund.de",
                 department_id=departments["2.1"].id, home_property_id=nuernberg.id)
    fischer = User(idm_code="U-1013", display_name="Julia Fischer", email="fischer@bamf.bund.de",
                   department_id=departments["P.PR"].id, home_property_id=nuernberg.id)
    # Zusätzliche FM-Rolle mit klarem Planungs-Fokus (München West), unabhängig von 12E Nürnberg
    facility_manager_muc = User(idm_code="U-1014", display_name="Herr Wagner", email="wagner@bamf.bund.de",
                                 department_id=departments["1.2.2"].id, home_property_id=muenchen.id)
    # Org-Hierarchie-Demo (Nutzeranforderung): 6 / 6.1 / 6.2 / 6.2.1
    lehmann = User(idm_code="U-1015", display_name="Frau Lehmann", email="lehmann@bamf.bund.de",
                   department_id=departments["6"].id, home_property_id=nuernberg.id)
    kaiser = User(idm_code="U-1016", display_name="Herr Kaiser", email="kaiser@bamf.bund.de",
                  department_id=departments["6.2"].id, home_property_id=nuernberg.id)
    nowak = User(idm_code="U-1017", display_name="Frau Nowak", email="nowak@bamf.bund.de",
                 department_id=departments["6.2.1"].id, home_property_id=nuernberg.id)

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
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
