"""Core desk/room booking flows: FR-1, FR-3, FR-5a, FR-9/10, FR-11/12, FR-14/15."""
from datetime import datetime, timedelta

from tests.conftest import ALI_YILMAZ, ELENA_PETROVA, FRAU_KAYA, FRAU_KESSLER, HANS_MUELLER, JOHANNES_SCHNEIDER


def _tree_for_nuernberg(client, headers):
    props = client.get("/api/catalog/properties", headers=headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=headers).json()
    return nuernberg, tree


def test_quick_suggestion_returns_home_desk(client, auth_headers):
    headers = auth_headers(ALI_YILMAZ)
    resp = client.get("/api/bookings/quick-suggestion", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["home_desk"] is not None
    assert body["home_desk"]["desk_number"] == "N-01"


def test_desk_booking_and_conflict_then_alternative_suggested(client, auth_headers):
    headers = auth_headers(JOHANNES_SCHNEIDER)
    _, tree = _tree_for_nuernberg(client, headers)
    haus_a = next(b for b in tree["buildings"] if b["name"] == "Haus A")
    floor_1og = next(f for f in haus_a["floors"] if f["name"] == "1. OG")
    room_flex = next(r for r in floor_1og["rooms"] if r["name"] == "Flex")
    desk = room_flex["desks"][0]

    target_date = (datetime.utcnow() + timedelta(days=1)).date().isoformat()
    first = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date, "day_part": "full"}, headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "confirmed"

    other_headers = auth_headers(ELENA_PETROVA)
    second = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date, "day_part": "full"}, headers=other_headers)
    assert second.status_code == 409
    body = second.json()["detail"]
    assert body["code"] == "DESK_CONFLICT"
    assert body["alternative_desk_id"] is not None


def test_cancel_requires_ownership_or_delegation(client, auth_headers):
    headers = auth_headers(HANS_MUELLER)
    _, tree = _tree_for_nuernberg(client, headers)
    room_ruhezone = next(
        r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == "Ruhezone"
    )
    desk = room_ruhezone["desks"][0]
    target_date = (datetime.utcnow() + timedelta(days=2)).date().isoformat()
    created = client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": target_date}, headers=headers)
    booking_id = created.json()["id"]

    stranger_headers = auth_headers(ELENA_PETROVA)
    forbidden = client.post(f"/api/bookings/{booking_id}/cancel", headers=stranger_headers)
    assert forbidden.status_code == 403

    kaya_headers = auth_headers(FRAU_KAYA)  # delegated for Hans Müller (line_org)
    allowed = client.post(f"/api/bookings/{booking_id}/cancel", headers=kaya_headers)
    assert allowed.status_code == 200
    assert allowed.json()["ok"] is True


def test_booking_for_employee_without_delegation_is_rejected(client, auth_headers):
    headers = auth_headers(FRAU_KESSLER)  # no delegation for anyone
    _, tree = _tree_for_nuernberg(client, headers)
    room_flex = next(r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == "Flex")
    desk = room_flex["desks"][1]
    target_date = (datetime.utcnow() + timedelta(days=3)).date().isoformat()
    resp = client.post(
        "/api/bookings/desks",
        json={"desk_id": desk["id"], "date": target_date, "for_user_id": HANS_MUELLER},
        headers=headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "DELEGATION_MISSING"


def test_series_booking_reports_conflicts_and_alternatives(client, auth_headers):
    headers = auth_headers(FRAU_KAYA)
    _, tree = _tree_for_nuernberg(client, headers)
    room_team_sued = next(r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == "Team Süd")
    desk = room_team_sued["desks"][0]

    start_date = (datetime.utcnow() + timedelta(weeks=1)).date().isoformat()
    end_date = (datetime.utcnow() + timedelta(weeks=3)).date().isoformat()
    preview = client.post(
        "/api/bookings/series/preview",
        json={"kind": "desk", "resource_id": desk["id"], "weekdays": [0, 1], "interval": "weekly",
              "start_date": start_date, "end_date": end_date, "for_user_id": HANS_MUELLER},
        headers=headers,
    )
    assert preview.status_code == 200, preview.text
    occurrences = preview.json()["occurrences"]
    assert len(occurrences) >= 1

    resp = client.post(
        "/api/bookings/series",
        json={"kind": "desk", "for_user_id": HANS_MUELLER,
              "occurrences": [{"date": o["date"], "resource_id": o["resource_id"]} for o in occurrences]},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total_attempted"] == len(occurrences)
    assert body["booked"] + len(body["conflicts"]) == body["total_attempted"]

