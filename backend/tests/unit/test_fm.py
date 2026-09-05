"""Facility-Management: Baumstruktur-CRUD, Sperrung/Zwangsstorno, Zonen, Label-Dubletten."""
from datetime import datetime, timedelta

from tests.conftest import ALI_YILMAZ, HERR_BRANDT, MARIA_SCHMIDT


def test_non_fm_user_cannot_create_property(client, auth_headers):
    headers = auth_headers(ALI_YILMAZ)
    resp = client.post("/api/fm/properties", json={"name": "X", "address": "Y", "lat": 1.0, "lon": 1.0}, headers=headers)
    assert resp.status_code == 403


def test_fm_can_build_full_hierarchy_and_book_a_new_desk(client, auth_headers):
    """Flow 8: FM-Admin richtet eine neue Außenstelle ein."""
    headers = auth_headers(HERR_BRANDT)
    prop = client.post("/api/fm/properties", json={"name": "Außenstelle Leipzig", "address": "Leipzig", "lat": 51.3, "lon": 12.4}, headers=headers)
    assert prop.status_code == 200
    property_id = prop.json()["id"]

    building = client.post(f"/api/fm/properties/{property_id}/buildings", json={"name": "Haus 1"}, headers=headers).json()
    floor = client.post(f"/api/fm/buildings/{building['id']}/floors", json={"name": "1. OG"}, headers=headers).json()
    room = client.post(
        f"/api/fm/floors/{floor['id']}/rooms",
        json={"room_number": "1.01", "name": "Büro Leipzig", "room_type": "desk_area", "label_names": ["Fensterplatz"]},
        headers=headers,
    ).json()
    desk = client.post(f"/api/fm/rooms/{room['id']}/desks", json={"desk_number": "L-01"}, headers=headers).json()

    target_date = (datetime.utcnow() + timedelta(days=1)).date().isoformat()
    booked = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=headers)
    assert booked.status_code == 200, booked.text


def test_creating_building_without_property_fails(client, auth_headers):
    headers = auth_headers(HERR_BRANDT)
    resp = client.post("/api/fm/properties/999999/buildings", json={"name": "Verwaist"}, headers=headers)
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "PROPERTY_REQUIRED"


def test_label_similarity_and_merge(client, auth_headers):
    headers = auth_headers(HERR_BRANDT)
    similar = client.get("/api/fm/labels/similar", params={"name": "Fenster-Platz"}, headers=headers).json()
    assert any(s["label_name"] == "Fensterplatz" for s in similar)

    created = client.post("/api/fm/labels", json={"name": "Fenster-Platz", "force": True}, headers=headers).json()
    catalog_before = client.get("/api/fm/labels/catalog", headers=headers).json()
    canonical = next(l for l in catalog_before if l["name"] == "Fensterplatz")

    merge_resp = client.post(
        "/api/fm/labels/merge",
        json={"source_label_ids": [created["label_id"]], "target_label_id": canonical["id"]},
        headers=headers,
    )
    assert merge_resp.status_code == 200
    catalog_after = client.get("/api/fm/labels/catalog", headers=headers).json()
    assert not any(l["id"] == created["label_id"] for l in catalog_after)


def test_lock_cancels_existing_booking_and_notifies(client, auth_headers):
    ali_headers = auth_headers(ALI_YILMAZ)
    props = client.get("/api/catalog/properties", headers=ali_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=ali_headers).json()
    room_sued = next(r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == "Team Süd")
    desk = room_sued["desks"][-1]

    target_date = (datetime.utcnow() + timedelta(days=5)).date().isoformat()
    booking = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=ali_headers).json()

    brandt_headers = auth_headers(HERR_BRANDT)
    start = datetime.utcnow().date().isoformat() + "T00:00:00"
    lock = client.post(
        "/api/fm/locks",
        json={"entity_type": "desk", "entity_id": desk["id"], "start_at": f"{target_date}T00:00:00",
              "end_at": f"{target_date}T23:59:59", "reason": "Wasserschaden"},
        headers=brandt_headers,
    )
    assert lock.status_code == 200

    refreshed = client.get("/api/bookings/mine?scope=all", headers=ali_headers).json()
    cancelled = next(b for b in refreshed if b["id"] == booking["id"])
    assert cancelled["status"] == "cancelled"
    assert cancelled["cancel_reason"] == "Wasserschaden"

    notifications = client.get("/api/notifications", headers=ali_headers).json()
    assert any(n["type"] == "foreign_cancel" for n in notifications)


