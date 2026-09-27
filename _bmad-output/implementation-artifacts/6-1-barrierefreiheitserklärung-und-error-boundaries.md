---
id: "6-1-barrierefreiheitserklärung-und-error-boundaries"
title: "Story 6.1: Barrierefreiheitserklärung nach BITV 2.0 / WCAG 2.1 AA und Error Boundaries"
epic: 6
story: 1
status: done
created: 2026-09-15
updated: 2026-09-17
---

# Story 6.1: Barrierefreiheitserklärung nach BITV 2.0 / WCAG 2.1 AA und Error Boundaries

## User Story
**Als** Nutzer der Anwendung (insbesondere Menschen mit Behinderungen oder Einschränkungen)
**möchte ich** eine transparente Erklärung zur Barrierefreiheit mit Feedback-Möglichkeit aufrufen können und im Fehlerfall durch Error-Boundaries geschützt sein,
**damit** gesetzliche Vorgaben (BGG, BITV 2.0) erfüllt sind und Systemausfälle nicht zu einem Totalabsturz der Benutzeroberfläche führen.

## Akzeptanzkriterien (Acceptance Criteria)

### AC 1: Barrierefreiheitserklärung (`/barrierefreiheit`)
- Eigene Seite `AccessibilityStatement.tsx` mit Stand der Vereinbarkeit, bekannten Barrieren, Feedback-Mechanismus und Kontaktdaten der Schlichtungsstelle nach § 16 BGG.
- Erreichbar über den globalen Footer in `Layout.tsx`.

### AC 2: React ErrorBoundary
- `ErrorBoundary.tsx` umschließt Hauptansichten und komplexe Canvas-Komponenten.
- Im Fehlerfall wird eine nutzerfreundliche Fehlermeldung mit Reload-Button angezeigt.

### AC 3: Barrierefreie Navigation und Fokus-Management
- Tastaturfokus und Screenreader-Attribute (`aria-label`, `role`) an interaktiven Elementen.
