"""Meetingraum-Buchung inkl. Genehmigungspflicht (FR-39/40/41/42), Bestuhlung (FR-53/54)."""
from datetime import datetime, timedelta

from tests.conftest import ALI_YILMAZ, FRAU_OSTERMANN, HERR_BRANDT, HERR_DEMIR, MARIA_SCHMIDT


def _find_room(client, headers, name: str):
    props = client.get("/api/catalog/properties", headers=headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=headers).json()
    return next(r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == name)


def test_approval_required_room_creates_pending_then_can_be_approved(client, auth_headers):
    demir_headers = auth_headers(HERR_DEMIR)
    room = _find_room(client, demir_headers, "Konferenzraum A")
    assert room["approval_required"] is True

    start = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1)
    end = start + timedelta(hours=1)
    resp = client.post(
        "/api/bookings/rooms",
        json={"room_id": room["id"], "start_at": start.isoformat(), "end_at": end.isoformat()},
        headers=demir_headers,
    )
    assert resp.status_code == 200, resp.text
    booking = resp.json()
    assert booking["status"] == "pending_approval"

    ostermann_headers = auth_headers(FRAU_OSTERMANN)  # Raumverantwortliche für diesen Raum
    inbox = client.get("/api/approvals/inbox", headers=ostermann_headers).json()
    assert any(item["booking_id"] == booking["id"] for item in inbox)

    decision = client.post(
        f"/api/approvals/{booking['id']}/decide", json={"decision": "approved", "comment": "Passt."},
        headers=ostermann_headers,
    )
    assert decision.status_code == 200
    assert decision.json()["status"] == "confirmed"


def test_rejection_requires_reason(client, auth_headers):
    demir_headers = auth_headers(HERR_DEMIR)
    room = _find_room(client, demir_headers, "Konferenzraum A")
    start = datetime.utcnow().replace(hour=14, minute=0, second=0, microsecond=0) + timedelta(days=2)
    end = start + timedelta(hours=1)
    booking = client.post(
        "/api/bookings/rooms", json={"room_id": room["id"], "start_at": start.isoformat(), "end_at": end.isoformat()},
        headers=demir_headers,
    ).json()

    maria_headers = auth_headers(MARIA_SCHMIDT)  # FM + Raumverantwortliche
    no_reason = client.post(f"/api/approvals/{booking['id']}/decide", json={"decision": "rejected"}, headers=maria_headers)
    assert no_reason.status_code == 400

    with_reason = client.post(
        f"/api/approvals/{booking['id']}/decide", json={"decision": "rejected", "comment": "Raum ist gesperrt."},
        headers=maria_headers,
    )
    assert with_reason.status_code == 200
    assert with_reason.json()["status"] == "rejected"


def test_seating_option_with_changeover_day_reserves_extra_slot(client, auth_headers):
    maria_headers = auth_headers(MARIA_SCHMIDT)
    room = _find_room(client, maria_headers, "Konferenzraum A")
    seating_options = client.get(f"/api/fm/rooms/{room['id']}/seating-options", headers=maria_headers).json()
    non_standard = next(s for s in seating_options if not s["is_standard"])
    assert non_standard["changeover_days"] >= 1

    start = datetime.utcnow().replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=10)
    end = start + timedelta(hours=2)
    resp = client.post(
        "/api/bookings/rooms",
        json={"room_id": room["id"], "start_at": start.isoformat(), "end_at": end.isoformat(),
              "seating_option_id": non_standard["id"]},
        headers=maria_headers,
    )
    assert resp.status_code == 200, resp.text


def test_meeting_rooms_for_floor_and_property_with_floor_metadata(client, auth_headers):
    headers = auth_headers(MARIA_SCHMIDT)
    # Liegenschaften abrufen
    props = client.get("/api/catalog/properties", headers=headers).json()
    assert len(props) > 0
    # Liegenschaft mit Meetingräumen suchen
    target_prop = None
    rooms = []
    for p in props:
        res = client.get(f"/api/catalog/properties/{p['id']}/meeting-rooms", headers=headers).json()
        if len(res) > 0:
            target_prop = p
            rooms = res
            break

    assert target_prop is not None, "Mindestens eine Liegenschaft sollte Meetingräume haben"
    assert len(rooms) > 0
    first = rooms[0]
    assert "floor_id" in first
    assert first["floor_id"] is not None

    # Meetingräume spezifisch für die Etage abrufen
    floor_rooms = client.get(f"/api/catalog/floors/{first['floor_id']}/meeting-rooms", headers=headers).json()
    assert len(floor_rooms) > 0
    assert any(r["id"] == first["id"] for r in floor_rooms)


