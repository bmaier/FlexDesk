---
id: "5-2-referatsbezogene-zonen-und-raumkontingente"
title: "Story 5.2: Referatsbezogene Zonen, Raumkontingente und kaskadierende Organisationshierarchie"
epic: 5
story: 2
status: done
created: 2026-09-11
updated: 2026-09-17
---

# Story 5.2: Referatsbezogene Zonen, Raumkontingente und kaskadierende Organisationshierarchie

## User Story
**Als** Facility Manager und Mitarbeiter
**möchte ich** Zonen und Räume Organisationseinheiten zuordnen können, wobei übergeordnete Abteilungen automatisch Zugriff auf Kontingente erhalten und unbefugte Einheiten zuverlässig ausgeschlossen werden,
**damit** referatsspezifische Kontingente (z. B. für Referate 12D, 12E, 12F) geschützt sind und gleichzeitig übergreifende Führungskräfte buchen können.

## Akzeptanzkriterien (Acceptance Criteria)

### AC 1: Zonen- und Kontingentverwaltung im FM
- Facility Manager können im Tab „Zonen & Kontingente“ Zonen definieren und Organisationseinheiten zuweisen.
- Desks und Räume können einer Zone zugeordnet werden.

### AC 2: Kaskadierende Berechtigungsprüfung (`org_hierarchy.py`)
- Buchung von Desks oder Räumen prüft, ob der Buchende zur berechtigten Organisationseinheit oder einer untergeordneten Einheit gehört.
- Ist ein Raum der übergeordneten Abteilung zugewiesen, haben alle Untereinheiten Zugriff.
- Ist ein Raum einer Untereinheit zugewiesen, sind übergeordnete Einheiten und Geschwister-Referate gesperrt.

### AC 3: HTTP 403 `ZONE_RESTRICTED`
- Unberechtigte Buchungsversuche werden mit HTTP 403 `ZONE_RESTRICTED` abgewiesen.
- Im Frontend-Grundriss (`TargetedBooking.tsx`) werden gesperrte Zonenplätze visuell als „Zonen-Kontingent“ gekennzeichnet.

### AC 4: Testabdeckung & Verifikation
- Unit-Tests in `backend/tests/unit/test_unlock_and_org_restriction.py` und `test_org_hierarchy.py` verifizieren die kaskadierende Prüfung vollständig.
