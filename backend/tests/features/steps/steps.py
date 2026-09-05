"""Step definitions for all DeskSharing BAMF Gherkin features."""
from __future__ import annotations

from datetime import datetime, timedelta

from behave import given, then, when

from _api import find_desk, find_property_id, find_room_id, headers_for, user_id


def _date(offset_days: int) -> str:
    return (datetime.utcnow() + timedelta(days=offset_days)).date().isoformat()


# ---------------------------------------------------------------------------
# Gemeinsame Schritte
# ---------------------------------------------------------------------------

@given('ich bin angemeldet als "{name}"')
def step_login_as(context, name):
    context.current_user = name
    context.current_headers = headers_for(context, name)


@then('erhalte ich den Fehlercode "{code}"')
def step_check_error_code(context, code):
    assert context.last_response.status_code >= 400, context.last_response.text
    assert context.last_response.json()["detail"]["code"] == code, context.last_response.text


@then('erhält "{name}" den Fehlercode "{code}"')
def step_check_error_code_for(context, name, code):
    assert context.last_response.status_code >= 400, context.last_response.text
    assert context.last_response.json()["detail"]["code"] == code, context.last_response.text


# ---------------------------------------------------------------------------
# Desk-Buchung
# ---------------------------------------------------------------------------

@when("ich die Schnellbuchungs-Empfehlungen abrufe")
def step_quick_suggestion(context):
    context.last_response = context.client.get("/api/bookings/quick-suggestion", headers=context.current_headers)


@then('sollte mein gewohnter Platz "{desk_number}" angezeigt werden')
def step_check_home_desk(context, desk_number):
    body = context.last_response.json()
    assert body["home_desk"]["desk_number"] == desk_number, body