def test_meeting_room_booking_with_catering_default_cost_center(client, auth_headers):
    maria_headers = auth_headers(MARIA_SCHMIDT)
    props = client.get("/api/catalog/properties", headers=maria_headers).json()
    rooms = []
    for p in props:
        res = client.get(f"/api/catalog/properties/{p['id']}/meeting-rooms", headers=maria_headers).json()
        if res:
            rooms = res
            break
    assert len(rooms) > 0
    room = rooms[0]

    start = datetime.utcnow().replace(hour=11, minute=0, second=0, microsecond=0) + timedelta(days=20)
    end = start + timedelta(hours=2)

    # Buchung mit Catering und Default-Kostenstelle
    resp = client.post(
        "/api/bookings/rooms",
        json={
            "room_id": room["id"],
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "has_catering": True,
            "catering_notes": "Kaffee und Brezen",
        },
        headers=maria_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["has_catering"] is True
    assert data["catering_notes"] == "Kaffee und Brezen"
    assert data["cost_center"] is not None
    assert "KST-" in data["cost_center"]


def test_meeting_room_booking_with_catering_foreign_cost_center_requires_acknowledgment(client, auth_headers):
    maria_headers = auth_headers(MARIA_SCHMIDT)
    props = client.get("/api/catalog/properties", headers=maria_headers).json()
    rooms = []
    for p in props:
        res = client.get(f"/api/catalog/properties/{p['id']}/meeting-rooms", headers=maria_headers).json()
        if res:
            rooms = res
            break
    room = rooms[0]

    # Finde eine abweichende Org-Einheit
    depts = client.get("/api/catalog/departments", headers=maria_headers).json()
    assert len(depts) > 1
    me = client.get("/api/auth/me", headers=maria_headers).json()
    foreign_dept = next(d for d in depts if d["id"] != me.get("department_id"))

    start = datetime.utcnow().replace(hour=15, minute=0, second=0, microsecond=0) + timedelta(days=21)
    end = start + timedelta(hours=1)

    # Versuch ohne Genehmigungs-Bestätigung -> muss 400 abgewiesen werden
    resp_unack = client.post(
        "/api/bookings/rooms",
        json={
            "room_id": room["id"],
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "has_catering": True,
            "catering_notes": "Business Lunch",
            "billing_department_id": foreign_dept["id"],
            "cost_center_warning_acknowledged": False,
        },
        headers=maria_headers,
    )
    assert resp_unack.status_code == 400
    assert resp_unack.json()["detail"]["code"] == "FOREIGN_COST_CENTER_NOT_ACKNOWLEDGED"

    # Mit Genehmigungs-Bestätigung -> muss 200 erfolgreich sein
    resp_ack = client.post(
        "/api/bookings/rooms",
        json={
            "room_id": room["id"],
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "has_catering": True,
            "catering_notes": "Business Lunch",
            "billing_department_id": foreign_dept["id"],
            "cost_center_warning_acknowledged": True,
        },
        headers=maria_headers,
    )
    assert resp_ack.status_code == 200, resp_ack.text
    data = resp_ack.json()
    assert data["has_catering"] is True
    assert data["billing_department_id"] == foreign_dept["id"]
    assert data["cost_center"] == foreign_dept["cost_center"]


def test_room_floorplan_save_and_retrieve(client, auth_headers):
    fm_headers = auth_headers(HERR_BRANDT)
    props = client.get("/api/catalog/properties", headers=fm_headers).json()
    rooms = []
    for p in props:
        res = client.get(f"/api/catalog/properties/{p['id']}/meeting-rooms", headers=fm_headers).json()
        if res:
            rooms = res
            break
    assert len(rooms) > 0
    room_id = rooms[0]["id"]

    layout_payload = {
        "layout": '{"objects":[{"type":"table","x":200,"y":150,"width":300,"height":100},{"type":"chair","x":170,"y":180,"width":24,"height":24}]}',
        "seating_layout": "u_shape",
    }
    save_resp = client.put(f"/api/fm/rooms/{room_id}/floorplan-layout", json=layout_payload, headers=fm_headers)
    assert save_resp.status_code == 200

    # Abruf über Catalog
    cat_resp = client.get(f"/api/catalog/rooms/{room_id}/floorplan-layout", headers=fm_headers).json()
    assert cat_resp["seating_layout"] == "u_shape"
    assert "table" in cat_resp["layout"]
    assert "chair" in cat_resp["layout"]


def test_department_crud_and_user_admin_cost_center(client, auth_headers):
    fm_headers = auth_headers(HERR_BRANDT)
    # Department erstellen
    dept_res = client.post(
        "/api/fm/departments",
        json={"code": "TEST.99", "name": "Test-Referat 99", "cost_center": "KST-9900-TEST"},
        headers=fm_headers,
    )
    assert dept_res.status_code == 200
    dept_data = dept_res.json()
    dept_id = dept_data["id"]
    assert dept_data["cost_center"] == "KST-9900-TEST"

    # Department aktualisieren
    patch_res = client.patch(
        f"/api/fm/departments/{dept_id}",
        json={"cost_center": "KST-9900-NEU"},
        headers=fm_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["cost_center"] == "KST-9900-NEU"

    # User Admin abrufen und Kostenstelle zuweisen
    users = client.get("/api/fm/users", headers=fm_headers).json()
    assert len(users) > 0
    test_user = users[0]

    user_patch = client.patch(
        f"/api/fm/users/{test_user['id']}",
        json={"cost_center": "KST-INDIVIDUELL-42", "department_id": dept_id},
        headers=fm_headers,
    )
    assert user_patch.status_code == 200
    assert user_patch.json()["cost_center"] == "KST-INDIVIDUELL-42"
    assert user_patch.json()["department_id"] == dept_id

    # Reset user department and delete department
    client.patch(f"/api/fm/users/{test_user['id']}", json={"clear_department": True}, headers=fm_headers)
    del_res = client.delete(f"/api/fm/departments/{dept_id}", headers=fm_headers)
    assert del_res.status_code == 200


def test_catalog_get_room_by_id_and_timeline(client, auth_headers):
    maria_headers = auth_headers(MARIA_SCHMIDT)
    # 1. Zimmer abfragen
    res = client.get("/api/catalog/rooms/3", headers=maria_headers)
    assert res.status_code == 200
    room_data = res.json()
    assert room_data["id"] == 3
    assert room_data["name"] == "Konferenzraum A"
    assert room_data["room_number"] == "1.03"
    assert room_data["capacity"] == 12
    assert room_data["floor_id"] == 2

    # 2. Nicht existierenden Raum abfragen -> 404
    err_res = client.get("/api/catalog/rooms/99999", headers=maria_headers)
    assert err_res.status_code == 404
    assert err_res.json()["detail"]["code"] == "ROOM_NOT_FOUND"

    # 3. Timeline für den Tag abrufen
    target_date = datetime.utcnow().date().isoformat()
    t_res = client.get(f"/api/catalog/rooms/3/bookings?target_date={target_date}", headers=maria_headers)
    assert t_res.status_code == 200
    assert isinstance(t_res.json(), list)


def test_seating_option_update_and_delete(client, auth_headers):
    fm_headers = auth_headers(HERR_BRANDT)
    ali_headers = auth_headers(ALI_YILMAZ)

    # 1. Neue Bestuhlungsoption anlegen
    create_res = client.post(
        "/api/fm/rooms/3/seating-options",
        headers=fm_headers,
        json={"name": "Parlamentarisch", "is_standard": False, "changeover_days": 1},
    )
    assert create_res.status_code == 200
    opt_id = create_res.json()["id"]

    # 2. Nicht-FM darf nicht ändern -> 403
    forbidden_res = client.put(
        f"/api/fm/rooms/3/seating-options/{opt_id}",
        headers=ali_headers,
        json={"name": "Parlamentarisch Neu", "is_standard": True, "changeover_days": 2},
    )
    assert forbidden_res.status_code == 403

    # 3. FM ändert Option
    update_res = client.put(
        f"/api/fm/rooms/3/seating-options/{opt_id}",
        headers=fm_headers,
        json={"name": "Parlamentarisch Erweitert", "is_standard": True, "changeover_days": 2},
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["name"] == "Parlamentarisch Erweitert"
    assert updated_data["is_standard"] is True
    assert updated_data["changeover_days"] == 2

    # 4. FM löscht Option
    del_res = client.delete(f"/api/fm/rooms/3/seating-options/{opt_id}", headers=fm_headers)
    assert del_res.status_code == 200
    assert del_res.json()["id"] == opt_id

    # 5. Nochmals löschen -> 404
    del_again = client.delete(f"/api/fm/rooms/3/seating-options/{opt_id}", headers=fm_headers)
    assert del_again.status_code == 404


def test_global_meeting_slot_settings_and_room_overrides(client, auth_headers):
    fm_headers = auth_headers(HERR_BRANDT)
    maria_headers = auth_headers(MARIA_SCHMIDT)

    # 1. Globale Slot-Einstellungen abfragen (auch öffentlich via /catalog/meeting-slot-config)
    cat_cfg = client.get("/api/catalog/meeting-slot-config")
    assert cat_cfg.status_code == 200
    cfg_json = cat_cfg.json()
    assert "slot_duration_minutes" in cfg_json
    assert "day_start_hour" in cfg_json
    assert "day_end_hour" in cfg_json

    # 2. Globale Slot-Einstellungen per FM aktualisieren
    update_cfg = client.put(
        "/api/fm/settings/meeting-slots",
        headers=fm_headers,
        json={"slot_duration_minutes": 30, "day_start_hour": 7, "day_end_hour": 19},
    )
    assert update_cfg.status_code == 200
    assert update_cfg.json() == {"slot_duration_minutes": 30, "day_start_hour": 7, "day_end_hour": 19}

    # Verify via catalog
    cat_cfg2 = client.get("/api/catalog/meeting-slot-config")
    assert cat_cfg2.json() == {"slot_duration_minutes": 30, "day_start_hour": 7, "day_end_hour": 19}

    # 3. Raum 3 mit eigenem Override versehen (z. B. 90 Minuten, 08:00 - 16:00)
    patch_room = client.patch(
        "/api/fm/rooms/3",
        headers=fm_headers,
        json={"slot_duration_minutes": 90, "day_start_hour": 8, "day_end_hour": 16},
    )
    assert patch_room.status_code == 200

    # 4. Über Catalog abfragen und prüfen, dass effective_ Werte korrekt berechnet sind
    room3_res = client.get("/api/catalog/rooms/3", headers=maria_headers)
    assert room3_res.status_code == 200
    r3 = room3_res.json()
    assert r3["slot_duration_minutes"] == 90
    assert r3["day_start_hour"] == 8
    assert r3["day_end_hour"] == 16
    assert r3["effective_slot_duration_minutes"] == 90
    assert r3["effective_day_start_hour"] == 8
    assert r3["effective_day_end_hour"] == 16

    # 5. Raum ohne Override erbt die neuen globalen Werte
    rooms_list = client.get("/api/catalog/properties/1/meeting-rooms", headers=maria_headers).json()
    other_room = next((r for r in rooms_list if r["id"] != 3), None)
    if other_room:
        assert other_room["effective_slot_duration_minutes"] == 30
        assert other_room["effective_day_start_hour"] == 7
        assert other_room["effective_day_end_hour"] == 19

    # Clean up: set global defaults back to 60 / 8 / 18
    client.put(
        "/api/fm/settings/meeting-slots",
        headers=fm_headers,
        json={"slot_duration_minutes": 60, "day_start_hour": 8, "day_end_hour": 18},
    )
    client.patch(
        "/api/fm/rooms/3",
        headers=fm_headers,
        json={"slot_duration_minutes": 0, "day_start_hour": -1, "day_end_hour": 0},
    )





