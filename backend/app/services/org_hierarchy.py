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
