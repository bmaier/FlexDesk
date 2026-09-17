---
name: 'Desk4Me'
type: architecture-spine
purpose: build-substrate
altitude: initiative
paradigm: 'Hierarchical Domain-Driven Clean Architecture (FastAPI + React/TS)'
scope: 'Desk4Me (BAMF) — Release 1 (5-Ebenen-Hierarchie, 2-Stufen-Grundrisse, Desk-/Meetingraum-Buchung, Bestuhlungsvarianten & Drag-Drop, Catering-Kostenstellenabrechnung, FM-State-Management, Zonen, Org-Hierarchie-Kaskade, Lock/Unlock-Zyklen, Check-in, Barrierefreiheit)'
status: active
license: 'GNU AGPL-3.0 (Berthold Maier)'
created: '2026-09-02'
updated: '2026-09-17'
binds: []
sources:
  - ../../prds/prd-DeskSharing-2026-08-13/prd.md
  - ../../prds/prd-DeskSharing-2026-08-13/addendum.md
  - ../../ux-designs/ux-DeskSharing-2026-08-14/DESIGN.md
  - ../../ux-designs/ux-DeskSharing-2026-08-14/EXPERIENCE.md
  - ../../../../docs/ANFORDERUNGSPRUEFUNG-FACHBEREICHE.md
companions: []
---

# Architecture Spine — Desk4Me (BAMF Workspace Management)

## Design Paradigm

Das System folgt einer strikten 5-Ebenen-Hierarchie für Raumressourcen und trennt die Visualisierung in ein Zwei-Stufen-Grundrissmodell (Etagen-Ebene vs. Raum-Innenebene).
Frontend und Backend kommunizieren zustandslos über RESTful APIs, während das Frontend im Facility Management (FM) und in der Buchungsstrecke persistentes State-Management (SessionStorage und reaktiven State) bereitstellt, um Tab- und Navigationswechsel nahtlos ohne Datenverlust zu ermöglichen.

---

## 1. 5-Ebenen-Stammdaten-Hierarchie

Die Ressourcen- und Organisationsstruktur ist streng hierarchisch aufgebaut:

```
Liegenschaft (Property)
 └── Gebäude (Building)
      └── Etage (Floor)
           └── Raum (Room: room_type = 'desk_area' | 'meeting')
                ├── Desk / Arbeitsplatz (Desk) [bei desk_area]
                │    └── Ausstattung / Labels (Monitor, Stehpult, etc.)
                └── Bestuhlung & Möbel (SeatingOption / Layout) [bei meeting]
```

### Relationale Invarianten:
1. **Liegenschaft (Property)**: Zentraler Standort mit Geo-Koordinaten (`lat`/`lon`), Check-in-Richtlinie und Adresse.
2. **Gebäude (Building)**: Gehört zwingend zu genau einer Liegenschaft (`property_id`).
3. **Etage (Floor)**: Gehört zwingend zu genau einem Gebäude (`building_id`). Trägt optional ein Hintergrundbild (`floorplan_image_path`) und das strukturierte Etagen-Layout (`floorplan_layout` JSON).
4. **Raum (Room)**: Gehört zwingend zu genau einer Etage (`floor_id`). Besitzt Raumtyp (`desk_area` für Arbeitsplatzräume oder `meeting` für Besprechungs-/Konferenzräume), Kapazität, Geometrie auf der Etage (`pos_x`, `pos_y`, `width`, `height`) und ein eigenes Innenraum-Layout (`floorplan_layout` JSON).
5. **Desks / Möbel**: Arbeitsplätze gehören zu einem Raum (`room_id`). Ein Desk darf niemals direkt einer Etage ohne Raum zugeordnet sein. In Meetingräumen wird die Bestuhlung über Stühle und Tische im Raum-Innenlayout sowie konfigurierbare `SeatingOption` abgebildet.

---

## 2. Zwei-Stufen-Grundriss-Architektur (Two-Tier Layout)

