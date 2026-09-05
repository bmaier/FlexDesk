"""Meetingraum-Buchung inkl. Genehmigungspflicht (FR-39/40/41/42), Bestuhlung (FR-53/54)."""
from datetime import datetime, timedelta

from tests.conftest import FRAU_OSTERMANN, HERR_BRANDT, HERR_DEMIR, MARIA_SCHMIDT


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



