---
id: "4-3-meetingraum-grundriss-im-fm-designer-und-interaktive-grundri"
title: "Story 4.3: Meetingraum-Grundriss im FM Designer und interaktive Grundriss-Buchung"
epic: 4
story: 3
status: ready-for-dev
created: 2026-09-05
---

# Story 4.3: Meetingraum-Grundriss im FM Designer und interaktive Grundriss-Buchung

## User Story
**Als** Facility Manager und als Mitarbeiter
**möchte ich** Meetingräume im Etagen-Grundriss zeichnen, verwalten und auf dem Raumplan interaktiv buchen können,
**damit** Meetingräume visuell genauso komfortabel wie Arbeitsplätze im Raumplan dargestellt und gebucht werden können.

## Akzeptanzkriterien (Acceptance Criteria)

### AC 1: Meetingraum-Werkzeug im Grundriss-Designer (Facility Management)
- Im `FloorplanDesigner` steht ein neues Werkzeug "Meetingraum" (Typ `meeting_room`) in der Werkzeugleiste zur Verfügung.
- Beim Auswählen des Meetingraum-Werkzeugs erscheint ein Dropdown-Feld mit allen Meetingräumen der aktuell ausgewählten Etage (`r.room_type === "meeting"`).
- Ein Klick auf die SVG-Zeichenfläche platziert den Meetingraum mit Raumbezeichnung und verknüpfter `roomId`.
- Validierung: Ein Meetingraum kann nicht mehrfach auf derselben Etage platziert werden.
- Über das Eigenschaften-Panel rechts können Position (X, Y), Abmessungen (Breite, Höhe) und Beschriftung angepasst oder das Element gelöscht werden.
- Das Speichern persistiert den Grundriss über die bestehende API `/fm/floors/{id}/floorplan-layout`.

### AC 2: Visualisierung im FloorplanCanvas
- `FloorplanCanvas` unterstützt den Objekttyp `meeting_room`.
- Meetingräume werden mit passender Konferenz-Optik (Hintergrund, Rahmen, Raumbezeichnung, Kapazität und Konferenz-Symbol) gerendert.
- Farbliche Statusanzeige analog zu Desks:
  - Frei (grünlich/hell)
  - Belegt (grau/abgedunkelt)
  - Genehmigungspflichtig (Kennzeichnung mit Badge/Farbe)
  - Rollenbeschränkt (gesperrt/dezent)
- Klick auf einen Meetingraum im Grundriss löst ein Callback `onMeetingRoomClick` aus.

### AC 3: Interaktive Grundriss-Ansicht für Meetingräume (`MeetingRooms.tsx`)
- Die Meetingraum-Seite bietet eine Etagen-Auswahl sowie einen Ansichtsumschalter zwischen "Grundriss" und "Liste" (analog zu `TargetedBooking.tsx`).
- Ist für eine Etage ein digitaler Grundriss hinterlegt, können Nutzer die Meetingräume direkt auf dem Grundriss sehen.
- Ein Klick auf einen Meetingraum im Grundriss öffnet das reguläre Buchungs- bzw. Anfragemodal mit Zeitauswahl, Bestuhlungsoptionen und Doppelbuchungsprüfung.

### AC 4: Testabdeckung & Qualitätssicherung
- Unit-Tests verifizieren die Datenstrukturen und API-Funktionalität für Meetingraum-Grundrisse.
- Frontend-Build (`tsc -b && vite build`) kompiliert fehlerfrei.
