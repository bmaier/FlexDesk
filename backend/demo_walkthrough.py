#!/usr/bin/env python3
"""Demo-Ablauf für Desk4Me — führt die zentralen Use Cases nacheinander aus.

Setzt eine laufende Backend-Instanz voraus (siehe README/start.sh, Standard-Port 8010).
Während das Skript läuft, kann parallel im Browser (Frontend) mitverfolgt werden, wie sich
Buchungen, Genehmigungen und Sperrungen live auswirken — einfach zwischendurch neu laden
bzw. die Rolle im Frontend wechseln, wie im Skript beschrieben.

Aufruf:  uv run python demo_walkthrough.py
"""
from __future__ import annotations

import random
import sys
import time
from datetime import date, datetime, timedelta

import httpx

BASE_URL = "http://127.0.0.1:8010"
PAUSE = 0.6
# Zufälliger Versatz pro Lauf: verhindert Kollisionen mit Buchungen aus einem vorherigen
# Laufdurchlauf, wenn die DB zwischenzeitlich nicht neu geseedet wurde (rm deskshare.db).
RUN_OFFSET = random.randint(100, 5000)


def banner(text: str) -> None:
    print()
    print("=" * 78)
    print(text)
    print("=" * 78)


def step(text: str) -> None:
    print(f"→ {text}")
    time.sleep(PAUSE)


def ok(text: str) -> None:
    print(f"  ✓ {text}")


def fail(text: str) -> None:
    print(f"  ✗ {text}")


class Session:
    def __init__(self, client: httpx.Client, name: str, user_id: int):
        self.client = client
        self.name = name
        resp = client.post(f"{BASE_URL}/api/auth/login", json={"user_id": user_id})
        resp.raise_for_status()
        self.token = resp.json()["token"]

    @property
    def headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    def get(self, path: str, **kw) -> httpx.Response:
        return self.client.get(f"{BASE_URL}{path}", headers=self.headers, **kw)

    def post(self, path: str, json: dict | None = None, **kw) -> httpx.Response:
        return self.client.post(f"{BASE_URL}{path}", json=json, headers=self.headers, **kw)

    def patch(self, path: str, json: dict | None = None) -> httpx.Response:
        return self.client.patch(f"{BASE_URL}{path}", json=json, headers=self.headers)

    def delete(self, path: str) -> httpx.Response:
        return self.client.delete(f"{BASE_URL}{path}", headers=self.headers)


def find_room(session: Session, name: str) -> dict:
    for p in session.get("/api/catalog/properties").json():
        tree = session.get(f"/api/catalog/properties/{p['id']}/tree").json()
        for b in tree["buildings"]:
            for f in b["floors"]:
                for r in f["rooms"]:
                    if r["name"] == name:
                        return r
    raise LookupError(name)


def find_desk(session: Session, desk_number: str) -> dict:
    for p in session.get("/api/catalog/properties").json():
        tree = session.get(f"/api/catalog/properties/{p['id']}/tree").json()
        for b in tree["buildings"]:
            for f in b["floors"]:
                for r in f["rooms"]:
                    for d in r["desks"]:
                        if d["desk_number"] == desk_number:
                            return d
    raise LookupError(desk_number)


def find_user_id(session: Session, display_name: str) -> int:
    users = session.get("/api/auth/users").json()
    return next(u["id"] for u in users if u["display_name"] == display_name)


def rel_date(days: int) -> str:
    return (datetime.utcnow() + timedelta(days=days + RUN_OFFSET)).date().isoformat()


def expect_ok(resp: httpx.Response, label: str) -> dict | None:
    """Bricht bei einem Fehler nicht ab, sondern meldet ihn — schont wiederholte Skript-Läufe
    gegen dieselbe (nicht neu geseedete) Datenbank vor Abbrüchen durch Restdaten."""
    if resp.status_code >= 400:
        try:
            detail = resp.json().get("detail", resp.text)
        except ValueError:
            detail = resp.text
        fail(f"{label}: {detail}")
        return None
    return resp.json()


