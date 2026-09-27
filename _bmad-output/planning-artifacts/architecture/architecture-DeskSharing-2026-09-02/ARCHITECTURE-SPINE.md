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
updated: '2026-09-27'
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

---

## 10. Ist- vs. Ziel-Architektur — PoC-Abweichungen & Prod-Migrationspfad

Release 1 wurde als PoC bewusst schnell gegen den fachlichen Kern des PRD gebaut. Vier von PRD/`addendum.md` geforderte **Architektur-Invarianten** wurden dabei nicht umgesetzt, sondern durch eine einfachere Ist-Lösung ersetzt. Das ist hier verbindlich festgehalten, damit kein nachfolgender Bau- oder Architektur-Schritt fälschlich annimmt, diese Invarianten seien bereits erfüllt — und damit die Korrektur vor Produktivsetzung nicht verloren geht.

**Zeitliche Einordnung (AD-5):** Diese Korrekturen sind bewusst **nicht Teil des laufenden PoC**. Der PoC wird zunächst vollständig auf der aktuellen Ist-Architektur (AD-1–AD-4) fertiggestellt und fachlich abgenommen; die Migration zur Ziel-Architektur beginnt erst danach, gesteuert über den Migrationspfad in §11.

### AD-1 — Semantische Datenschicht (RDF/SHACL/JSON-LD) nicht umgesetzt `[ADOPTED]`

- **Binds:** FR-34–FR-38 (PRD §4.11), Architektur-Voraussetzung für Release 2a (Chat-Buchung)
- **Prevents:** Annahme, dass RDF-Vokabulare, SHACL-Shapes oder eine OpenAPI-x-Extension-Verlinkung bereits existieren oder aus dem Code ableitbar sind
- **Rule:** Es existieren keine RDF/SHACL/JSON-LD-Artefakte im Backend; die OpenAPI-Spezifikation ist rein technisch, ohne semantische Verlinkung. Vor Produktivsetzung **und zwingend vor Start von Release 2a** (der Chat-Agent braucht diese Schicht laut PRD als Voraussetzung) ist eine eigene `bmad-architecture`-Update-Runde für diese Schicht einzuplanen, bevor `bmad-create-epics-and-stories` für Release 2a läuft.

### AD-2 — Event-driven Notifications durch Inline-Write + Polling ersetzt `[ADOPTED]`

- **Binds:** Benachrichtigungs-Subsystem (FR-29, FR-49), `addendum.md` „Architekturmuster: Event-driven Notifications/Tasks"
- **Prevents:** Annahme eines pluggable Subscriber-Modells (CloudEvents auf einem EventGrid, unabhängige Kanäle wie E-Mail/Postkorb); Annahme, dass Notification-Erzeugung von der Fachlogik entkoppelt ist
- **Rule:** Benachrichtigungen werden synchron inline in der Fachlogik erzeugt (`bookings.py`, `fm.py`); ein Hintergrund-Task (`main.py`, 15-Sekunden-Takt) übernimmt Reminder und Auto-Freigabe. Es gibt keinen CloudEvents-Envelope, kein EventGrid, keinen E-Mail-Kanal — nur In-App-Mitteilungen. Vor Produktivsetzung: entweder (a) echten Event-Bus mit Subscriber-Modell nachrüsten, sobald ein zweiter Kanal (z.B. E-Mail/Exchange) tatsächlich gebraucht wird, oder (b) die Anforderung bewusst und dokumentiert über `bmad-correct-course` zurücknehmen.

### AD-3 — Deployment-Envelope: lokale Prozesse statt Containerisierung `[ADOPTED]`

- **Binds:** Betriebs-/Deployment-Envelope (`addendum.md` §Deployment: docker-compose/Podman lokal, Kubernetes Produktion)
- **Prevents:** Annahme, dass Container-Images, Dockerfiles oder Kubernetes-Manifeste existieren
- **Rule:** Es gibt kein Dockerfile, kein docker-compose und keine K8s-Manifeste im Repo. Start erfolgt ausschließlich über `start.sh` (nackter uvicorn-Prozess + Vite-Dev-Server, Persistenz über die SQLite-Datei `backend/deskshare.db`). Vor Produktivsetzung zwingend: Containerisierung (Dockerfile Backend + Frontend), docker-compose für lokale Entwicklung, K8s-Manifeste/Helm-Chart für Produktion, sowie Wechsel von SQLite auf eine produktionsfeste Datenbank (siehe §11).

### AD-4 — Authentifizierung ist ein simulierter Demo-Mechanismus `[ADOPTED]`