@given('der Arbeitsplatz "{desk_number}" ist für morgen bereits von "{other}" gebucht')
def step_pre_book_desk(context, desk_number, other):
    headers = headers_for(context, other)
    desk = find_desk(context, desk_number, headers)
    resp = context.client.post(
        "/api/bookings/desks",
        json={"desk_id": desk["id"], "date": _date(1), "override_double_booking": True,
              "double_booking_reason": "Test-Vorbedingung: parallele Zweitbuchung."},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text


@when('ich versuche den Arbeitsplatz "{desk_number}" für morgen zu buchen')
def step_try_book_desk_tomorrow(context, desk_number):
    desk = find_desk(context, desk_number, context.current_headers)
    context.last_response = context.client.post(
        "/api/bookings/desks", json={"desk_id": desk["id"], "date": _date(1)}, headers=context.current_headers
    )


@when('ich den Arbeitsplatz "{desk_number}" für in {days:d} Tagen buche')
def step_book_desk_in_n_days(context, desk_number, days):
    desk = find_desk(context, desk_number, context.current_headers)
    context.last_response = context.client.post(
        "/api/bookings/desks", json={"desk_id": desk["id"], "date": _date(days)}, headers=context.current_headers
    )


@when('ich versuche den Arbeitsplatz "{desk_number}" für in {days:d} Tagen zu buchen')
def step_try_book_desk_in_n_days(context, desk_number, days):
    desk = find_desk(context, desk_number, context.current_headers)
    context.last_response = context.client.post(
        "/api/bookings/desks", json={"desk_id": desk["id"], "date": _date(days)}, headers=context.current_headers
    )


@when('ich den Arbeitsplatz "{desk_number}" für in {days:d} Tagen trotz Doppelbuchung mit Begründung "{reason}" buche')
def step_book_desk_override_double_booking(context, desk_number, days, reason):
    desk = find_desk(context, desk_number, context.current_headers)
    context.last_response = context.client.post(
        "/api/bookings/desks",
        json={"desk_id": desk["id"], "date": _date(days), "override_double_booking": True, "double_booking_reason": reason},
        headers=context.current_headers,
    )


@then("es wird mir ein alternativer Arbeitsplatz vorgeschlagen")
def step_check_alternative_suggested(context):
    detail = context.last_response.json()["detail"]
    assert detail.get("alternative_desk_id") is not None, detail


@given('eine Zone "{zone_name}" für die Liegenschaft "{property_name}" existiert')
def step_create_zone(context, zone_name, property_name):
    property_id = find_property_id(context, property_name, context.current_headers)
    resp = context.client.post("/api/fm/zones", json={"property_id": property_id, "name": zone_name}, headers=context.current_headers)
    assert resp.status_code == 200, resp.text
    context.zone_id = resp.json()["id"]


@given('der Arbeitsplatz "{desk_number}" dieser Zone zugewiesen ist mit Referat "{dept_code}"')
def step_assign_zone(context, desk_number, dept_code):
    departments = context.client.get("/api/fm/departments", headers=context.current_headers).json()
    dept = next(d for d in departments if d["code"] == dept_code)
    context.client.post(f"/api/fm/zones/{context.zone_id}/departments", json={"department_id": dept["id"]}, headers=context.current_headers)
    desk = find_desk(context, desk_number, context.current_headers)
    context.client.post(f"/api/fm/zones/{context.zone_id}/desks", json={"desk_ids": [desk["id"]]}, headers=context.current_headers)
    context.zoned_desk_number = desk_number


@when('"{name}" versucht den Arbeitsplatz "{desk_number}" für übermorgen zu buchen')
def step_other_tries_booking(context, name, desk_number):
    headers = headers_for(context, name)
    desk = find_desk(context, desk_number, headers)
    context.last_response = context.client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": _date(2)}, headers=headers)


# ---------------------------------------------------------------------------
# Meetingraum-Buchung / Genehmigung
# ---------------------------------------------------------------------------

@when('ich den Meetingraum "{room_name}" für morgen {start:d} bis {end:d} Uhr anfrage')
def step_request_meeting_room_tomorrow(context, room_name, start, end):
    room_id = find_room_id(context, room_name, context.current_headers)
    day = _date(1)
    resp = context.client.post(
        "/api/bookings/rooms",
        json={"room_id": room_id, "start_at": f"{day}T{start:02d}:00:00", "end_at": f"{day}T{end:02d}:00:00"},
        headers=context.current_headers,
    )
    assert resp.status_code == 200, resp.text
    context.booking_id = resp.json()["id"]


@when('ich den Meetingraum "{room_name}" für übermorgen {start:d} bis {end:d} Uhr anfrage')
def step_request_meeting_room_day_after(context, room_name, start, end):
    room_id = find_room_id(context, room_name, context.current_headers)
    day = _date(2)
    resp = context.client.post(
        "/api/bookings/rooms",
        json={"room_id": room_id, "start_at": f"{day}T{start:02d}:00:00", "end_at": f"{day}T{end:02d}:00:00"},
        headers=context.current_headers,
    )
    assert resp.status_code == 200, resp.text
    context.booking_id = resp.json()["id"]


@then('hat die Buchung den Status "{status}"')
def step_check_booking_status(context, status):
    resp = context.client.get("/api/bookings/mine?scope=all", headers=context.current_headers)
    booking = next(b for b in resp.json() if b["id"] == context.booking_id)
    assert booking["status"] == status, booking


@when('"{name}" die Anfrage genehmigt')
def step_approve(context, name):
    headers = headers_for(context, name)
    context.last_response = context.client.post(f"/api/approvals/{context.booking_id}/decide", json={"decision": "approved"}, headers=headers)


@when('"{name}" versucht die Anfrage ohne Begründung abzulehnen')
def step_reject_without_reason(context, name):
    headers = headers_for(context, name)
    context.last_response = context.client.post(f"/api/approvals/{context.booking_id}/decide", json={"decision": "rejected"}, headers=headers)


@when('"{name}" die Anfrage mit der Begründung "{reason}" ablehnt')
def step_reject_with_reason(context, name, reason):
    headers = headers_for(context, name)
    context.last_response = context.client.post(
        f"/api/approvals/{context.booking_id}/decide", json={"decision": "rejected", "comment": reason}, headers=headers
    )
    assert context.last_response.status_code == 200, context.last_response.text


# ---------------------------------------------------------------------------
# Vertretung / Serienbuchung
# ---------------------------------------------------------------------------

@when('ich versuche für "{name}" einen Arbeitsplatz zu buchen')
def step_try_book_for(context, name):
    target_id = user_id(context, name)
    desk = find_desk(context, "N-01", context.current_headers)
    context.last_response = context.client.post(
        "/api/bookings/desks", json={"desk_id": desk["id"], "date": _date(4), "for_user_id": target_id}, headers=context.current_headers
    )


@when('ich für "{name}" einen Arbeitsplatz für in {days:d} Tagen buche')
def step_book_for(context, name, days):
    target_id = user_id(context, name)
    desk = find_desk(context, "S-01", context.current_headers)
    resp = context.client.post(
        "/api/bookings/desks", json={"desk_id": desk["id"], "date": _date(days), "for_user_id": target_id}, headers=context.current_headers
    )
    assert resp.status_code == 200, resp.text
    context.booking_id = resp.json()["id"]
    context.last_response = resp


@then("ist die Buchung bestätigt")
def step_booking_confirmed(context):
    assert context.last_response.json()["status"] == "confirmed"


@when("ich diese Buchung storniere")
def step_cancel_booking(context):
    context.last_response = context.client.post(f"/api/bookings/{context.booking_id}/cancel", headers=context.current_headers)


@then("ist die Buchung storniert")
def step_booking_cancelled(context):
    assert context.last_response.json()["ok"] is True


@when('ich für "{name}" eine Serienbuchung für Montag und Dienstag über {weeks:d} Wochen anlege')
def step_create_series(context, name, weeks):
    target_id = user_id(context, name)
    desk = find_desk(context, "F-02", context.current_headers)
    start_date = _date(1)
    end_date = _date(weeks * 7)
    preview = context.client.post(
        "/api/bookings/series/preview",
        json={"kind": "desk", "resource_id": desk["id"], "weekdays": [0, 1], "interval": "weekly",
              "start_date": start_date, "end_date": end_date, "for_user_id": target_id},
        headers=context.current_headers,
    )
    assert preview.status_code == 200, preview.text
    occurrences = preview.json()["occurrences"]
    resp = context.client.post(
        "/api/bookings/series",
        json={"kind": "desk", "for_user_id": target_id,
              "occurrences": [{"date": o["date"], "resource_id": o["resource_id"]} for o in occurrences]},
        headers=context.current_headers,
    )
    assert resp.status_code == 200, resp.text
    context.last_response = resp


@then("wurden mehrere Termine erfolgreich gebucht")
def step_check_series_result(context):
    body = context.last_response.json()
    assert body["booked"] > 0, body


# ---------------------------------------------------------------------------
# Facility-Management
# ---------------------------------------------------------------------------

@when('ich die Liegenschaft "{name}" anlege')
def step_create_property(context, name):
    resp = context.client.post("/api/fm/properties", json={"name": name, "address": "Leipzig", "lat": 51.3, "lon": 12.4}, headers=context.current_headers)
    assert resp.status_code == 200, resp.text
    context.new_property_id = resp.json()["id"]


@when('ich darin ein Gebäude "{name}" anlege')
def step_create_building(context, name):
    resp = context.client.post(f"/api/fm/properties/{context.new_property_id}/buildings", json={"name": name}, headers=context.current_headers)
    assert resp.status_code == 200, resp.text
    context.new_building_id = resp.json()["id"]


@when('ich darin eine Etage "{name}" anlege')
def step_create_floor(context, name):
    resp = context.client.post(f"/api/fm/buildings/{context.new_building_id}/floors", json={"name": name}, headers=context.current_headers)
    assert resp.status_code == 200, resp.text
    context.new_floor_id = resp.json()["id"]


@when('ich darin einen Raum "{name}" vom Typ "{room_type}" anlege')
def step_create_room(context, name, room_type):
    resp = context.client.post(
        f"/api/fm/floors/{context.new_floor_id}/rooms",
        json={"room_number": "1.01", "name": name, "room_type": room_type},
        headers=context.current_headers,
    )
    assert resp.status_code == 200, resp.text
    context.new_room_id = resp.json()["id"]


@when('ich darin einen Arbeitsplatz "{desk_number}" anlege')
def step_create_desk(context, desk_number):
    resp = context.client.post(f"/api/fm/rooms/{context.new_room_id}/desks", json={"desk_number": desk_number}, headers=context.current_headers)
    assert resp.status_code == 200, resp.text
    context.new_desk_id = resp.json()["id"]


@then('kann der neue Arbeitsplatz "{desk_number}" gebucht werden')
def step_check_new_desk_bookable(context, desk_number):
    resp = context.client.post(
        "/api/bookings/desks", json={"desk_id": context.new_desk_id, "date": _date(1)}, headers=context.current_headers
    )
    assert resp.status_code == 200, resp.text


@given('ich einen Arbeitsplatz "{desk_number}" für in {days:d} Tagen gebucht habe')
def step_i_have_booked(context, desk_number, days):
    desk = find_desk(context, desk_number, context.current_headers)
    resp = context.client.post("/api/bookings/desks", json={"desk_id": desk["id"], "date": _date(days)}, headers=context.current_headers)
    assert resp.status_code == 200, resp.text
    context.booking_id = resp.json()["id"]


@when('"{name}" diesen Arbeitsplatz mit Begründung "{reason}" sperrt')
def step_lock_desk(context, name, reason):
    headers = headers_for(context, name)
    booking = context.client.get("/api/bookings/mine?scope=all", headers=context.current_headers).json()
    current = next(b for b in booking if b["id"] == context.booking_id)
    desk_number = current["resource_label"].split(" · ")[0]
    desk = find_desk(context, desk_number, headers)
    resp = context.client.post(
        "/api/fm/locks",
        json={"entity_type": "desk", "entity_id": desk["id"], "start_at": _date(0) + "T00:00:00", "end_at": None, "reason": reason},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text


@then('ist meine Buchung storniert mit Begründung "{reason}"')
def step_check_my_booking_cancelled(context, reason):
    rows = context.client.get("/api/bookings/mine?scope=all", headers=context.current_headers).json()
    booking = next(b for b in rows if b["id"] == context.booking_id)
    assert booking["status"] == "cancelled"
    assert booking["cancel_reason"] == reason


@then('ich erhalte eine Benachrichtigung vom Typ "{type_}"')
def step_check_notification(context, type_):
    rows = context.client.get("/api/notifications", headers=context.current_headers).json()
    assert any(n["type"] == type_ for n in rows), rows


@when('ich ein Label "{name}" anlegen möchte')
def step_check_similar_label(context, name):
    context.last_response = context.client.get(f"/api/fm/labels/similar?name={name}", headers=context.current_headers)


@then('wird mir das ähnliche Label "{name}" vorgeschlagen')
def step_similar_label_suggested(context, name):
    suggestions = context.last_response.json()
    assert any(s["label_name"] == name for s in suggestions), suggestions


# ---------------------------------------------------------------------------
# Vertrauliche Raumblockierung
# ---------------------------------------------------------------------------

@when('ich versuche den Raum "{room_name}" vertraulich zu blockieren')
def step_try_confidential_block(context, room_name):
    room_id = find_room_id(context, room_name, context.current_headers)
    context.last_response = context.client.post(
        "/api/confidential",
        json={"room_id": room_id, "start_at": f"{_date(1)}T09:00:00", "end_at": f"{_date(1)}T11:00:00",
              "category": "Sonstiges", "justification": "Test"},
        headers=context.current_headers,
    )


@when('ich den Raum "{room_name}" mit Begründung "{reason}" vertraulich blockiere')
def step_confidential_block(context, room_name, reason):
    room_id = find_room_id(context, room_name, context.current_headers)
    context.last_response = context.client.post(
        "/api/confidential",
        json={"room_id": room_id, "start_at": f"{_date(3)}T09:00:00", "end_at": f"{_date(3)}T11:00:00",
              "category": "Vorbereitung Verschlusssache", "justification": reason},
        headers=context.current_headers,
    )


@then("ist die Blockierung erfolgreich")
def step_block_successful(context):
    assert context.last_response.status_code == 200, context.last_response.text


@then("der Vorgang erscheint im vertraulichen Audit-Log")
def step_check_audit_log(context):
    rows = context.client.get("/api/confidential/audit-log", headers=context.current_headers).json()
    assert len(rows) > 0


@when('ich versuche den Raum "{room_name}" für {hours:d} Stunden vertraulich zu blockieren')
def step_try_long_block(context, room_name, hours):
    room_id = find_room_id(context, room_name, context.current_headers)
    start = datetime.utcnow() + timedelta(days=10)
    end = start + timedelta(hours=hours)
    context.last_response = context.client.post(
        "/api/confidential",
        json={"room_id": room_id, "start_at": start.isoformat(), "end_at": end.isoformat(),
              "category": "Sonstiges", "justification": "zu lang"},
        headers=context.current_headers,
    )
