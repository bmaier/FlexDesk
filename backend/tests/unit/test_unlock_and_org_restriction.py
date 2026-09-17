"""Tests für:
1. Sperrung rückgängig machen (Entsperren / Unlock) für Desks und Meetingräume
2. Org-Zugehörigkeits-Prüfung bei Einzel-, Serien- und Schnellbuchungen
3. Bestuhlungsoptionen & Umbautag-Konfiguration
"""
from datetime import datetime, timedelta

from tests.conftest import ALI_YILMAZ, HERR_BRANDT, MARIA_SCHMIDT


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


def test_desk_lock_and_unlock_cycle(client, auth_headers):
    """FM sperrt einen Desk -> Buchung schlägt mit 409 DESK_LOCKED fehl -> FM entsperrt -> Buchung gelingt."""
    brandt_headers = auth_headers(HERR_BRANDT)
    user_headers = auth_headers(ALI_YILMAZ)
    desk = _find_desk(client, brandt_headers, "N-01")
    target_date = (datetime.utcnow() + timedelta(days=50)).date().isoformat()

    # 1. Sperren
    lock_resp = client.post(
        "/api/fm/locks",
        json={
            "entity_type": "desk",
            "entity_id": desk["id"],
            "start_at": f"{target_date}T00:00:00",
            "end_at": None,
            "reason": "Wartungsarbeiten IT-Kabelkanal",
        },
        headers=brandt_headers,
    )
    assert lock_resp.status_code == 200

    # 2. Buchungsversuch während Sperre muss 409 werfen
    blocked = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=user_headers)
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "DESK_LOCKED"

    # 3. Baum abrufen: Desk muss als is_locked=True markiert sein
    props = client.get("/api/catalog/properties", headers=brandt_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=brandt_headers).json()
    desk_in_tree = next(d for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] for d in r["desks"] if d["id"] == desk["id"])
    assert desk_in_tree["is_locked"] is True
    assert desk_in_tree["lock_reason"] == "Wartungsarbeiten IT-Kabelkanal"

    # 4. Entsperren via POST /api/fm/unlock
    unlock_resp = client.post("/api/fm/unlock", json={"entity_type": "desk", "entity_id": desk["id"]}, headers=brandt_headers)
    assert unlock_resp.status_code == 200
    assert unlock_resp.json()["unlocked_count"] >= 1

    # 5. Baum prüfen: Desk ist wieder entsperrt
    tree_after = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=brandt_headers).json()
    desk_in_tree_after = next(d for b in tree_after["buildings"] for f in b["floors"] for r in f["rooms"] for d in r["desks"] if d["id"] == desk["id"])
    assert desk_in_tree_after["is_locked"] is False

    # 6. Buchung muss nun erfolgreich sein
    allowed = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=user_headers)
    assert allowed.status_code == 200, allowed.text
    client.post(f"/api/bookings/{allowed.json()['id']}/cancel", headers=user_headers)


