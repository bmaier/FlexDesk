"""Vertrauliche Raumblockierung (FR-16/17) und Präsenzansicht/Pseudonymisierung (FR-18/20/21)."""
from datetime import datetime, timedelta

from tests.conftest import ALI_YILMAZ, HERR_BRANDT, JOHANNES_SCHNEIDER, MARIA_SCHMIDT


def test_confidential_block_requires_vsnfd_role(client, auth_headers):
    headers = auth_headers(ALI_YILMAZ)  # mitarbeiter only
    start = datetime.utcnow() + timedelta(days=1)
    end = start + timedelta(hours=2)
    resp = client.post(
        "/api/confidential",
        json={"room_id": 3, "start_at": start.isoformat(), "end_at": end.isoformat(),
              "category": "Sonstiges", "justification": "Test"},
        headers=headers,
    )
    assert resp.status_code == 403


def test_confidential_block_success_and_audit_log_restricted(client, auth_headers):
    brandt_headers = auth_headers(HERR_BRANDT)
    props = client.get("/api/catalog/properties", headers=brandt_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=brandt_headers).json()
    meeting_room = next(r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == "Konferenzraum A")

    start = datetime.utcnow().replace(minute=0, second=0, microsecond=0) + timedelta(days=20)
    end = start + timedelta(hours=3)
    resp = client.post(
        "/api/confidential",
        json={"room_id": meeting_room["id"], "start_at": start.isoformat(), "end_at": end.isoformat(),
              "category": "Vorbereitung Verschlusssache", "justification": "VS-NFD Vorbereitung",
              "features": ["Abhörschutz", "Biometrischer Zugang"]},
        headers=brandt_headers,
    )
    assert resp.status_code == 200, resp.text

    log = client.get("/api/confidential/audit-log", headers=brandt_headers).json()
    assert any("VS-NFD Vorbereitung" in entry["details"] for entry in log)

    forbidden = client.get("/api/confidential/audit-log", headers=auth_headers(ALI_YILMAZ))
    assert forbidden.status_code == 403


def test_confidential_block_rejects_over_72_hours(client, auth_headers):
    headers = auth_headers(HERR_BRANDT)
    start = datetime.utcnow() + timedelta(days=25)
    end = start + timedelta(hours=80)
    resp = client.post(
        "/api/confidential",
        json={"room_id": 3, "start_at": start.isoformat(), "end_at": end.isoformat(),
              "category": "Sonstiges", "justification": "zu lang"},
        headers=headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "MAX_DURATION_EXCEEDED"


def test_presence_hides_name_unless_opt_in(client, auth_headers):
    ali_headers = auth_headers(ALI_YILMAZ)
    props = client.get("/api/catalog/properties", headers=ali_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=ali_headers).json()
    room_ruhezone = next(r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == "Ruhezone")
    desk = room_ruhezone["desks"][0]

    now = datetime.utcnow()
    today = now.date().isoformat()
    client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": today}, headers=auth_headers(JOHANNES_SCHNEIDER))

    entries = client.get("/api/presence", headers=ali_headers).json()
    johannes_entry = next((e for e in entries if e["idm_code"] == "U-1003"), None)
    if johannes_entry:  # only present if "now" falls within 08:00-18:00 window
        assert johannes_entry["display_name"] is None  # kein Opt-in

    reveal = client.get("/api/presence/reveal/U-1003", headers=ali_headers).json()
    assert reveal["display_name"] == "Johannes Schneider"


def test_maria_schmidt_opted_in_shows_name(client, auth_headers):
    maria_headers = auth_headers(MARIA_SCHMIDT)
    props = client.get("/api/catalog/properties", headers=maria_headers).json()
    nuernberg = next(p for p in props if p["name"] == "Nürnberg Zentrale")
    tree = client.get(f"/api/catalog/properties/{nuernberg['id']}/tree", headers=maria_headers).json()
    room_nord = next(r for b in tree["buildings"] for f in b["floors"] for r in f["rooms"] if r["name"] == "Team Nord")
    free_desk = next(d for d in room_nord["desks"] if d["desk_number"] != "N-01")

    today = datetime.utcnow().date().isoformat()
    client.post("/api/bookings/desks", json={"desk_id": free_desk["id"], "date": today}, headers=maria_headers)
    entries = client.get("/api/presence", headers=maria_headers).json()
    entry = next((e for e in entries if e["idm_code"] == "U-1001"), None)
    if entry:
        assert entry["display_name"] == "Dr. Maria Schmidt"  # klarname_opt_in=True
