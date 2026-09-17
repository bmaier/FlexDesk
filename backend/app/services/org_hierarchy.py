"""BAMF-Orgstruktur: Hierarchie-Prüfung für Raum-/Zonen-Zuordnungen zu Organisationseinheiten.

Eine Zuordnung eines Raums/einer Zone zu einer Org-Einheit X gewährt per Default Zugriff für
X und alle untergeordneten Einheiten (Subtree). FM kann dies pro Zuordnung auf "nur X selbst"
einschränken (include_descendants=False) — siehe Nutzeranforderung: "Abteilung 6" -> alle
Unter-Referate buchen dürfen, aber eine Zuordnung zu "Abteilung 6.2" nur 6.2 (und darunter).
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.reference import Department


def ancestor_chain(db: Session, department_id: int | None) -> list[int]:
    """Von der eigenen Einheit bis zur Wurzel, jeweils inklusive."""
    chain: list[int] = []
    current_id = department_id
    seen: set[int] = set()
    while current_id is not None and current_id not in seen:
        seen.add(current_id)
        chain.append(current_id)
        dept = db.get(Department, current_id)
        if dept is None:
            break
        current_id = dept.parent_id
    return chain


def subtree_department_ids(db: Session, department_id: int) -> set[int]:
    """Sammelt die department_id und alle rekursiven Untereinheiten (Subtree)."""
    all_depts = db.query(Department.id, Department.parent_id).all()
    children_by_parent: dict[int, list[int]] = {}
    for did, pid in all_depts:
        if pid is not None:
            children_by_parent.setdefault(pid, []).append(did)

    result: set[int] = {department_id}
    queue = [department_id]
    while queue:
        cur = queue.pop(0)
        for child_id in children_by_parent.get(cur, []):
            if child_id not in result:
                result.add(child_id)
                queue.append(child_id)
    return result


def effective_room_department_ids(db: Session, room_id: int) -> list[int]:
    """Liefert alle effektiven Department-IDs für einen Raum (unter Berücksichtigung von include_descendants)."""
    from app.models.structure import RoomDepartment

    room_depts = db.query(RoomDepartment).filter(RoomDepartment.room_id == room_id).all()
    if not room_depts:
        return []
    allowed: set[int] = set()
    for rd in room_depts:
        if rd.include_descendants:
            allowed.update(subtree_department_ids(db, rd.department_id))
        else:
            allowed.add(rd.department_id)
    return sorted(allowed)


def effective_zone_department_ids(db: Session, zone_id: int) -> list[int]:
    """Liefert alle effektiven Department-IDs für eine Zone (unter Berücksichtigung von include_descendants)."""
    from app.models.structure import ZoneDepartment

    zone_depts = db.query(ZoneDepartment).filter(ZoneDepartment.zone_id == zone_id).all()
    if not zone_depts:
        return []
    allowed: set[int] = set()
    for zd in zone_depts:
        if zd.include_descendants:
            allowed.update(subtree_department_ids(db, zd.department_id))
        else:
            allowed.add(zd.department_id)
    return sorted(allowed)


def is_authorized(db: Session, user_department_id: int | None, assigned_department_id: int, include_descendants: bool = True) -> bool:
    """Ist ein Nutzer (über seine Org-Einheit) für eine Zuordnung an assigned_department_id berechtigt?"""
    if user_department_id is None:
        return False
    if user_department_id == assigned_department_id:
        return True
    if not include_descendants:
        return False
    # Nutzer ist berechtigt, wenn die zugeordnete Einheit ein Vorfahre der eigenen Einheit ist
    # (d.h. der Nutzer sitzt in einem Unter-Referat der zugeordneten Einheit).
    return assigned_department_id in ancestor_chain(db, user_department_id)


def is_desk_authorized_for_user(db: Session, desk_id: int, user_id: int, is_fm: bool = False) -> tuple[bool, str | None]:
    """Prüft, ob der Nutzer (über seine Org-Einheit) den Desk buchen darf.
    Berücksichtigt Zonen-Zuordnungen (ZoneDepartment) und Raum-Zuordnungen (RoomDepartment) sowie Rollen.
    """
    from app.models.reference import User
    from app.models.structure import Desk, Room, RoomDepartment, ZoneDepartment, ZoneDesk

    user = db.get(User, user_id)
    if not user:
        return False, "Benutzer nicht gefunden."
    desk = db.get(Desk, desk_id)
    if not desk:
        return False, "Arbeitsplatz nicht gefunden."

    # 1. Zonen-Einschränkungen (ZoneDesk -> ZoneDepartment): strikt für alle
    zone_links = db.query(ZoneDesk).filter(ZoneDesk.desk_id == desk.id).all()
    for zl in zone_links:
        zone_depts = db.query(ZoneDepartment).filter(ZoneDepartment.zone_id == zl.zone_id).all()
        if zone_depts and not any(is_authorized(db, user.department_id, zd.department_id, zd.include_descendants) for zd in zone_depts):
            return False, "Dieser Arbeitsplatz ist einem Referats-Kontingent vorbehalten."

    # 2. Raum-Einschränkungen (RoomDepartment): für Mitarbeiter verbindlich (FM-Rolle ausgenommen)
    room = db.get(Room, desk.room_id)
    if room:
        room_depts = db.query(RoomDepartment).filter(RoomDepartment.room_id == room.id).all()
        if room_depts and not is_fm:
            if not any(is_authorized(db, user.department_id, rd.department_id, rd.include_descendants) for rd in room_depts):
                return False, "Dieser Arbeitsplatz ist bestimmten Organisationseinheiten vorbehalten."

        if room.restricted_role_code and not is_fm:
            user_roles = [r.code for r in user.roles]
            if room.restricted_role_code not in user_roles:
                return False, f"Dieser Raum erfordert die Berechtigung '{room.restricted_role_code}'."

    return True, None


def is_room_authorized_for_user(db: Session, room_id: int, user_id: int) -> tuple[bool, str | None]:
    """Prüft, ob der Nutzer (über seine Org-Einheit) den Meetingraum buchen darf.
    Berücksichtigt Raum-Zuordnungen (RoomDepartment) und restricted_role_code.
    """
    from app.models.reference import User
    from app.models.structure import Room, RoomDepartment

    user = db.get(User, user_id)
    if not user:
        return False, "Benutzer nicht gefunden."
    room = db.get(Room, room_id)
    if not room:
        return False, "Raum nicht gefunden."

    # 1. Raum-Zuordnung zu Org-Einheiten
    room_depts = db.query(RoomDepartment).filter(RoomDepartment.room_id == room.id).all()
    if room_depts and not any(is_authorized(db, user.department_id, rd.department_id, rd.include_descendants) for rd in room_depts):
        return False, "Dieser Raum ist bestimmten Organisationseinheiten vorbehalten."

    # 2. Rollen-Einschränkung
    if room.restricted_role_code:
        user_roles = [r.code for r in user.roles]
        if room.restricted_role_code not in user_roles:
            return False, f"Dieser Raum erfordert die Berechtigung '{room.restricted_role_code}'."

    return True, None

