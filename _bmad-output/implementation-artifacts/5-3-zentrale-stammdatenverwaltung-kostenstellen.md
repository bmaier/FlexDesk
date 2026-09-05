---
id: "5-3-zentrale-stammdatenverwaltung-kostenstellen"
title: "Story 5.3: Zentrale Stammdatenverwaltung (Orgeinheiten, Kostenstellen, Benutzer, Liegenschaften, Räume) & Kostenstellen-Zuordnung"
epic: 5
story: 3
status: done
created: 2026-09-05
---

# Story 5.3: Zentrale Stammdatenverwaltung (Orgeinheiten, Kostenstellen, Benutzer, Liegenschaften, Räume) & Kostenstellen-Zuordnung

## User Story
**Als** Administrator und Facility Manager
**möchte ich** über einen separaten Hauptmenüpunkt alle Stammdaten der Organisation an zentraler Stelle einsehen, anlegen, bearbeiten und löschen können, einschließlich der Kostenstellen für Organisationseinheiten und Personen,
**damit** Organisationsstrukturen, Kostenstellen und Raumressourcen konsistent gepflegt werden und alle abhängigen Buchungs- und Abrechnungsprozesse auf validen Daten aufbauen.

## Akzeptanzkriterien (Acceptance Criteria)

### AC 1: Stammdaten-Erweiterung: Organisationseinheiten & Kostenstellen
- Jede Organisationseinheit (`Department`) besitzt ein Pflichtfeld `cost_center` (z. B. `KST-2100-OPS`).
- CRUD-API im Backend (`GET`, `POST`, `PATCH`, `DELETE /api/fm/departments`) zur vollständigen Pflege von Org-Einheiten samt übergeordneter Einheit und Kostenstelle.

### AC 2: Stammdaten-Erweiterung: Personen & Benutzer
- Benutzer (`User`) besitzen eine Zuordnung zur Organisationseinheit und optional eine abweichende Kostenstelle (Default: Kostenstelle der Org-Einheit).
- Verwaltungs-API (`GET`, `PATCH /api/fm/users`) zur Einsicht aller Benutzer und Pflege von Org-Einheit, Kostenstelle, Rollen und Heimat-Standort.

### AC 3: Zentraler Hauptmenüpunkt "Stammdaten"
- Neuer Hauptmenüpunkt **"Stammdaten"** (`/master-data`) in der Hauptnavigation.
- Tab-Übersicht für:
  1. **🏢 Organisationseinheiten**: Tabelle mit Code, Name, Übergeordnete Einheit, Kostenstelle, Aktionen (Neu, Bearbeiten, Löschen).
  2. **👥 Benutzer & Rollen**: Tabelle mit IDM-Code, Name, E-Mail, Org-Einheit, Kostenstelle, Rollen, Aktion (Bearbeiten).
  3. **📍 Liegenschaften & Gebäude**: Standorte, Adressen, Check-in-Konfiguration.
  4. **🚪 Räume & Meetingräume**: Raumnummern, Kapazitäten, Raumtypen, Bestuhlungsart, Genehmigungspflichten.
  5. **🏷️ Merkmale & Labels**: Ausstattungskatalog und Typ-Zuordnungen.

### AC 4: Testabdeckung & Verifikation
- Pytest Unit-Tests prüfen die CRUD-Operationen für Departments und Users mit Kostenstellen.
- Frontend-Build (`tsc -b && vite build`) kompiliert fehlerfrei.