def test_force_cancel_requires_reason(client, auth_headers):
    ali_headers = auth_headers(ALI_YILMAZ)
    props = client.get("/api/catalog/properties", headers=ali_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=ali_headers).json()
    room_flex = next(r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == "Flex")
    desk = room_flex["desks"][-1]
    target_date = (datetime.utcnow() + timedelta(days=6)).date().isoformat()
    booking = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=ali_headers).json()

    brandt_headers = auth_headers(HERR_BRANDT)
    empty_reason = client.post(f"/api/fm/bookings/{booking['id']}/force-cancel", json={"reason": ""}, headers=brandt_headers)
    assert empty_reason.status_code == 400

    ok = client.post(f"/api/fm/bookings/{booking['id']}/force-cancel", json={"reason": "Dringender Bedarf"}, headers=brandt_headers)
    assert ok.status_code == 200
    assert ok.json()["status"] == "cancelled"


def test_zone_restricts_booking_to_department_then_dissolves(client, auth_headers):
    brandt_headers = auth_headers(HERR_BRANDT)
    props = client.get("/api/catalog/properties", headers=brandt_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=brandt_headers).json()
    room_ruhezone = next(r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == "Ruhezone")
    desk = room_ruhezone["desks"][-1]

    zone = client.post("/api/fm/zones", json={"property_id": nuernberg["id"], "name": "Referat IT — Nord"}, headers=brandt_headers).json()
    departments = client.get("/api/fm/departments", headers=brandt_headers).json()
    it_dept = next(d for d in departments if d["code"] == "2.1")
    client.post(f"/api/fm/zones/{zone['id']}/departments", json={"department_id": it_dept["id"]}, headers=brandt_headers)
    client.post(f"/api/fm/zones/{zone['id']}/desks", json={"desk_ids": [desk["id"]]}, headers=brandt_headers)

    non_it_headers = auth_headers(MARIA_SCHMIDT)  # department P.GZ, not 2.1
    target_date = (datetime.utcnow() + timedelta(days=7)).date().isoformat()
    blocked = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=non_it_headers)
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "ZONE_RESTRICTED"

    dissolve = client.delete(f"/api/fm/zones/{zone['id']}", headers=brandt_headers)
    assert dissolve.status_code == 200
    now_allowed = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=non_it_headers)
    assert now_allowed.status_code == 200


def test_zone_requires_department_before_resources_are_assigned(client, auth_headers):
    brandt_headers = auth_headers(HERR_BRANDT)
    props = client.get("/api/catalog/properties", headers=brandt_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=brandt_headers).json()
    room = next(r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == "Team Süd")
    zone = client.post("/api/fm/zones", json={"property_id": nuernberg["id"], "name": "Unvollständige Zone"}, headers=brandt_headers).json()

    resp = client.post(f"/api/fm/zones/{zone['id']}/desks", json={"room_ids": [room["id"]]}, headers=brandt_headers)

    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "ZONE_DEPARTMENT_REQUIRED"


def test_zone_room_assignment_restricts_every_desk_to_assigned_department(client, auth_headers):
    brandt_headers = auth_headers(HERR_BRANDT)
    props = client.get("/api/catalog/properties", headers=brandt_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=brandt_headers).json()
    room = next(r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == "Team Süd")
    zone = client.post("/api/fm/zones", json={"property_id": nuernberg["id"], "name": "Team Süd IT"}, headers=brandt_headers).json()
    departments = client.get("/api/fm/departments", headers=brandt_headers).json()
    it_dept = next(d for d in departments if d["code"] == "2.1")
    client.post(f"/api/fm/zones/{zone['id']}/departments", json={"department_id": it_dept["id"]}, headers=brandt_headers)
    assigned = client.post(f"/api/fm/zones/{zone['id']}/desks", json={"room_ids": [room["id"]]}, headers=brandt_headers)
    assert assigned.status_code == 200

    target_date = (datetime.utcnow() + timedelta(days=9)).date().isoformat()
    blocked = client.post("/api/bookings/desks", json={"desk_id": room["desks"][0]["id"], "date": target_date}, headers=auth_headers(MARIA_SCHMIDT))
    allowed = client.post("/api/bookings/desks", json={"desk_id": room["desks"][1]["id"], "date": target_date}, headers=auth_headers(ALI_YILMAZ))
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "ZONE_RESTRICTED"
    assert allowed.status_code == 200


def test_fm_can_save_and_retrieve_digital_floorplan_layout(client, auth_headers):
    headers = auth_headers(HERR_BRANDT)
    props = client.get("/api/catalog/properties", headers=headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=headers).json()
    floor = next(f for b in tree["buildings"] for f in b["floors"] if f["name"] == "1. OG")
    layout = '{"objects":[{"id":"door-1","type":"door","x":10,"y":10,"width":44,"height":12}]}'

    saved = client.put(f"/api/fm/floors/{floor['id']}/floorplan-layout", json={"layout": layout}, headers=headers)
    loaded = client.get(f"/api/fm/floors/{floor['id']}/floorplan-layout", headers=headers)
    refreshed = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=headers).json()

    assert saved.status_code == 200
    assert loaded.json()["layout"] == layout
    refreshed_floor = next(f for b in refreshed["buildings"] for f in b["floors"] if f["id"] == floor["id"])
    assert refreshed_floor["floorplan_layout"] == layout
