# DeskSharing BAMF — PoC

Proof of Concept für eine Desk- und Meetingraum-Buchungsanwendung für das BAMF, basierend auf
der PRD (`_bmad-output/planning-artifacts/prds/prd-DeskSharing-2026-08-13/prd.md`) und dem
UX-Design (`_bmad-output/planning-artifacts/ux-designs/ux-DeskSharing-2026-08-14/`).

Ziel dieses PoC ist **funktionale Vollständigkeit aller Use Cases**, keine produktionsreife
Architektur. Login ist simuliert (kein echtes IDM/Keycloak), die Datenbank ist SQLite.

## Inhalt

- [Architektur auf einen Blick](#architektur-auf-einen-blick)
- [Voraussetzungen](#voraussetzungen)
- [Schnellstart](#schnellstart)
- [Demo-Accounts](#demo-accounts--rollen)
- [Demo-Ablauf-Skript](#demo-ablauf-skript)
- [Tests](#tests)
- [Projektstruktur](#projektstruktur)
- [Bekannte Vereinfachungen (PoC-Scope)](#bekannte-vereinfachungen-poc-scope)

## Architektur auf einen Blick

| Schicht | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite, React Router, Tailwind CSS (Design-Tokens aus `DESIGN.md`) |
| Backend | Python 3.12 + FastAPI, SQLAlchemy 2.0 |
| Datenbank | SQLite-Datei, Schema in 4. Normalform (siehe `backend/app/models/`) |
| Auth | **Simuliert** — Rollenwechsel per Demo-Account, kein echtes IDM/Keycloak |
| Tests | pytest (Unit/Integration), behave (Gherkin/BDD), Playwright (GUI/E2E) |

Das Backend legt bei erstem Start automatisch die SQLite-Datei `backend/deskshare.db` an und
befüllt sie mit BAMF-Stammdaten (Liegenschaften, Gebäude, Räume, Desks, Nutzer, Rollen — siehe
`backend/app/seed_data.py`). Grundrisspläne werden dabei als einfache SVGs generiert und unter
`backend/app/static/floorplans/` abgelegt; im Facility-Management können zusätzlich eigene
Grundrisspläne (Bild-Datei) für neu angelegte Etagen hochgeladen werden.

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

**Ports:** Falls `8010`/`5183` bei Ihnen belegt sind, können sie per Umgebungsvariable
überschrieben werden: `BACKEND_PORT=8011 FRONTEND_PORT=5184 ./start.sh` (CORS im Backend ist
aktuell fest auf `5183` konfiguriert — bei einem anderen Frontend-Port ggf. `backend/app/main.py`
→ `allow_origins` anpassen).

**Datenbank zurücksetzen:** `rm backend/deskshare.db` und Backend neu starten — die Stammdaten
werden beim nächsten Start automatisch neu erzeugt.

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

## Demo-Accounts / Rollen

Die Rollen-Simulation ersetzt ein echtes IDM: Auf der Login-Seite wird ein Demo-Konto gewählt,
das Backend akzeptiert dafür ein Opak-Token (`demo:<user_id>`, siehe `backend/app/auth.py`).
Rollenwechsel jederzeit über den "Wechseln"-Link unten links in der Seitenleiste möglich.

| Konto | Rolle(n) | Relevant für |
|---|---|---|
| Dr. Maria Schmidt | `fm`, `raumverantwortlicher` | Facility-Management, Genehmigungen |
| Ali Yilmaz | `mitarbeiter` | Schnellbuchung (UJ-1, eigener Stammplatz N-01) |
| Johannes Schneider | `mitarbeiter` | Gezielte Buchung |
| Elena Petrova | `mitarbeiter` | Vertretung (Self-Service-Delegation an Frau Kaya) |
| Frau Kessler | `mitarbeiter` | Gezielte Buchung an unbekanntem Standort |
| Frau Kaya | `team_assistenz` | Buchen für…, Serienbuchung (Vertretung für Hans Müller/Elena) |
| Hans Müller | `mitarbeiter` | Ziel einer Linienorganisations-Vertretung |
| Herr Demir | `mitarbeiter` | Meetingraum-Anfrage (genehmigungspflichtig) |
| Frau Ostermann | `raumverantwortlicher` | Genehmigungscenter (Konferenzraum A) |
| Herr Brandt | `fm`, `vsnfd` | Facility-Management, Vertrauliche Raumblockierung |
| Thomas Weber / Sabine Kraus / Julia Fischer | `mitarbeiter` | Auslastungsdemo München West |
| Herr Wagner | `fm` | Facility-Management für weiteren Standort (München) |
| Frau Lehmann | `mitarbeiter` (Abteilung 6) | Org-Hierarchie-Kaskade: darf A-12/A-13, nicht QS-Büro (nur Referat 6.2) |
| Herr Kaiser | `mitarbeiter` (Referat 6.2) | Org-Hierarchie-Kaskade: darf A-12/A-13 (geerbt von Abt. 6) und QS-Büro |
| Frau Nowak | `mitarbeiter` (Referat 6.2.1) | Org-Hierarchie-Kaskade: darf QS-Büro (geerbt von Referat 6.2) |

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
