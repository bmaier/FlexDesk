---
id: "6-2-lock-und-unlock-zyklen"
title: "Story 6.2: Vollständiger Lock- und Unlock-Zyklus für Liegenschaften, Räume und Desks"
epic: 6
story: 2
status: done
created: 2026-09-15
updated: 2026-09-17
---

# Story 6.2: Vollständiger Lock- und Unlock-Zyklus für Liegenschaften, Räume und Desks

## User Story
**Als** Facility Manager
**möchte ich** gesperrte Ressourcen gezielt über ihre Sperrungs-ID wieder entsperren können,
**damit** nach Beendigung von Wartungen oder Renovierungen Arbeitsplätze und Räume sofort wieder buchbar sind.

## Akzeptanzkriterien (Acceptance Criteria)

### AC 1: Entsperr-API (`DELETE /api/fm/locks/{lock_id}`)
- Endpunkt zum sicheren Aufheben einer Sperrung.
- Löschung der Sperrung stellt die Ressource sofort wieder im Buchungspool bereit.

### AC 2: Automatische Stornierung bei Sperrung
- Beim Anlegen einer Sperrung werden kollidierende Buchungen automatisch mit `cancel_kind="locked"` storniert und betroffene Nutzer benachrichtigt.

### AC 3: Unit-Test-Verifikation
- Tests in `backend/tests/unit/test_unlock_and_org_restriction.py` verifizieren den gesamten Zyklus (Sperren, Buchungskollision, Entsperren, erneute erfolgreiche Buchung).
