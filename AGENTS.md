<!-- bmad:context -->
<!-- Verified 2026-09-17 against 42c4564. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## Desk4Me

Workspace & Meeting Room Booking Management System (Proof of Concept for BAMF). Python 3.12 (FastAPI, SQLAlchemy 2.0, SQLite) and TypeScript (React 18, Vite, Tailwind CSS). Planning and BMad artifacts live in `_bmad-output/`, domain docs and requirements in `docs/`. Licensed under GNU AGPL-3.0 (Copyright 2026 Berthold Maier).

## Policy

- Work in feature branches; never break working unit/integration tests (`backend/tests/unit`) or frontend build (`frontend/`).
- Preserve existing comments and docstrings.
- Ensure strict 5-level resource hierarchy: Property -> Building -> Floor -> Room -> Desk/Furniture. Never place a Desk directly on a Floor without a Room.
- Comply with BITV 2.0 / WCAG 2.1 AA accessibility guidelines.

## Where things are

- Planning artifacts & PRD: `_bmad-output/planning-artifacts/prds/prd-DeskSharing-2026-08-13/prd.md`
- Architecture spine: `_bmad-output/planning-artifacts/architecture/architecture-DeskSharing-2026-09-02/ARCHITECTURE-SPINE.md`
- Epics & Stories: `_bmad-output/planning-artifacts/epics.md`
- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Requirements analysis & compliance: `docs/ANFORDERUNGSPRUEFUNG-FACHBEREICHE.md`
- Backend entry point: `backend/app/main.py`
- Database models: `backend/app/models/` (structure, bookings, reference, locks)
- Backend routers: `backend/app/routers/` (catalog, bookings, fm, auth, approvals, confidential)
- Backend tests: `backend/tests/unit/` and `backend/tests/features/`
- Frontend source: `frontend/src/` (pages, components, api, utils)

## Running and verifying

- Backend unit tests: run with virtualenv `backend/.venv/bin/pytest backend/tests/unit` (42 tests pass). Do not run with system pytest without virtualenv as it requires `python-multipart`.
- Frontend build & typecheck: `cd frontend && npm run build` (runs `tsc -b && vite build`).
- Full app start: `./start.sh` (backend default port 8010, frontend default port 5183).

## Conventions that differ from defaults

- Two-Tier Floorplan Architecture: Floor level (`Floor.floorplan_layout`) renders room boundaries and infrastructure (stairs, elevators, doors); Room level (`Room.floorplan_layout`) renders interior furniture, desks, and meeting seating.
- Meeting rooms only booked as whole units (30-minute slots), whereas desks are booked in half-day or full-day units.
- Catering defaults to user's department cost center; booking with a foreign cost center requires explicit user acknowledgment (`cost_center_warning_acknowledged=True`).
- Privacy / GDPR: Attendance evaluations require minimum group size (`MIN_GROUP_SIZE = 3`) to prevent re-identification of small teams.

## Known pitfalls

- Do not use global `datetime.utcnow()` without timezone awareness in new code; use `datetime.now(timezone.utc)`.
- Always check `ZONE_RESTRICTED` permissions when booking desks or meeting rooms assigned to specific departments/units.
- State preservation in FM: `FacilityManagement.tsx` uses `sessionStorage` (`fm_navigation_state`) to preserve selected property/building/floor/room across tab switches.

<!-- /bmad:context -->
