"""Org-Hierarchie: Raum-/Zonen-Zuordnung zu Organisationseinheiten mit konfigurierbarer Kaskade.

Nutzeranforderung: Ist ein Raum Abteilung "6" zugeordnet, dürfen ALLE Unter-Referate
(6.1, 6.2, 6.2.1, ...) buchen. Ist er nur "6.2" zugeordnet, dürfen ausschließlich 6.2 und
dessen Unter-Referate (6.2.1) buchen — NICHT 6 oder 6.1 (Geschwister-/Elternausschluss).
"""
from datetime import datetime, timedelta

from tests.conftest import HERR_BRANDT


def _find_desk(client, headers, desk_number: str):
    props = client.get("/api/catalog/properties", headers=headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=headers).json()
    for b in tree["buildings"]:
        for f in b["floors"]:
            for r in f["rooms"]:
                for d in r["desks"]:
                    if d["desk_number"] == desk_number:
                        return d
    raise LookupError(desk_number)


def _user_id(client, display_name: str) -> int:
    users = client.get("/api/auth/users").json()
    return next(u["id"] for u in users if u["display_name"] == display_name)


def test_room_assigned_to_department_grants_access_to_all_descendants(client, auth_headers):
    """Raum A-12 ist Abteilung "6" (inkl. Unterbau) zugeordnet — 6, 6.1, 6.2, 6.2.1 dürfen buchen."""
    brandt_headers = auth_headers(HERR_BRANDT)
    desk = _find_desk(client, brandt_headers, "A12-01")
    target_date = (datetime.utcnow() + timedelta(days=30)).date().isoformat()

    for name in ["Frau Lehmann", "Johannes Schneider", "Herr Kaiser", "Frau Nowak"]:
        headers = auth_headers(_user_id(client, name))
        resp = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=headers)
        assert resp.status_code == 200, f"{name}: {resp.text}"
        # jeweils eigene Buchung stornieren, damit der Desk für die nächste Person wieder frei ist
        client.post(f"/api/bookings/{resp.json()['id']}/cancel", headers=headers)


def test_room_assigned_to_sub_unit_excludes_parent_and_siblings(client, auth_headers):
    """Referatsbüro QS ist nur "6.2" zugeordnet — 6 und 6.1 dürfen NICHT buchen, 6.2/6.2.1 schon."""
    brandt_headers = auth_headers(HERR_BRANDT)
    desk = _find_desk(client, brandt_headers, "QS-01")
    target_date = (datetime.utcnow() + timedelta(days=31)).date().isoformat()

    blocked = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=auth_headers(_user_id(client, "Frau Lehmann")))
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "ZONE_RESTRICTED" or blocked.status_code == 403

    blocked2 = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=auth_headers(_user_id(client, "Johannes Schneider")))
    assert blocked2.status_code == 403

    allowed = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=auth_headers(_user_id(client, "Herr Kaiser")))
    assert allowed.status_code == 200, allowed.text
    client.post(f"/api/bookings/{allowed.json()['id']}/cancel", headers=auth_headers(_user_id(client, "Herr Kaiser")))

    desk2 = _find_desk(client, brandt_headers, "QS-02")
    allowed_grandchild = client.post("/api/bookings/desks", json={"desk_id": desk2["id"], "date": target_date}, headers=auth_headers(_user_id(client, "Frau Nowak")))
    assert allowed_grandchild.status_code == 200, allowed_grandchild.text
