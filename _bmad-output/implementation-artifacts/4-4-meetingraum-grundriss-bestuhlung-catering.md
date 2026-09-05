---
id: "4-4-meetingraum-grundriss-bestuhlung-catering"
title: "Story 4.4: Detaillierter Meetingraum-Grundriss mit automatischer Bestuhlung, Drag & Drop und Catering-Option mit Kostenstellen-Abrechnung & Genehmigungswarnung"
epic: 4
story: 4
status: done
created: 2026-09-05
---

# Story 4.4: Detaillierter Meetingraum-Grundriss mit automatischer Bestuhlung, Drag & Drop und Catering-Option mit Kostenstellen-Abrechnung & Genehmigungswarnung

## User Story
**Als** Facility Manager und buchender Mitarbeiter
**möchte ich** Meetingräume als echte Räume mit automatischer Bestuhlungsanordnung (Konferenztisch, U-Form, Kino, Schulung, Bankett) und allen Stühlen gemäß Raumkapazität planen und per Drag & Drop flexibel nachbearbeiten können; bei der Buchung soll zudem Catering ausgewählt werden können, welches standardmäßig über die Kostenstelle der eigenen Organisationseinheit abgerechnet wird oder bei abweichender Org-Einheit/Kostenstelle eine explizite Genehmigungswarnung mit Bestätigungspflicht verlangt,
**damit** Meetingräume exakt nach realem Bestuhlungsbedarf visualisiert und gebucht werden und die haushaltsrechtliche Abrechnung für Bewirtung transparent und genehmigungskonform erfolgt.

## Akzeptanzkriterien (Acceptance Criteria)

### AC 1: Automatische Bestuhlung & Stuhl-Generierung für Meetingräume
- Neuer Floorplan-Shape-Typ `chair` (Stuhl, 22x22 px mit Rückenlehne).
- Für Meetingräume wird basierend auf `capacity` und der gewählten Bestuhlungsform (`boardroom`, `u_shape`, `cinema`, `classroom`, `banquet`) automatisch ein Grundriss mit Tischen und genau `capacity` vielen Stühlen berechnet.
- Bestuhlungsformen:
  - **Konferenztisch (Boardroom)**: Zentraler Konferenztisch mit umlaufend verteilten Stühlen.
  - **U-Form (U-Shape)**: U-förmig angeordnete Tische mit Stühlen an den Außenseiten und freiem Blick auf Präsentationsfläche.
  - **Kino / Reihen (Cinema)**: Bestuhlte Reihen mit Mittelgang.
  - **Parlamentarisch / Schulung (Classroom)**: Tischreihen mit Blick zur Front und Stühlen dahinter.
  - **Gruppentische (Banquet / Pods)**: Mehrere Inseltische mit je 4-6 Stühlen.
- Die Bestuhlung kann entweder fest vorgegeben sein oder flexibel umgeschaltet werden.

### AC 2: Interaktiver Drag & Drop Editor & Nachbearbeitung
- Im `FloorplanDesigner` können alle Shapes (Tische, Stühle, Desks, Wände, Türen, Fenster, etc.) per Drag & Drop direkt auf dem SVG-Canvas verschoben werden.
- Sanftes Snapping (z. B. 5px Raster) und Begrenzung auf die Zeichenfläche.
- Jeder Grundriss (Etage oder Raum) kann jederzeit geladen, verschoben, editiert, mit weiteren Elementen ergänzt und gespeichert werden.
- Umschalter zwischen Etagen-Grundriss und Raum-/Meetingraum-Grundriss.

### AC 3: Catering-Option bei Meetingraum-Buchung
- Im Meetingraum-Buchungsmodal gibt es eine Option "🍽️ Catering anfragen / buchen".
- Auswahl von Catering-Paketen (z. B. Getränke, Snacks, Business Lunch) und Bemerkungsfeld.
- Abrechnungskonto / Kostenstelle:
  - Default: Kostenstelle der eigenen Organisationseinheit des Buchenden (automatisch ermittelt).
  - Möglichkeit zur Auswahl einer abweichenden Organisationseinheit / Kostenstelle.
- **Genehmigungswarnung:**
  - Bei Wahl einer abweichenden Org-Einheit / Kostenstelle erscheint ein prominenter Warnhinweis:
    *"Achtung: Belastung einer fremden Organisationseinheit / Kostenstelle! Dies ist nur zulässig, wenn eine schriftliche Freigabe oder Budgetgenehmigung der zuständigen Organisationseinheit vorliegt."*
  - Pflicht-Bestätigungs-Checkbox: *"Ich bestätige, dass die erforderliche Freigabe der belasteten Organisationseinheit vorliegt."*
  - Der Buchungs-Button bleibt bis zur Bestätigung deaktiviert.
- Das Backend speichert `has_catering`, `catering_notes`, `cost_center`, `billing_department_id` und prüft die Genehmigungsbestätigung bei Fremdkostenstellen.

### AC 4: Testabdeckung & Verifikation
- Unit-Tests im Backend prüfen die Catering-Buchung, Default-Kostenstelle und Validierung der Fremdkostenstellen-Genehmigung.
- Frontend-Build kompiliert fehlerfrei.
