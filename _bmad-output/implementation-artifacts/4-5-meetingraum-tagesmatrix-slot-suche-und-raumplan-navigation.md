---
id: "4-5-meetingraum-tagesmatrix-slot-suche-und-raumplan-navigation"
title: "Story 4.5: Meetingraum-Tagesmatrix (08:00–18:00), Zielgerichtete Slot-Y-Suche, SVG-Thumbnails & Nahtloser Etagen-/Raumplan-Drilldown"
epic: 4
story: 5
status: done
created: 2026-09-06
---

# Story 4.5: Meetingraum-Tagesmatrix (08:00–18:00), Zielgerichtete Slot-Y-Suche, SVG-Thumbnails & Nahtloser Etagen-/Raumplan-Drilldown

## User Story
**Als** Mitarbeiter oder Führungskraft, der ein Meeting oder einen Arbeitsplatz buchen möchte,
**möchte ich**
1. Direkt aus dem Etagen-Grundriss in den Raum-Innenplan (Büroraum mit Desks oder Meetingraum) springen können und über klare Navigationsleisten sowie Raumtüren wieder zurück zum Etagenplan gelangen,
2. Beim Buchen von Meetingräumen keine "Raum nicht gefunden"-Fehler erhalten,
3. Auf einen Blick für einen Tag X und einen gesuchten Zeitslot Y alle Meetingräume mit ihrer Live-Verfügbarkeit auf einem Zeitstrahl (08:00–18:00 Uhr) inklusive SVG-Grundriss-Thumbnail und Metadaten sehen können,
4. Mit einem Klick auf "Nur freie Räume anzeigen" die Auswahl filtern und direkt per Klick auf einen freien Slot ohne mühsames Durchklicken buchen können,
**damit** die Raum- und Arbeitsplatzbuchung maximal schnell, übersichtlich und fehlerfrei vonstattengeht.

## Akzeptanzkriterien (Acceptance Criteria)

### AC 1: Nahtlose Navigation zwischen Etagen-Grundriss und Raumplan (Drilldown & Rücksprung)
- Im Etagen-Grundriss (`TargetedBooking`) öffnet der Klick auf eine Büroraum-Fläche sofort den detaillierten Raumplan mit allen Schreibtischen.
- Ein synchroner Layout-Fallback verhindert jegliches Umschalten oder Flackern in die Listenansicht während des Ladens.
- Über dem Grundriss wird ein prominenter Banner eingeblendet:
  `← Zurück zum Etagen-Grundriss ({selectedFloor.name})` inklusive Schnellauswahl für alternative Räume derselben Etage.
- Auch der Klick auf die Raumtür (`door`) im Canvas führt intuitiv zurück zur Etagenübersicht.

### AC 2: Behebung von Meetingraum-Buchungsfehlern (`ROOM_NOT_FOUND`)
- Der Backend-Endpunkt `/api/bookings/rooms` validiert den Raum tolerant und liefert verlässliche Status-Codes.
- Neuer Backend-Endpunkt `GET /api/catalog/rooms/{room_id}` liefert vollständige Meetingraum-Metadaten direkt per ID.
- Das Frontend greift bei der Raumerkennung im Grundriss auf den Catalog-Lookup und Etagen-Stammdaten zu, sodass immer eine gültige ID übermittelt wird.

### AC 3: Zielgerichtete Suche & Tages-Matrix (08:00–18:00 Uhr)
- Die Meetingraum-Übersicht (`MeetingRooms.tsx`) bietet eine direkte Suche:
  - Datumsauswahl (Tag X) mit Schnellwahltasten (`◀`, `Heute`, `Morgen`, `Übermorgen`, `▶`).
  - Zeitslot-Auswahl (Slot Y: von Uhrzeit bis Uhrzeit) mit Schnellauswahl-Presets (`1h (09–10)`, `2h (10–12)`, `Vormittag`, `Nachmittag`).
  - Schalter: *"Nur freie Räume im Slot Y anzeigen"*.
  - Kapazitäts- und Ausstattungsfilter.
- **Tages-Matrix (Timeline):**
  - Jede Zeile repräsentiert einen Meetingraum mit SVG-Thumbnail, Name, Raumnummer, Etage, Kapazität und Labels.
  - 10 Stundenblöcke (08:00 bis 18:00 Uhr):
    - Grün: Frei (mit Hover "+ Buchen")
    - Grau: Belegt (mit Name und Abteilung des Buchenden)
    - Rot: Gesperrt (mit Sperrgrund des FM)
  - Der gesuchte Slot Y wird optisch als hervorgehobene Spalten mit Header-Badge markiert.
  - Klick auf ein beliebiges freies Stundenfeld öffnet das Buchungsmodal sofort mit diesem Zeitraum vorausgefüllt.
  - Schaltfläche "📅 Slot buchen" für 1-Klick-Reservierung des gesuchten Slots Y.

### AC 4: SVG-Grundriss-Thumbnail (`MeetingRoomThumbnail`)
- Maßstabsgetreue SVG-Darstellung der Raumgrenzen, Zimmertür, 85"-Screen/Whiteboard.
- Automatische Visualisierung der Bestuhlung (Konferenztisch mit Stühlen gemäß Kapazität, U-Form, Kino/Theater, Schulung).
- Live-Verfügbarkeits-Badge (`● FREI` bzw. `● BELEGT`).

## Verifikation & Tests
- Backend Unit-Tests in `tests/unit/test_meeting_rooms_and_approvals.py` erweitert und alle 34 Tests bestanden.
- Frontend-Build (`tsc -b && vite build`) ohne Fehler erfolgreich gebaut.