- **Binds:** Auth-/Pseudonymisierungsmodell (PRD FR-18–FR-21), `addendum.md` „IDM/IAM des BAMF (Keycloak-basiert)"
- **Prevents:** Annahme einer echten Identitätsprüfung/SSO; Annahme, dass die Rollen-/Rechteprüfung (§5) gegen ein echtes IDM validiert ist
- **Rule:** `backend/app/auth.py` implementiert bewusst **keine** Keycloak-/IDM-Integration — die Anmeldung erfolgt per Demo-Nutzerauswahl, das Backend akzeptiert ein opakes `Bearer demo:<id>`-Token ohne kryptografische Prüfung. **Sicherheitskritisch:** Dies ist vor jeglicher Produktivsetzung — nicht optional, nicht „später" — durch eine echte Keycloak-/IDM-Integration mit signierten/validierten Tokens zu ersetzen, da sonst weder Authentifizierung noch das darauf aufbauende Pseudonymisierungs-/Berechtigungsmodell (§5, §6) tragfähig sind.

### AD-5 — Migrationsreihenfolge: Ziel-Architektur erst nach PoC-Abschluss `[ADOPTED]`

- **Binds:** AD-1 bis AD-4, gesamter Prod-Migrationspfad (§11)
- **Prevents:** vorzeitige oder parallele Umsetzung der Ziel-Architektur, während der PoC noch läuft; Ressourcenkonflikt zwischen PoC-Fertigstellung und Prod-Umbau
- **Rule:** Die in AD-1 bis AD-4 beschriebenen Korrekturen werden **nicht parallel** zum laufenden PoC begonnen. Der PoC wird zunächst auf der aktuellen Ist-Architektur fertiggestellt und fachlich abgenommen; erst danach beginnt die Migration zur Ziel-Architektur (§11). Eine Ausnahme ist nur die Voraussetzungsprüfung vor Release 2a (siehe AD-1) — dort zwingt die Abhängigkeit zum Vorziehen der semantischen Datenschicht vor Beginn von Release 2a, nicht vor Abschluss des PoC von Release 1.

### Kleinere PoC-Vereinfachungen (unterhalb AD-Niveau)

Diese sind Feature-Lücken, keine Architektur-Invarianten — Details in [ZusammenfassungAnforderungsabdeckung.md](../../../../ZusammenfassungAnforderungsabdeckung.md). Hier nur die technische Kurzfassung für die Prod-Planung:

| Bereich | PoC-Stand | Für Prod nötig |
| --- | --- | --- |
| Raumstammdaten-Import | Nur CSV (`fm.py:1248`) | `.xlsx`-Parser oder verbindlicher Export-Workflow |
| Grundrisspläne | Nur Bild-Upload (PDF/JPG als Hintergrundbild) | Optional: PDF-Vektorisierung |
| PVSplus-Schnittstelle | Nicht vorhanden; Alternative (Profilpflege) umgesetzt | Fachliche Entscheidung: Schnittstelle nachziehen oder Alternative dauerhaft beibehalten |
| Serienbuchung: rollierendes Kurzhorizont-Muster | Nicht implementiert (offene PRD-Frage 19) | Klärung + Umsetzung falls gefordert |
| Serienbuchung: Performance-Cap | Hart auf 60 Termine begrenzt (`scheduling.py`) | Skalierungstest, ggf. Cap erhöhen/entfernen |
| Liegenschaftsspezifische Buchungsberechtigung | Nicht aktiv (Standard: uneingeschränkt, FR-5) | Fachliche Entscheidung, ob nötig |
| Vorgänger-Tool-Migration | Nur API-Ebene (`fm.py:1270`, CSV), kein Frontend-Screen | Datenformat des Alt-Tools klären, ggf. Frontend-Screen |

---

## 11. Deferred — Prod-Migrationspfad

**Startbedingung (AD-5): Diese Reihenfolge beginnt erst, nachdem der PoC auf der aktuellen Ist-Architektur fertiggestellt und fachlich abgenommen ist — nicht parallel dazu.** Innerhalb des Migrationspfads dann nach Kritikalität, nicht nach Aufwand:

1. **Auth/Keycloak (AD-4)** — sicherheitskritisch, zuerst. Ohne echte Identitätsprüfung ist keine der bestehenden Rollen-/Rechteprüfungen (§5, §6) vertrauenswürdig.
2. **Persistenz** — Wechsel SQLite → produktionsfeste DB (z.B. PostgreSQL), inkl. Migrationsskript für bestehende Demo-/Testdaten.
3. **Deployment (AD-3)** — Containerisierung + K8s, damit Auth- und DB-Wechsel produktionsnah getestet werden können.
4. **Event-System (AD-2)** — nur falls ein zweiter Benachrichtigungskanal (E-Mail) tatsächlich gebraucht wird; sonst per Correct-Course bewusst zurücknehmen.
5. **Semantische Datenschicht (AD-1)** — erst unmittelbar vor Release 2a nötig, nicht vor Release-1-Prod-Go-Live.
6. **Kleinere PoC-Vereinfachungen** (Tabelle oben) — einzeln nach fachlicher Priorität, kein Blocker für Prod-Go-Live von Release 1.

Jeder Punkt braucht vor der Umsetzung eine kurze `bmad-correct-course`- oder `bmad-architecture`-Update-Runde, keine stillschweigende Nacharbeit im Code — die AD-IDs oben bleiben dabei stabil (Ergänzung, keine Umnummerierung).
