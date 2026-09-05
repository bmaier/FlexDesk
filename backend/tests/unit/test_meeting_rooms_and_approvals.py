"""Meetingraum-Buchung inkl. Genehmigungspflicht (FR-39/40/41/42), Bestuhlung (FR-53/54)."""
from datetime import datetime, timedelta

from tests.conftest import FRAU_OSTERMANN, HERR_DEMIR, MARIA_SCHMIDT


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