Zur Vermeidung unübersichtlicher Mischpläne trennt das System sauber zwischen Etagen- und Raum-Ebene:

### Stufe 1: Etagen-Grundriss (`Floor.floorplan_layout`)
- **Fokus**: Räume als abgeschlossene Einheiten, Flure, Wände, Türen und allgemeine Infrastruktur (Treppenhäuser, Fahrstühle, WCs, Teeküchen).
- **Elemente**:
  - `rooms`: Array von Raum-Shape-Objekten mit `id`, `number`, `name`, `room_type`, `x`, `y`, `width`, `height`, `fill_color`, `wall_color`.
  - `infrastructure`: Array von Elementen mit `id`, `type` (`stairs`, `elevator`, `restroom`, `kitchen`, `door`, `window`, `wall`), Koordinaten und Beschriftung.
- **Interaktion**:
  - Im FM: Räume und Infrastruktur per Drag & Drop verschieben, skalieren, Wände/Türen platzieren.
  - In der Buchungsansicht: Klick auf einen Raum öffnet drill-down in den Raum-Innenplan.

### Stufe 2: Raum-Innenplan (`Room.floorplan_layout`)
- **Fokus**: Die eigentliche Inneneinrichtung des konkreten Raums.
- **Elemente**:
  - Für **Arbeitsbereich (`desk_area`)**:
    - Verknüpfte Schreibtische (`desks` mit `id`, `desk_number`, `x`, `y`, `width`, `height`, Status, Ausstattung).
    - Zusätzliche Büromöbel (`furniture` wie Schränke, Bürostühle, Whiteboards, Pflanzen, Trennwände).
  - Für **Meetingräume (`meeting`)**:
    - Konferenztische und Stühle (`furniture` Typen: `meeting_table`, `chair`, `screen`, `whiteboard`, `speaker_desk`).
    - Automatische Generierung der Stühle entsprechend der Raumkapazität passend zum Bestuhlungstyp (`boardroom`, `u_shape`, `block`, `theater`, `classroom`, `circle`).
    - Vollständige Drag & Drop Bearbeitbarkeit aller Stühle und Tische im FM-Designer.

---

## 3. Meetingraum-Planung & Buchungslogik mit Catering

### Bestuhlungs-Konfigurationen (`SeatingOption`):
- Meetingräume bieten wählbare Bestuhlungsformen:
  - **Standard / Konferenz (Boardroom)**: Großer Tisch in der Mitte, Stühle drumherum.
  - **U-Form**: Tische und Stühle im U angeordnet mit Blick auf Präsentationsfläche.
  - **Blockbestuhlung**: Geschlossener Tischblock.
  - **Theater / Kino**: Reihenbestuhlung ohne Tische für maximale Kapazität.
  - **Parlamentarisch / Schulung**: Tischreihen mit Blick nach vorne.
  - **Stuhlkreis**: Kreis ohne Tische für Workshops und agile Runden.
- Jede Bestuhlungsoption definiert optional Rüstzeiten (`changeover_days`), die im Buchungskalender automatisch blockiert werden.

### Catering-Abrechnung & Kostenstellen-Invariante:
1. **Standardfall**: Catering wird über die Kostenstelle der eigenen Organisationseinheit des Buchenden (`User.cost_center` bzw. `Department.cost_center`) abgerechnet.
2. **Abweichende Kostenstelle**:
   - Gibt der Buchende eine abweichende Kostenstelle an oder wählt eine fremde Org-Einheit, erzwingt das Backend und Frontend eine explizite Genehmigungswarnung (`cost_center_warning_acknowledged=True`).
   - Ohne diese Bestätigung wird die Buchung mit HTTP 422 abgelehnt.
   - Die hinterlegte Kostenstelle wird im Buchungsdatensatz unveränderlich protokolliert.

---

## 4. State-Management & Navigation im Facility Management

