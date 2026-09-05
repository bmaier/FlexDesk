# DeskSharing BAMF — PoC

Proof of Concept für eine Desk- und Meetingraum-Buchungsanwendung für das BAMF, basierend auf
der PRD (`_bmad-output/planning-artifacts/prds/prd-DeskSharing-2026-08-13/prd.md`) und dem
UX-Design (`_bmad-output/planning-artifacts/ux-designs/ux-DeskSharing-2026-08-14/`).

Ziel dieses PoC ist **funktionale Vollständigkeit aller Use Cases**, keine produktionsreife
Architektur. Login ist simuliert (kein echtes IDM/Keycloak), die Datenbank ist SQLite.

## Inhalt

- [Kernkonzepte & Datenmodell](#kernkonzepte--datenmodell)
- [Architektur auf einen Blick](#architektur-auf-einen-blick)
- [Voraussetzungen](#voraussetzungen)
- [Schnellstart](#schnellstart)
- [Demo-Accounts, Rollen & Kostenstellen](#demo-accounts-rollen--kostenstellen)
- [Demo-Ablauf-Skript](#demo-ablauf-skript)
- [Tests](#tests)
- [Projektstruktur](#projektstruktur)
- [Bekannte Vereinfachungen (PoC-Scope)](#bekannte-vereinfachungen-poc-scope)

## Kernkonzepte & Datenmodell

### 1. Strikte 5-Ebenen-Hierarchie
Ressourcen sind konsistent hierarchisch modelliert:
```text
Liegenschaft (Property)
 └── Gebäude (Building)
      └── Etage (Floor)
           └── Raum (Room: desk_area | meeting)
                ├── Desk / Arbeitsplatz (bei desk_area)
                │    └── Ausstattungs-Labels (Monitor, Stehpult, etc.)
                └── Bestuhlung / Stühle & Tische (bei meeting)
```
- **Keine Desks ohne Raum**: Arbeitsplätze sind zwingend einem Raum zugeordnet.
- **Kaskadierende Navigation**: 3-stufiger Baum in der Buchung und im Facility Management (Liegenschaft -> Gebäude -> Etage) mit automatischer Selektion.

### 2. Zwei-Stufen-Grundriss-Architektur (Two-Tier Layout)
- **Stufe 1: Etagen-Grundriss (`Floor.floorplan_layout`)**:
  - Zeigt Räume als geschlossene Funktionseinheiten (z. B. Büroräume, Konferenzräume) sowie allgemeine Infrastruktur (Treppenhäuser, Aufzüge, Türen, Wände, WCs, Teeküchen).
  - Drag & Drop für Raumflächen und Türen/Treppen im FM Designer.
  - Klick auf einen Raum öffnet direkt den detaillierten Raum-Innenplan.
- **Stufe 2: Raum-Innenplan (`Room.floorplan_layout`)**:
  - **Desk-Räume (`desk_area`)**: Zeigt die exakte Schreibtisch-Anordnung mit Desk-Nummern, Status (frei, gebucht, belegt) und Büromöbeln (Schränke, Whiteboards, Pflanzen).
  - **Meetingräume (`meeting`)**: Zeigt den Konferenztisch sowie alle Stühle gemäß Raumkapazität, passend zur gewählten Bestuhlungsart.

### 3. Meetingraum-Planung mit Bestuhlungsarten & Catering-Abrechnung
- **Bestuhlungsformen (`SeatingOption`)**: Standard/Konferenztisch (Boardroom), U-Form, Blockbestuhlung, Theater / Kino, Parlamentarisch / Schulung, Stuhlkreis. Alle Stühle werden automatisch auf dem Innenplan angeordnet und können per Drag & Drop verschoben werden.
- **Rüstzeiten**: Bestuhlungswechsel können Rüsttage (`changeover_days`) definieren, die vor Terminen automatisch reserviert werden.
- **Catering & Kostenstellen**:
  - Catering kann als Zusatzleistung gewählt werden.
  - Standardabrechnung erfolgt über die Kostenstelle der eigenen Org-Einheit (`User.cost_center` / `Department.cost_center`).
  - Bei Eingabe einer abweichenden/fremden Kostenstelle verlangt das System eine explizite Bestätigung der Kostenstellen-Genehmigungswarnung (`cost_center_warning_acknowledged`).

### 4. Reaktives FM State-Management & Live-Aktualisierung
- **Tab-übergreifendes State-Management**: Der Bearbeitungskontext (aktive Liegenschaft, Gebäude, Etage, Raum und gewählter Reiter) bleibt über `sessionStorage` beim Hin- und Herschalten zwischen allen FM-Tabs vollständig erhalten.
- **Live-Aktualisierung**: Nach der Neuanlage oder Bearbeitung von Liegenschaften, Gebäuden, Etagen oder Räumen aktualisieren sich alle Auswahllisten und Canvas-Pläne sofort ohne Browser-Reload.

## Architektur auf einen Blick

| Schicht | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite, React Router, Tailwind CSS (Design-Tokens aus `DESIGN.md`), HTML5 Canvas |
| Backend | Python 3.12 + FastAPI, SQLAlchemy 2.0 |
| Datenbank | SQLite-Datei (`backend/deskshare.db`), Schema in 4. Normalform (siehe `backend/app/models/`) |
| Auth | **Simuliert** — Rollenwechsel per Demo-Account, kein echtes IDM/Keycloak |
| Tests | pytest (Unit/Integration: 33 Tests), behave (Gherkin/BDD), Playwright (GUI/E2E), bmad-loop |

Das Backend legt bei erstem Start automatisch die SQLite-Datei `backend/deskshare.db` an und
befüllt sie mit BAMF-Stammdaten (Liegenschaften, Gebäude, Etagen, Räume, Desks, Bestuhlungen, Nutzer, Rollen — siehe
`backend/app/seed_data.py`). Grundriss-SVGs und interaktive JSON-Layouts für Etagen und Räume
werden automatisch generiert.

## Voraussetzungen

- **Python-Paketmanager `uv`** (https://docs.astral.sh/uv/) — verwaltet venv und Abhängigkeiten
  automatisch, kein manuelles `python -m venv` nötig.
- **nvm** (Node Version Manager) — das Startskript ruft `nvm install --lts && nvm use --lts` auf,
  damit stets die aktuelle Node-LTS-Version verwendet wird.
- macOS/Linux-Shell (bash). Getestet mit Python 3.12, Node 24.

## Schnellstart

```bash
./start.sh
```

Das Skript:
1. installiert/aktualisiert die Backend-Abhängigkeiten (`uv sync` in `backend/`),
2. installiert die Frontend-Abhängigkeiten (`npm install` in `frontend/`),
3. startet das Backend unter `http://127.0.0.1:8010` (OpenAPI-Doku unter `/docs`),
4. startet das Frontend unter `http://127.0.0.1:5183`,
5. beendet beide Prozesse sauber bei `Strg+C`.

Danach im Browser `http://127.0.0.1:5183` öffnen und einen Demo-Account aus der Liste wählen.

**Ports:** Falls `8010`/`5183` belegt sind, können sie per Umgebungsvariable
überschrieben werden: `BACKEND_PORT=8011 FRONTEND_PORT=5184 ./start.sh`.

**Datenbank komplett neu initialisieren (inkl. aller Grundrisse & Kostenstellen):**
```bash
cd backend
uv run python -m app.seed_data --reset
```

### Manueller Start (ohne start.sh)

```bash
# Backend
cd backend
uv sync
uv run uvicorn app.main:app --port 8010 --reload

# Frontend (in einem zweiten Terminal)
source ~/.nvm/nvm.sh && nvm install --lts && nvm use --lts
cd frontend
npm install
npm run dev
```

## Demo-Accounts, Rollen & Kostenstellen

Die Rollen-Simulation ersetzt ein echtes IDM: Auf der Login-Seite wird ein Demo-Konto gewählt,
das Backend akzeptiert dafür ein Opak-Token (`demo:<user_id>`, siehe `backend/app/auth.py`).
Rollenwechsel jederzeit über den "Wechseln"-Link unten links in der Seitenleiste möglich.

| Konto | Rolle(n) | Org-Einheit / Kostenstelle | Relevant für |
|---|---|---|---|
| Dr. Maria Schmidt | `fm`, `raumverantwortlicher` | P.GZ (`KST-110-GZ`) | Facility-Management, Genehmigungen, Raumverantwortung |
| Ali Yilmaz | `mitarbeiter` | 2.1 (`KST-2100-OPS`) | Schnellbuchung (eigener Stammplatz N-01), Desk-Suche |
| Johannes Schneider | `mitarbeiter` | 6.1 (`KST-6100-GRUND`) | Gezielte Buchung im 5-Ebenen-Grundriss |
| Elena Petrova | `mitarbeiter` | 9.2 (`KST-9200-FONDS`) | Vertretung (Self-Service-Delegation an Frau Kaya) |
| Frau Kessler | `mitarbeiter` | P.PR (`KST-120-PRESSE`) | Gezielte Buchung an unbekanntem Standort |
| Frau Kaya | `team_assistenz` | P.GZ (`KST-110-GZ`) | Buchen für…, Serienbuchung (Vertretung für Müller/Elena) |
| Hans Müller | `mitarbeiter` | 2.1 (`KST-2100-OPS`) | Ziel einer Linienorganisations-Vertretung |
| Herr Demir | `mitarbeiter` | P.PR (`KST-120-PRESSE`) | Meetingraum-Anfrage mit Catering & Genehmigung |
| Frau Ostermann | `raumverantwortlicher` | 1.2.1 (`KST-1210-FM`) | Genehmigungscenter (Konferenzraum A) |
| Herr Brandt | `fm`, `vsnfd` | 1.2.1 (`KST-1210-FM`) | FM, Vertrauliche Raumblockierung |
| Thomas Weber | `mitarbeiter` | 2.1 (`KST-2100-OPS`) | Auslastungsdemo München West |
| Sabine Kraus | `mitarbeiter` | 2.1 (`KST-2100-OPS`) | Auslastungsdemo Hamburg City |
| Julia Fischer | `mitarbeiter` | P.PR (`KST-120-PRESSE`) | Buchungsszenarien Nürnberg |
| Herr Wagner | `fm` | 1.2.2 (`KST-1220-BAU`) | FM München West (Grundriss-Planung) |
| Frau Lehmann | `mitarbeiter` | 6 (`KST-6000-QS`) | Org-Hierarchie-Kaskade (Berechtigung Räume A-12/A-13) |
| Herr Kaiser | `mitarbeiter` | 6.2 (`KST-6200-IZAM`) | Org-Hierarchie-Kaskade (A-12/A-13 + QS-Büro 1.20) |
| Frau Nowak | `mitarbeiter` | 6.2.1 (`KST-6210-PROZ`) | Org-Hierarchie-Kaskade (QS-Büro 1.20) |

## Demo-Ablauf-Skript

`backend/demo_walkthrough.py` führt die zentralen Use Cases automatisiert und narrativ
gegen die **laufende** Backend-Instanz aus (Rollenwechsel, neue Liegenschaft anlegen, Zonen,
Schnell-/Gezielte/Serienbuchung, Genehmigung, Sperrung+Benachrichtigung, vertrauliche
Blockierung, Org-Hierarchie-Kaskade bei Raumzuordnung, Doppelbuchungs-Warnung mit
Storno-/Begründungs-Option, ressourcen-spezifische Check-in-Pflicht) — ideal, um parallel
im Browser mitzuverfolgen oder das PoC jemandem vorzuführen, ohne jeden Klick manuell
nachzustellen.

```bash
# Backend muss laufen (z.B. über ./start.sh)
cd backend
uv run python demo_walkthrough.py
```

## Tests

### Backend — pytest (Unit/Integration)

Schnelle Tests gegen eine isolierte, temporäre SQLite-Datenbank (kein laufender Server nötig):

```bash
cd backend
uv run pytest tests/unit -v
```

### Backend — behave (Gherkin/BDD)

Fachliche Szenarien in deutscher Sprache (`backend/tests/features/*.feature`), decken die
gleichen Use Cases wie oben in Gherkin-Form ab (ebenfalls gegen eine isolierte Test-DB):

```bash
cd backend
uv run behave
```

### Frontend — Playwright (GUI/E2E)

Startet Backend (mit frisch zurückgesetzter DB) und Frontend automatisch, sofern nicht bereits
Instanzen unter den konfigurierten Ports laufen (siehe `frontend/playwright.config.ts`):

```bash
cd frontend
npx playwright install chromium   # einmalig
npx playwright test
```

## Projektstruktur

```
backend/
  app/
    models/         SQLAlchemy-Modelle (4NF-Schema: reference/structure/bookings/locks)
    routers/         FastAPI-Router je Fachbereich (auth, catalog, bookings, approvals, fm, ...)
    services/        Verfügbarkeits-/Terminlogik, Benachrichtigungen
    seed_data.py     BAMF-Stammdaten + generierte Grundriss-SVGs
    main.py          App-Setup, Check-in-/Erinnerungs-Hintergrundtask
    static/floorplans/  generierte + hochgeladene Grundrisspläne
  tests/
    unit/            pytest
    features/        behave (Gherkin) + Steps
  demo_walkthrough.py
frontend/
  src/
    api/             Typisierter Fetch-Client
    context/         Auth-Context (Rollenwechsel-Simulation)
    components/      Layout/Sidebar, wiederverwendbare UI-Bausteine
    pages/           Eine Seite je IA-Eintrag (Schnellbuchung, Gezielte Buchung, ...)
  e2e/               Playwright-Tests
start.sh
```

## Bekannte Vereinfachungen (PoC-Scope)

Bewusste Abweichungen von einer produktionsreifen Umsetzung, dokumentiert statt versteckt:

- **Auth**: vollständig simuliert (kein Keycloak/OIDC), da für den PoC nicht erforderlich.
- **Benachrichtigungen**: nur In-App (Postkorb), kein E-Mail-Versand/EventGrid.
- **Semantische Datenschicht** (FR-34–38, RDF/SHACL/JSON-LD) sowie **Chat-Buchung** (FR-30–33,
  Release 2) sind nicht Teil dieses PoC (laut PRD ohnehin außerhalb des MVP-Scopes für Release 1
  bzw. bewusst spätere Architektur-Voraussetzung).
- **Defektmeldungen**: eine gemeinsame Tabelle mit nullable `desk_id`/`room_id` statt zweier
  Subtyp-Tabellen — pragmatischer Kompromiss gegenüber der sonst konsequent subgetypten
  Buchungs-/Sperrungs-Modellierung (`bookings`/`desk_bookings`/`room_bookings`,
  `locks`/`desk_locks`/`room_locks`/`property_locks`).
- **Datenübernahme** (FR-51/52): einfache CSV-Upload-Endpunkte ohne eigenen Screen (wie im
  UX-Design vorgesehen — "bewusst knapp gehalten").
- **Serienbuchungs-Horizont**: aus Performancegründen im PoC auf 60 Termine gedeckelt.
- **Check-in-/Erinnerungs-Sweep**: ein einfacher In-Process-Hintergrundtask (alle 15s), kein
  externer Scheduler.
- Ports `8010`/`5183` statt der Standardports `8000`/`5173`, da diese auf der Entwicklungsmaschine
  von anderen Prozessen belegt waren — per Umgebungsvariable änderbar (siehe oben).