def test_room_lock_and_unlock_via_lock_id(client, auth_headers):
    """FM sperrt Meetingraum -> Raum als locked in Catalog -> Unlock via DELETE /locks/{id} -> buchbar."""
    brandt_headers = auth_headers(HERR_BRANDT)
    user_headers = auth_headers(ALI_YILMAZ)
    props = client.get("/api/catalog/properties", headers=brandt_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    rooms = client.get(f"/api/catalog/properties/{nuernberg['id']}/meeting-rooms", headers=brandt_headers).json()
    room = rooms[0]
    target_date = (datetime.utcnow() + timedelta(days=51)).date().isoformat()
    start_at = f"{target_date}T10:00:00"
    end_at = f"{target_date}T11:00:00"

    # 1. Sperren
    lock_resp = client.post(
        "/api/fm/locks",
        json={
            "entity_type": "room",
            "entity_id": room["id"],
            "start_at": start_at,
            "end_at": end_at,
            "reason": "Anstricharbeiten",
        },
        headers=brandt_headers,
    )
    assert lock_resp.status_code == 200
    lock_id = lock_resp.json()["id"]

    # 2. Raum in Catalog muss is_locked=True haben
    rooms_during = client.get(f"/api/catalog/properties/{nuernberg['id']}/meeting-rooms", headers=brandt_headers).json()
    locked_room = next(r for r in rooms_during if r["id"] == room["id"])
    assert locked_room["is_locked"] is True
    assert locked_room["lock_reason"] == "Anstricharbeiten"

    # 3. Buchung geblockt
    blocked = client.post("/api/bookings/rooms", json={"room_id": room["id"], "start_at": start_at, "end_at": end_at}, headers=user_headers)
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "ROOM_LOCKED"

    # 4. Entsperren via DELETE /api/fm/locks/{lock_id}
    del_resp = client.delete(f"/api/fm/locks/{lock_id}", headers=brandt_headers)
    assert del_resp.status_code == 200

    # 5. Buchung muss gelingen
    allowed = client.post("/api/bookings/rooms", json={"room_id": room["id"], "start_at": start_at, "end_at": end_at}, headers=user_headers)
    assert allowed.status_code == 200
    client.post(f"/api/bookings/{allowed.json()['id']}/cancel", headers=user_headers)


def test_meeting_room_org_restriction(client, auth_headers):
    """Meetingraum einer Org-Einheit zugewiesen -> Nicht-Angehörige werden mit 403 abgewiesen."""
    brandt_headers = auth_headers(HERR_BRANDT)
    props = client.get("/api/catalog/properties", headers=brandt_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    rooms = client.get(f"/api/catalog/properties/{nuernberg['id']}/meeting-rooms", headers=brandt_headers).json()
    room = rooms[0]

    # Abteilung 6.2 zuweisen
    departments = client.get("/api/fm/departments", headers=brandt_headers).json()
    dept_62 = next(d for d in departments if d["code"] == "6.2")
    client.post(f"/api/fm/rooms/{room['id']}/departments", json={"department_id": dept_62["id"], "include_descendants": False}, headers=brandt_headers)

    target_date = (datetime.utcnow() + timedelta(days=52)).date().isoformat()
    start_at = f"{target_date}T14:00:00"
    end_at = f"{target_date}T15:00:00"

    # Ali Yilmaz (Abteilung 2.1) versucht zu buchen -> 403 NOT_AUTHORIZED_ORG_UNIT
    ali_headers = auth_headers(ALI_YILMAZ)
    blocked = client.post("/api/bookings/rooms", json={"room_id": room["id"], "start_at": start_at, "end_at": end_at}, headers=ali_headers)
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "NOT_AUTHORIZED_ORG_UNIT"

    # Herr Kaiser (Abteilung 6.2) bucht -> 200 OK
    kaiser_id = _user_id(client, "Herr Kaiser")
    kaiser_headers = auth_headers(kaiser_id)
    allowed = client.post("/api/bookings/rooms", json={"room_id": room["id"], "start_at": start_at, "end_at": end_at}, headers=kaiser_headers)
    assert allowed.status_code == 200
    client.post(f"/api/bookings/{allowed.json()['id']}/cancel", headers=kaiser_headers)

    # Zuordnung wieder aufräumen
    client.delete(f"/api/fm/rooms/{room['id']}/departments/{dept_62['id']}", headers=brandt_headers)


def test_meeting_room_sub_unit_allowed_when_descendants_included(client, auth_headers):
    """Raum ist Abteilung 6 zugeordnet mit include_descendants=True -> 6.2 und 6.2.1 dürfen buchen."""
    brandt_headers = auth_headers(HERR_BRANDT)
    props = client.get("/api/catalog/properties", headers=brandt_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    rooms = client.get(f"/api/catalog/properties/{nuernberg['id']}/meeting-rooms", headers=brandt_headers).json()
    room = rooms[0]

    departments = client.get("/api/fm/departments", headers=brandt_headers).json()
    dept_6 = next(d for d in departments if d["code"] == "6")

    # Abteilung 6 zuweisen mit include_descendants=True
    client.post(f"/api/fm/rooms/{room['id']}/departments", json={"department_id": dept_6["id"], "include_descendants": True}, headers=brandt_headers)

    # Prüfen, dass der Katalog die Unter-Einheiten in restricted_department_ids aufschlüsselt
    rooms_catalog = client.get(f"/api/catalog/properties/{nuernberg['id']}/meeting-rooms", headers=brandt_headers).json()
    cat_room = next(r for r in rooms_catalog if r["id"] == room["id"])
    dept_62 = next(d for d in departments if d["code"] == "6.2")
    dept_621 = next(d for d in departments if d["code"] == "6.2.1")
    assert dept_6["id"] in cat_room["restricted_department_ids"]
    assert dept_62["id"] in cat_room["restricted_department_ids"]
    assert dept_621["id"] in cat_room["restricted_department_ids"]

    target_date = (datetime.utcnow() + timedelta(days=53)).date().isoformat()
    start_at = f"{target_date}T10:00:00"
    end_at = f"{target_date}T11:00:00"

    # Frau Nowak (Abteilung 6.2.1 -> Unter-Einheit von 6) versucht zu buchen -> muss 200 sein
    nowak_id = _user_id(client, "Frau Nowak")
    nowak_headers = auth_headers(nowak_id)
    resp = client.post("/api/bookings/rooms", json={"room_id": room["id"], "start_at": start_at, "end_at": end_at}, headers=nowak_headers)
    assert resp.status_code == 200, f"Frau Nowak (6.2.1) should be allowed to book room assigned to 6: {resp.text}"
    client.post(f"/api/bookings/{resp.json()['id']}/cancel", headers=nowak_headers)

    # Ali Yilmaz (Abteilung 2.1) versucht zu buchen -> muss 403 sein
    ali_headers = auth_headers(ALI_YILMAZ)
    blocked = client.post("/api/bookings/rooms", json={"room_id": room["id"], "start_at": start_at, "end_at": end_at}, headers=ali_headers)
    assert blocked.status_code == 403

    client.delete(f"/api/fm/rooms/{room['id']}/departments/{dept_6['id']}", headers=brandt_headers)


def test_desk_in_room_assigned_to_parent_dept_allows_sub_unit(client, auth_headers):
    """Büroraum (desk_area) ist Abteilung 1 zugeordnet -> Unter-Referat 1.2.1 darf Desks buchen."""
    brandt_headers = auth_headers(HERR_BRANDT)
    props = client.get("/api/catalog/properties", headers=brandt_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=brandt_headers).json()
    room_flex = next(r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == "Flex")
    desk = room_flex["desks"][0]

    departments = client.get("/api/fm/departments", headers=brandt_headers).json()
    dept_1 = next(d for d in departments if d["code"] == "1")

    # Dem Flex-Raum Abteilung 1 zuweisen
    client.post(f"/api/fm/rooms/{room_flex['id']}/departments", json={"department_id": dept_1["id"], "include_descendants": True}, headers=brandt_headers)

    target_date = (datetime.utcnow() + timedelta(days=54)).date().isoformat()

    # Frau Ostermann (1.2.1) prüft desk-status -> darf nicht "zone_restricted" sein
    floor = next(f for b in tree["buildings"] for f in b["floors"] if any(r["id"] == room_flex["id"] for r in f["rooms"]))
    floor_id = floor["id"]
    ostermann_id = _user_id(client, "Frau Ostermann")
    ostermann_headers = auth_headers(ostermann_id)

    status_resp = client.get(f"/api/bookings/floors/{floor_id}/desk-status?target_date={target_date}", headers=ostermann_headers)
    assert status_resp.status_code == 200
    desk_stat = next(d for d in status_resp.json() if d["desk_id"] == desk["id"])
    assert desk_stat["status"] != "zone_restricted", f"Status should not be zone_restricted for 1.2.1 under dept 1, got {desk_stat['status']}"

    # Buchen durch Frau Ostermann (1.2.1)
    booking_resp = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=ostermann_headers)
    assert booking_resp.status_code == 200, f"Booking should succeed: {booking_resp.text}"
    client.post(f"/api/bookings/{booking_resp.json()['id']}/cancel", headers=ostermann_headers)

    # Aufräumen
    client.delete(f"/api/fm/rooms/{room_flex['id']}/departments/{dept_1['id']}", headers=brandt_headers)


def test_zone_assigned_to_parent_dept_allows_sub_unit_and_blocks_others(client, auth_headers):
    """Zonenkonzept: Zone ist Abteilung 6 zugeordnet mit include_descendants=True.
    Mitarbeiter aus Unter-Referat 6.2.1 dürfen buchen; Mitarbeiter aus fremder Org (2.1) erhalten zone_restricted & 403."""
    brandt_headers = auth_headers(HERR_BRANDT)
    props = client.get("/api/catalog/properties", headers=brandt_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=brandt_headers).json()
    desk = tree["buildings"][0]["floors"][0]["rooms"][0]["desks"][0]
    floor_id = tree["buildings"][0]["floors"][0]["id"]

    departments = client.get("/api/fm/departments", headers=brandt_headers).json()
    dept_6 = next(d for d in departments if d["code"] == "6")

    # 1. Zone erstellen
    zone_resp = client.post(
        "/api/fm/zones",
        json={"property_id": nuernberg["id"], "name": "Test-Zone Abt 6"},
        headers=brandt_headers,
    )
    assert zone_resp.status_code == 200
    zone_id = zone_resp.json()["id"]

    # 2. Abteilung 6 mit include_descendants=True der Zone zuweisen
    dept_resp = client.post(
        f"/api/fm/zones/{zone_id}/departments",
        json={"department_id": dept_6["id"], "include_descendants": True},
        headers=brandt_headers,
    )
    assert dept_resp.status_code == 200

    # 3. Desk der Zone zuweisen
    desk_resp = client.post(
        f"/api/fm/zones/{zone_id}/desks",
        json={"desk_ids": [desk["id"]]},
        headers=brandt_headers,
    )
    assert desk_resp.status_code == 200

    target_date = (datetime.utcnow() + timedelta(days=55)).date().isoformat()

    # 4. Ali Yilmaz (2.1 - fremde Org) prüft desk-status -> muss zone_restricted sein
    ali_headers = auth_headers(ALI_YILMAZ)
    ali_status = client.get(f"/api/bookings/floors/{floor_id}/desk-status?target_date={target_date}", headers=ali_headers).json()
    ali_desk_stat = next(d for d in ali_status if d["desk_id"] == desk["id"])
    assert ali_desk_stat["status"] == "zone_restricted"

    # Buchungsversuch von Ali Yilmaz schlägt mit 403 fehl
    ali_booking = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=ali_headers)
    assert ali_booking.status_code == 403

    # 5. Frau Nowak (6.2.1 - Unter-Einheit von 6) prüft desk-status -> darf NICHT zone_restricted sein
    nowak_id = _user_id(client, "Frau Nowak")
    nowak_headers = auth_headers(nowak_id)
    nowak_status = client.get(f"/api/bookings/floors/{floor_id}/desk-status?target_date={target_date}", headers=nowak_headers).json()
    nowak_desk_stat = next(d for d in nowak_status if d["desk_id"] == desk["id"])
    assert nowak_desk_stat["status"] != "zone_restricted"

    # Buchungsversuch von Frau Nowak gelingt mit 200
    nowak_booking = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=nowak_headers)
    assert nowak_booking.status_code == 200
    client.post(f"/api/bookings/{nowak_booking.json()['id']}/cancel", headers=nowak_headers)

    # 6. Aufräumen: Zone löschen
    del_resp = client.delete(f"/api/fm/zones/{zone_id}", headers=brandt_headers)
    assert del_resp.status_code == 200

