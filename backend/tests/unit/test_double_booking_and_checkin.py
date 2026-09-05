"""Doppelbuchungs-Warnung (mit Storno-/Begründungs-Optionen) und Raum-/Desk-Check-in-Konfiguration."""
from datetime import datetime, timedelta

from tests.conftest import ALI_YILMAZ, HERR_BRANDT


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


def test_double_booking_warns_and_can_be_overridden_with_reason(client, auth_headers):
    headers = auth_headers(ALI_YILMAZ)
    desk_flex = _find_desk(client, headers, "F-01")
    desk_ruhe = _find_desk(client, headers, "R-01")
    target_date = (datetime.utcnow() + timedelta(days=40)).date().isoformat()

    first = client.post("/api/bookings/desks", json={"desk_id": desk_flex["id"], "date": target_date}, headers=headers)
    assert first.status_code == 200, first.text

    warned = client.post("/api/bookings/desks", json={"desk_id": desk_ruhe["id"], "date": target_date}, headers=headers)
    assert warned.status_code == 409
    detail = warned.json()["detail"]
    assert detail["code"] == "DOUBLE_BOOKING_WARNING"
    assert detail["other_booking_id"] == first.json()["id"]

    without_reason = client.post(
        "/api/bookings/desks",
        json={"desk_id": desk_ruhe["id"], "date": target_date, "override_double_booking": True},
        headers=headers,
    )
    assert without_reason.status_code == 400
    assert without_reason.json()["detail"]["code"] == "DOUBLE_BOOKING_REASON_REQUIRED"

    with_reason = client.post(
        "/api/bookings/desks",
        json={"desk_id": desk_ruhe["id"], "date": target_date, "override_double_booking": True,
              "double_booking_reason": "Parallele Standortpräsenz für Übergabe."},
        headers=headers,
    )
    assert with_reason.status_code == 200, with_reason.text
    assert with_reason.json()["double_booking_reason"] == "Parallele Standortpräsenz für Übergabe."


def test_double_booking_resolved_by_cancelling_other_booking(client, auth_headers):
    headers = auth_headers(ALI_YILMAZ)
    desk_flex = _find_desk(client, headers, "F-02")
    desk_sued = _find_desk(client, headers, "S-01")
    target_date = (datetime.utcnow() + timedelta(days=41)).date().isoformat()

    first = client.post("/api/bookings/desks", json={"desk_id": desk_flex["id"], "date": target_date}, headers=headers)
    assert first.status_code == 200

    warned = client.post("/api/bookings/desks", json={"desk_id": desk_sued["id"], "date": target_date}, headers=headers)
    assert warned.status_code == 409
    other_id = warned.json()["detail"]["other_booking_id"]

    cancel = client.post(f"/api/bookings/{other_id}/cancel", headers=headers)
    assert cancel.status_code == 200

    retry = client.post("/api/bookings/desks", json={"desk_id": desk_sued["id"], "date": target_date}, headers=headers)
    assert retry.status_code == 200


def test_checkin_only_required_when_room_or_desk_configured(client, auth_headers):
    """Property 'Nürnberg Zentrale' hat Check-in NICHT global aktiv (nur Raum/Desk-Override zählt)."""
    headers = auth_headers(HERR_BRANDT)
    checkin_desk = _find_desk(client, headers, "QS-01")  # explizit checkin_required=True gesät
    normal_desk = _find_desk(client, headers, "A12-01")  # kein Check-in konfiguriert
    target_date = (datetime.utcnow() + timedelta(days=42)).date().isoformat()

    with_checkin = client.post("/api/bookings/desks", json={"desk_id": checkin_desk["id"], "date": target_date}, headers=headers)
    assert with_checkin.status_code == 200, with_checkin.text
    assert with_checkin.json()["checkin_status"] == "pending"

    without_checkin = client.post(
        "/api/bookings/desks",
        json={"desk_id": normal_desk["id"], "date": target_date, "override_double_booking": True,
              "double_booking_reason": "Kurzer Zwischenstopp am anderen Standort."},
        headers=headers,
    )
    assert without_checkin.status_code == 200, without_checkin.text
    assert without_checkin.json()["checkin_status"] is None