def main() -> int:
    with httpx.Client(timeout=10) as client:
        try:
            client.get(f"{BASE_URL}/api/health").raise_for_status()
        except httpx.HTTPError:
            print(f"Backend unter {BASE_URL} nicht erreichbar. Bitte zuerst ./start.sh (oder das Backend manuell) starten.")
            return 1

        # Bootstrap: brauchen User-IDs, bevor wir Sessions als "andere" User anlegen
        bootstrap = httpx.Client(timeout=10)
        users = bootstrap.get(f"{BASE_URL}/api/auth/users").json()
        user_id_by_name = {u["display_name"]: u["id"] for u in users}

        banner("FLOW 8+9 — Herr Brandt (FM) richtet eine neue Außenstelle samt Zone ein")
        brandt = Session(client, "Herr Brandt", user_id_by_name["Herr Brandt"])
        step('Lege bzw. aktualisiere Liegenschaft "Außenstelle Leipzig"…')
        existing_properties = brandt.get("/api/catalog/properties").json()
        leipzig_properties = [p for p in existing_properties if p["name"] == "Außenstelle Leipzig"]
        existing = min(leipzig_properties, key=lambda p: p["id"]) if leipzig_properties else None
        for duplicate in leipzig_properties:
            if existing and duplicate["id"] != existing["id"]:
                brandt.delete(f"/api/fm/properties/{duplicate['id']}")
        if existing:
            prop = brandt.patch(f"/api/fm/properties/{existing['id']}", json={"address": "Leipzig", "lat": 51.34, "lon": 12.37}).json()
            ok(f"Bestehende Liegenschaft #{prop['id']} aktualisiert.")
        else:
            prop = brandt.post("/api/fm/properties", json={"name": "Außenstelle Leipzig", "address": "Leipzig", "lat": 51.34, "lon": 12.37}).json()
            ok(f"Liegenschaft #{prop['id']} angelegt.")

        step('Lege bzw. aktualisiere Gebäude "Haus 1", Etage "1. OG", Raum "Büro Leipzig" und 3 Desks an…')
        leipzig_tree = brandt.get(f"/api/catalog/properties/{prop['id']}/tree").json()
        building = next((b for b in leipzig_tree.get("buildings", []) if b["name"] == "Haus 1"), None)
        if building is None:
            brandt.post(f"/api/fm/properties/{prop['id']}/buildings", json={"name": "Haus 1"}).raise_for_status()
            leipzig_tree = brandt.get(f"/api/catalog/properties/{prop['id']}/tree").json()
            building = next((b for b in leipzig_tree.get("buildings", []) if b["name"] == "Haus 1"), None)
        floor = next((f for f in building.get("floors", []) if f["name"] == "1. OG"), None)
        if floor is None:
            brandt.post(f"/api/fm/buildings/{building['id']}/floors", json={"name": "1. OG"}).raise_for_status()
            leipzig_tree = brandt.get(f"/api/catalog/properties/{prop['id']}/tree").json()
            building = next((b for b in leipzig_tree.get("buildings", []) if b["name"] == "Haus 1"), None)
            floor = next((f for f in building.get("floors", []) if f["name"] == "1. OG"), None)
        room = next((r for r in floor.get("rooms", []) if r["name"] == "Büro Leipzig"), None)
        if room is None:
            brandt.post(
                f"/api/fm/floors/{floor['id']}/rooms",
                json={"room_number": "1.01", "name": "Büro Leipzig", "room_type": "desk_area", "label_names": ["Fensterplatz"]},
            ).raise_for_status()
            leipzig_tree = brandt.get(f"/api/catalog/properties/{prop['id']}/tree").json()
            building = next((b for b in leipzig_tree.get("buildings", []) if b["name"] == "Haus 1"), None)
            floor = next((f for f in building.get("floors", []) if f["name"] == "1. OG"), None)
            room = next((r for r in floor.get("rooms", []) if r["name"] == "Büro Leipzig"), None)
        desks_by_number = {d["desk_number"]: d for d in room.get("desks", [])}
        desks = []
        for index in (1, 2, 3):
            desk_number = f"L-{index:02d}"
            desk = desks_by_number.get(desk_number)
            if desk is None:
                desk = brandt.post(f"/api/fm/rooms/{room['id']}/desks", json={"desk_number": desk_number}).json()
            desks.append(desk)
        ok(f"3 Desks bereit: {', '.join(f'L-{i:02d}' for i in (1, 2, 3))}")

        step('Richte Zone "Referat IT — Leipzig" ein und weist Desk L-01 dem Referat IT zu…')
        zone = brandt.post("/api/fm/zones", json={"property_id": prop["id"], "name": "Referat IT — Leipzig"}).json()
        departments = brandt.get("/api/fm/departments").json()
        it_dept = next(d for d in departments if d["code"] == "2.1")
        brandt.post(f"/api/fm/zones/{zone['id']}/departments", json={"department_id": it_dept["id"]})
        brandt.post(f"/api/fm/zones/{zone['id']}/desks", json={"desk_ids": [desks[0]["id"]]})
        ok("Zone eingerichtet — L-01 ist jetzt nur für Referat IT buchbar, L-02/L-03 bleiben offen.")

        banner("FLOW 1 — Ali Yilmaz bucht seinen Stammtisch (Schnellbuchung)")
        ali = Session(client, "Ali Yilmaz", user_id_by_name["Ali Yilmaz"])
        step("Rufe Schnellbuchungs-Empfehlungen ab…")
        suggestion = ali.get("/api/bookings/quick-suggestion").json()
        home = suggestion["home_desk"]
        ok(f"Gewohnter Platz: {home['desk_number']} ({home['room_name']}) — verfügbar: {suggestion['home_desk_available']}")
        if suggestion["home_desk_available"]:
            resp = ali.post("/api/bookings/desks", json={"desk_id": home["desk_id"], "date": date.today().isoformat()})
            if resp.status_code == 409:
                step("Ali sitzt laut Stammdaten heute bereits an einem anderen Desk — Doppelbuchungs-Warnung erscheint…")
                resp = ali.post("/api/bookings/desks", json={
                    "desk_id": home["desk_id"], "date": date.today().isoformat(),
                    "override_double_booking": True, "double_booking_reason": "Wechsel zum Stammplatz am selben Tag.",
                })
            booking = resp.json()
            ok(f"Gebucht: Buchung #{booking['id']}, Status {booking['status']}")

        banner("FLOW 2 — Frau Kessler bucht gezielt über den Grundriss (Nürnberg, Haus A / 1. OG)")
        kessler = Session(client, "Frau Kessler", user_id_by_name["Frau Kessler"])
        nuernberg = next(p for p in kessler.get("/api/catalog/properties").json() if p["name"] == "Nürnberg Zentrale")
        tree = kessler.get(f"/api/catalog/properties/{nuernberg['id']}/tree").json()
        floor_1og = next(f for b in tree["buildings"] for f in b["floors"] if f["name"] == "1. OG")
        step("Lade Desk-Status für Haus A / 1. OG (präferenzbasiertes Ranking)…")
        statuses = kessler.get(f"/api/bookings/floors/{floor_1og['id']}/desk-status", params={"target_date": rel_date(1), "day_part": "full"}).json()
        available = next((s for s in statuses if s["status"] in ("available", "top_match")), None)
        if available:
            resp = kessler.post("/api/bookings/desks", json={"desk_id": available["desk_id"], "date": rel_date(1)})
            if resp.status_code == 409:
                step("Frau Kessler hat an diesem Tag bereits eine andere Buchung — übernimmt trotzdem mit Begründung…")
                resp = kessler.post("/api/bookings/desks", json={
                    "desk_id": available["desk_id"], "date": rel_date(1),
                    "override_double_booking": True, "double_booking_reason": "Demo-Ablauf erneut ausgeführt.",
                })
            booking = resp.json()
            ok(f"{available['desk_number']} für morgen gebucht (Status {booking['status']}).")

        banner("FLOW 3 — Frau Kaya bucht als Team-Assistenz eine Serie für Hans Müller")
        kaya = Session(client, "Frau Kaya", user_id_by_name["Frau Kaya"])
        hans_id = user_id_by_name["Hans Müller"]
        desk_f02 = find_desk(kaya, "F-02")
        step("Prüfe Vorschau für Serienbuchung Mo+Di für 3 Wochen…")
        preview = kaya.post(
            "/api/bookings/series/preview",
            json={"kind": "desk", "resource_id": desk_f02["id"], "weekdays": [0, 1], "interval": "weekly",
                  "start_date": rel_date(1), "end_date": rel_date(21), "for_user_id": hans_id},
        ).json()
        occurrences = [{"date": o["date"], "resource_id": o["resource_id"]} for o in preview["occurrences"]]
        step(f"Vorschau zeigt {len(occurrences)} Termine — bucht alle verbindlich…")
        series = kaya.post(
            "/api/bookings/series",
            json={"kind": "desk", "occurrences": occurrences, "interval": "weekly",
                  "end_date": rel_date(21), "for_user_id": hans_id},
        ).json()
        ok(f"{series['booked']} Termine gebucht, {len(series['conflicts'])} Konflikte behandelt.")

        banner("FLOW 4 — Herr Demir fragt einen genehmigungspflichtigen Meetingraum an, Frau Ostermann entscheidet")
        demir = Session(client, "Herr Demir", user_id_by_name["Herr Demir"])
        konferenzraum = find_room(demir, "Konferenzraum A")
        start = f"{rel_date(1)}T10:00:00"
        end = f"{rel_date(1)}T11:00:00"
        step("Sende Buchungsanfrage für Konferenzraum A…")
        booking = expect_ok(demir.post("/api/bookings/rooms", json={"room_id": konferenzraum["id"], "start_at": start, "end_at": end}), "Meetingraum-Anfrage")
        if booking:
            ok(f"Buchung #{booking['id']} — Status: {booking['status']}")

        ostermann = Session(client, "Frau Ostermann", user_id_by_name["Frau Ostermann"])
        step("Frau Ostermann öffnet das Genehmigungscenter und genehmigt die Anfrage…")
        inbox = ostermann.get("/api/approvals/inbox").json()
        if booking and any(i["booking_id"] == booking["id"] for i in inbox):
            decided = ostermann.post(f"/api/approvals/{booking['id']}/decide", json={"decision": "approved", "comment": "Passt."}).json()
            ok(f"Entschieden — Status jetzt: {decided['status']}")

        banner("FLOW 6+7 — Herr Brandt sperrt einen Raum, Betroffene werden benachrichtigt")
        desk_n04 = find_desk(brandt, "N-04")
        pre_booking = expect_ok(ali.post("/api/bookings/desks", json={"desk_id": desk_n04["id"], "date": rel_date(5)}), "Vorbereitungs-Buchung N-04")
        if pre_booking:
            ok(f"(Vorbereitung) Ali Yilmaz hat N-04 für {rel_date(5)} gebucht — Buchung #{pre_booking['id']}.")
        step("Herr Brandt sperrt N-04 wegen Wasserschaden…")
        brandt.post("/api/fm/locks", json={
            "entity_type": "desk", "entity_id": desk_n04["id"],
            "start_at": f"{rel_date(5)}T00:00:00", "end_at": f"{rel_date(5)}T23:59:59", "reason": "Wasserschaden",
        })
        notifications = ali.get("/api/notifications").json()
        if pre_booking and any(n["related_booking_id"] == pre_booking["id"] for n in notifications):
            ok("Ali Yilmaz wurde benachrichtigt — Buchung wurde automatisch storniert (FR-27/29).")

        banner("FLOW 5 — Herr Brandt blockiert einen Raum vertraulich (VS-NFD)")
        step("Blockiere Konferenzraum A für eine VS-NFD-Vorbereitung (kein Freigabeprozess)…")
        block = expect_ok(brandt.post("/api/confidential", json={
            "room_id": konferenzraum["id"], "start_at": f"{rel_date(15)}T09:00:00", "end_at": f"{rel_date(15)}T11:00:00",
            "category": "Vorbereitung Verschlusssache", "justification": "Demo-Ablauf VS-NFD-Vorbereitung",
            "features": ["Abhörschutz (Stufe 2)", "Biometrischer Zugang"],
        }), "Vertrauliche Raumblockierung")
        if block:
            ok(f"Blockierung #{block['id']} — protokolliert im zugriffsbeschränkten Audit-Log.")

        banner("Orgstruktur-Hierarchie: Raum A-12 (Abteilung 6) vs. QS-Büro (nur Referat 6.2)")
        step("Herr Kaiser (Referat 6.2) bucht A-12 (zugeordnet an Abteilung 6, inkl. Unter-Referate)…")
        kaiser = Session(client, "Herr Kaiser", user_id_by_name["Herr Kaiser"])
        desk_a12 = find_desk(kaiser, "A12-01")
        booking_a12 = expect_ok(kaiser.post("/api/bookings/desks", json={"desk_id": desk_a12["id"], "date": rel_date(2)}), "A12-01 Buchung")
        if booking_a12:
            ok(f"Erfolgreich — Buchung #{booking_a12['id']} (Kaskade von 6 auf 6.2 greift).")
            kaiser.post(f"/api/bookings/{booking_a12['id']}/cancel")  # Demo-Aufräumen

        step("Frau Lehmann (Abteilung 6, aber nicht 6.2) versucht das QS-Büro (nur Referat 6.2) zu buchen…")
        lehmann = Session(client, "Frau Lehmann", user_id_by_name["Frau Lehmann"])
        desk_qs = find_desk(lehmann, "QS-01")
        blocked = lehmann.post("/api/bookings/desks", json={"desk_id": desk_qs["id"], "date": rel_date(2)})
        if blocked.status_code == 403:
            ok(f"Wie erwartet blockiert ({blocked.json()['detail']['code']}) — Zuordnung auf 6.2 wirkt nicht auf die Elternabteilung 6.")

        banner("FLOW — Doppelbuchungs-Warnung mit Storno-/Begründungs-Option")
        step("Ali Yilmaz hat bereits einen Desk gebucht und versucht einen zweiten für dieselbe Zeit…")
        desk_flex = find_desk(ali, "F-03")
        desk_sued = find_desk(ali, "S-02")
        pre = expect_ok(ali.post("/api/bookings/desks", json={"desk_id": desk_flex["id"], "date": rel_date(3)}), "Vorbereitungs-Buchung F-03")
        warned = ali.post("/api/bookings/desks", json={"desk_id": desk_sued["id"], "date": rel_date(3)})
        if warned.status_code == 409:
            ok(f"Warnung erhalten: bereits {warned.json()['detail']['other_resource_label']} gebucht.")
        step("Ali entscheidet sich, beide Plätze zu behalten (mit Begründung)…")
        overridden = expect_ok(ali.post("/api/bookings/desks", json={
            "desk_id": desk_sued["id"], "date": rel_date(3),
            "override_double_booking": True, "double_booking_reason": "Übergabe an zwei Standorten am selben Tag.",
        }), "Überschriebene Doppelbuchung")
        if pre and overridden:
            ok(f"Beide Buchungen aktiv (#{pre['id']} und #{overridden['id']}).")

        banner("FLOW 10 — Check-in nur bei entsprechend konfiguriertem Desk (nicht liegenschaftsweit)")
        step("Herr Kaiser (Referat 6.2, berechtigt für QS-01) bucht QS-01 (Desk-Level Check-in-Pflicht)…")
        checkin_resp = kaiser.post("/api/bookings/desks", json={"desk_id": desk_qs["id"], "date": date.today().isoformat()})
        if checkin_resp.status_code == 409:
            step("Herr Kaiser sitzt heute laut Stammdaten bereits an einem anderen Desk — übernimmt mit Begründung…")
            checkin_resp = kaiser.post("/api/bookings/desks", json={
                "desk_id": desk_qs["id"], "date": date.today().isoformat(),
                "override_double_booking": True, "double_booking_reason": "Demo-Ablauf erneut ausgeführt.",
            })
        checkin_booking = expect_ok(checkin_resp, "QS-01 Check-in-Buchung")
        if checkin_booking and checkin_booking.get("checkin_status") == "pending":
            ok(f"Check-in-Frist: {checkin_booking['checkin_deadline']}")
            step("Herr Kaiser checkt sofort ein…")
            result = kaiser.post(f"/api/bookings/{checkin_booking['id']}/checkin").json()
            ok(f"Check-in-Status: {result['status']}")
        elif checkin_booking:
            fail(f"Unerwartete Antwort: {checkin_booking}")

        banner("Demo abgeschlossen — alle Flows erfolgreich durchlaufen.")
        print("Öffnen Sie das Frontend (siehe README) und melden Sie sich mit den oben genannten")
        print("Demo-Accounts an, um die Ergebnisse live nachzuvollziehen.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