### Rehydrierbarer FM-State (`fm_navigation_state`):
- Um beim Wechsel zwischen den FM-Tabs (**Liegenschaften & Räume**, **Etagen-Grundriss**, **Raum-Innenplan**, **Zonen & Kontingente**, **Stammdaten**) den Arbeitskontext nicht zu verlieren, hält das Frontend den Navigationszustand synchronisiert:
  - `selectedPropertyId`
  - `selectedBuildingId`
  - `selectedFloorId`
  - `selectedRoomId`
  - `activeTab`
  - Filter- und Zoom-/Pan-Zustände
- Der Zustand wird reaktiv im lokalen Zustand gehalten und in `sessionStorage` persistiert.
- Bei Rückkehr in einen Tab oder nach Neuanlage von Etagen/Räumen werden Dropdowns, Listen und Canvas-Pläne automatisch aktualisiert, ohne dass ein Browser-Reload erforderlich ist.

---

## 5. Rollen- und Rechte-Matrix (BAMF Governance)

| Rolle | Liegenschaft/Etage anlegen | Grundriss zeichnen | Desks/Möbel platzieren | Meeting buchen | Catering buchen | Buchung genehmigen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `fm` (Facility Manager) | Ja | Ja | Ja | Ja | Ja | Ja (global) |
| `raumverantwortlicher` | Nein | Nein | Nein | Ja | Ja | Ja (zugewiesene Räume) |
| `team_assistenz` | Nein | Nein | Nein | Ja (für Dritte) | Ja | Nein |
| `mitarbeiter` | Nein | Nein | Nein | Ja (Self-Service) | Ja (mit Warnung) | Nein |
| `vsnfd` | Nein | Nein | Nein | Ja (Sperrung) | N/A | Nein |

---

## 6. Organisationseinheiten-Kaskade & Berechtigungsprüfung

- **Service**: `backend/app/services/org_hierarchy.py`
- **Kaskadierende Berechtigung**: Einem übergeordneten Referat/Abteilung zugewiesene Räume und Zonen stehen automatisch auch allen Untereinheiten (z. B. Referatsgruppen, Fachgruppen) offen.
- **Isolierte Zuweisung**: Wird eine Ressource explizit einer Untereinheit zugewiesen, haben übergeordnete Einheiten und Geschwister-Referate keinen Zugriff (HTTP 403 `ZONE_RESTRICTED`).

---

## 7. Lock- und Unlock-Zyklen (FM-Governance)

- **Sperrungen (`locks`)**: FM kann Liegenschaften, Gebäude, Etagen, Räume oder einzelne Desks sperren.
- **Kollisionen & Auto-Storno**: Aktive Buchungen im Sperrzeitraum werden automatisch storniert (`cancel_kind="locked"`) und Betroffene benachrichtigt.
- **Entsperren (`/api/fm/locks/{lock_id}`)**: Sperrungen können per `DELETE` gezielt über ihre ID aufgehoben werden; die Ressourcen stehen sofort wieder im Buchungspool bereit.

---

## 8. Barrierefreiheit & Error Handling

- **BITV 2.0 / WCAG 2.1 AA**: Konformitätsanforderungen für Bundesbehörden.
- **Barrierefreiheitserklärung**: Vollständige Erklärung unter `/barrierefreiheit` ([`AccessibilityStatement.tsx`](frontend/src/pages/AccessibilityStatement.tsx)) mit Feedback-Mechanismus und Schlichtungsstellen-Kontakt.
- **Error Boundaries**: [`ErrorBoundary.tsx`](frontend/src/components/ErrorBoundary.tsx) fängt Rendering-Fehler ab und bietet Wiederherstellung.

---

## 9. Stack & Bibliotheken

- **Backend**: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (SQLite / `backend/deskshare.db`).
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, HTML5 Canvas Rendering für interaktive Pläne.
- **Tests**: `pytest` (Unit/Integration, 42 Tests in `backend/tests/unit`), `behave` (Gherkin BDD), Playwright (E2E).
- **Lizenz**: GNU Affero General Public License v3.0 (AGPL-3.0), Copyright © 2026 Berthold Maier.
