# Addendum — Desk Sharing BAMF

Technisches Detailwissen und Optionen-Rationale, die zur Architektur bzw. zum Solution-Design gehören, aber nicht in die PRD selbst.

## Integrationslandschaft (bestehende BAMF-Systeme)

Details noch zu klären, aber folgende Systeme sind als Integrationspunkte benannt:

- **IDM/IAM des BAMF** (Keycloak-basiert) — Identität, Pseudonymisierung/Auflösung (siehe PRD-Sichtbarkeitsmodell).
- **Stammdaten & Codelisten des BAMF** — bestehende Referenzdaten-Quelle, Integrationsart noch offen.
- **HR-System** — Anbindung über "DataGrid Services" (Bezeichnung/Produkt vom Nutzer genannt, technische Details noch zu klären) — liefert vermutlich Organisationsstruktur/Linienbeziehung für das Vertretungsmodell (Org-Sync).
- **EventGrid-System** — publiziert Domain-Events im **CloudEvents-Standard**; zentrale Integrationsarchitektur für dieses Projekt (Details siehe Abschnitt "Architekturmuster: Event-driven Notifications/Tasks" unten).
- **OTEL (OpenTelemetry)** — Observability-Daten sollen im BAMF-Standard emittiert werden.
- **TaskManagement-System** — Aufgaben/Postkorb-Einträge für Mitarbeitende (z.B. bei Stornierung), angesprochen über Event-Subscriber-Muster.
- **Bestehendes Raumbelegungstool** — Quelle für Bestandsbuchungen (FR-52). Konkretes System/Format vom Nutzer noch nicht benannt, zu klären.
- **Referat 12E** — hält aktuelle Raumstammdaten als Excel (Raumnummer, Beschreibung) sowie Grundrisspläne als PDF/JPG (FR-51). Einmaliger Import, kein laufender Sync.

## Architekturmuster: Event-driven Notifications/Tasks

Vom Nutzer explizit vorgegebenes Muster (nicht PRD-Anforderungsebene, sondern Architekturentscheidung):

> "Ich sende ein Event: Storniert. Dann wird ein EventSubscriber angesprochen und der legt z.B. einen Task an, oder ein anderer Subscriber sendet eine E-Mail als Notification."

D.h.: Buchungsereignisse (Storno, Sperrung, Serienkonflikt etc.) werden als CloudEvents auf dem EventGrid publiziert. Verschiedene Subscriber (Task-Erstellung im Postkorb, E-Mail-Versand, ggf. weitere) reagieren unabhängig. Löst den in der Forge-Session offen gelassenen Punkt "Benachrichtigungskanal noch offen" — der Kanal ist nicht fest im Kern-System verdrahtet, sondern über Event-Subscriber pluggable.

## Deployment

- Lokale Entwicklung: containerisiert über docker-compose, mit Podman als Laufzeitumgebung (nicht Docker Engine).
- Produktion: Kubernetes-Deployment.
- Offen: konkreter Hosting-Anbieter/Betreiber und BSI-C5-Zertifizierung/EVB-IT-Cloud-Konformität (siehe PRD §6.2 Data Governance, offener Punkt).

## Chat-Buchung — Tech-Stack (R2a/R2b, realisiert FR-30–FR-33)

- **Frontend:** A2UI + AG-UI + CopilotKit — für generative UI-Komponenten im Chat-Dialog (FR-31).
- **Backend:** zusätzlich Google Agent ADK zur gekapselten Implementierung der Agentenlogik.
- **Interop-Check (Recherche, August 2026):** CopilotKit ist offizieller Launch-Partner für A2UI; AG-UI implementiert den vollen A2A-Handshake und unterstützt die A2UI-Spec direkt; für Google ADK existieren dedizierte Integrationsguides auf beiden Seiten. Kein Kompatibilitätsrisiko gefunden.
- **Reifegrad-Risiko:** A2UI liegt bei Spec-Version v0.9 — junge, sich noch bewegende Spezifikation. Für ein Behördenprojekt mit langen Support-/Beschaffungszyklen ein Versionierungsrisiko (Breaking Changes zwischen v0.9 und v1.0 wahrscheinlich), kein Interoperabilitätsrisiko. Sollte bei Architekturentscheidung und Vertragsgestaltung berücksichtigt werden.

## API-Design-Grundsätze für Release 1 (Voraussetzung für Release 2a)

Aus der Party-Mode-Session: Release 1 muss architektonisch so gebaut sein, dass Release 2a (Chat-Buchung) die Release-1-API als Werkzeugkasten nutzen kann, ohne Neubau. Drei Bedingungen, unabhängig von jeglichem Chat-/KI-Code:

1. **Benannte, eigenständige Operationen** — jede Buchungsaktion existiert als klar benannte Backend-Operation mit definierten Ein-/Ausgaben, nicht als Nebeneffekt einer UI-Seite.
2. **Stabile Bezeichner** — Kernobjekte (z.B. Desk, Raum, Präferenz, Zeitraum — siehe Glossar §3) haben stabile, eindeutige IDs/Bedeutungen, unabhängig vom Label-Text, den ein Nutzer sieht.
3. **Strukturierte Fehlerantworten** — jede Operation liefert ihre Vorbedingungen und Fehlerfälle als strukturierte, maschinenlesbare Antwort, nicht als menschenlesbaren Fehlertext.

Diese drei Bedingungen sind eine Architektur-Vorgabe für die Release-1-Umsetzung, keine Produktanforderung im FR-Sinn — daher hier im Addendum, nicht als eigene FR. Sie sind die Grundlage, auf der FR-34–FR-38 (PRD §4.11) aufbauen: Der Release-2a-Chat-Agent kann Backend-Operationen nur dann sicher gegen veröffentlichte RDF/SHACL-Shapes binden, wenn die Operationen selbst schon benannt, stabil und strukturiert-fehlerauskunftsfähig sind. Ohne diese drei Bedingungen liefe die semantische Datenschicht ins Leere; ohne die semantische Datenschicht bliebe die Erfüllung der drei Bedingungen für den Agenten nicht maschinenlesbar überprüfbar. Siehe PRD §6.3 für den konkreten Bruchfall.

## Semantische Datenschicht — Scope-Klarstellung

Die Ontologie wird selbst definiert (statische RDF-Vokabulare); **schema.org** dient nur als Basis/Referenzpunkt, nicht als vollständiges Vokabular. (Ergänzt die bereits gehärtete Entscheidung aus der Forge-Session.)

## Nachträge aus der PoC-Implementierung (2026-09) — Spezifikationsänderungen

Die folgenden drei Punkte wurden während der PoC-Implementierung anhand konkreter Nutzungslücken präzisiert bzw. gegenüber der ursprünglichen PRD-Formulierung angepasst. Sie sind Implementierungsentscheidungen mit Rückwirkung auf die betroffenen FRs — daher hier dokumentiert statt stillschweigend im Code verändert.

### Ergänzung zu FR-46: Organisationseinheiten-Zuordnung ist hierarchie-kaskadierend, konfigurierbar pro Zuordnung

FR-46 sah eine Beschränkung auf "eine bestimmte Rolle oder Organisationseinheit" vor, ohne die BAMF-Organisationshierarchie (Abteilung → Referat → Unterreferat) zu berücksichtigen. In der Umsetzung zeigte sich: Wird ein Raum einer übergeordneten Abteilung zugeordnet (z.B. Abteilung 6), müssen automatisch auch alle untergeordneten Referate (6.1, 6.2, 6.2.1, …) buchungsberechtigt sein — nicht nur exakt die benannte Einheit. Wird umgekehrt ein Raum einem Unter-Referat zugeordnet (z.B. nur 6.2), soll die übergeordnete Abteilung (6) und Geschwister-Referate (6.1) **nicht** automatisch mitberechtigt sein.

**Konkretisierung von FR-46 (ersetzt die bisherige flache Einheiten-Zuordnung):**
- Jede Raum-Organisationseinheit-Zuordnung hat ein Flag `include_descendants` (Default: `true`), das FM bei der Zuordnung setzt.
- Ist `include_descendants=true`: alle Organisationseinheiten, die in der Hierarchie unterhalb der zugeordneten Einheit liegen, sind ebenfalls berechtigt (Kaskade nach unten). Die zugeordnete Einheit selbst und ihre Elterneinheiten sind **nicht** automatisch berechtigt.
- Ist `include_descendants=false`: ausschließlich Mitarbeitende exakt dieser Einheit sind berechtigt, keine Kaskade.
- Ein Raum kann mehreren Organisationseinheiten gleichzeitig zugeordnet werden (Vereinigungsmenge der Berechtigten).
- FM-Rolle umgeht diese Beschränkung grundsätzlich (Verwaltungszugriff), analog zur bestehenden Handhabung von FR-41/FR-46 für Facility Management.
- Gilt sowohl für Meetingräume (FR-46 Wortlaut) als auch für Desk-Bereiche/Räume mit Schreibtischen (FR-44/45 Zonenmodell) — die Kaskadenregel ist dieselbe, unabhängig vom Raumtyp.

### Ergänzung zu FR-47/48: Check-in-Pflicht ist Raum-/Desk-Eigenschaft, nicht Liegenschafts-Eigenschaft

FR-47 sah die Check-in-Pflicht als reine Liegenschafts-Einstellung vor ("FM kann pro Liegenschaft festlegen…"). In der Praxis ist der Bedarf feingranularer: z.B. sollen einzelne stark nachgefragte Räume/Desks (Qualitätssicherungsbüro) eine Check-in-Pflicht haben, während der Rest derselben Liegenschaft frei davon bleibt.

**Korrektur von FR-47 (weicht vom ursprünglichen Wortlaut ab):**
- Check-in-Pflicht wird pro **Raum** und/oder pro **Desk** individuell konfiguriert (nicht mehr pro Liegenschaft als Ganzes).
- Die Liegenschaft liefert weiterhin das Zeitfenster (`checkin_window_minutes`) für alle ihre Räume/Desks sowie einen Vorschlagswert, den FM beim Anlegen eines neuen Raums/Desks optional übernehmen kann — sie erzwingt die Pflicht selbst aber nicht mehr.
- FR-48 (automatische Freigabe bei Nichteinchecken) bleibt inhaltlich unverändert, bezieht sich aber jetzt auf die Raum-/Desk-Konfiguration statt auf die Liegenschafts-Konfiguration.

### Neu: Warnung bei Doppelbuchung derselben Person (ergänzt FR-8, primär im Desk-Kontext)

FR-8 deckt ausschließlich die Konfliktvermeidung *eines* Meetingraum-Slots ab (zwei Personen auf demselben Slot). Nicht abgedeckt war der Fall, dass **dieselbe Person** sich für überlappende Zeiträume auf zwei unterschiedlichen Ressourcen einträgt (z.B. Desk A und Desk B am selben Tag, oder Desk und Meetingraum gleichzeitig) — das deutet i.d.R. auf einen Bedienfehler oder einen bewussten Sonderfall hin (z.B. Standortwechsel innerhalb eines Tages).

**Neuer Mechanismus (Ergänzung, keine bestehende FR ersetzend):**
- Legt eine Buchung (Desk oder Meetingraum) für einen Zeitraum an, der sich mit einer anderen aktiven Buchung derselben Person (auf einer anderen Ressource) überschneidet, liefert das System eine Warnung statt eines Hard-Blocks — inkl. Angabe der kollidierenden Ressource und des Zeitraums.
- Der Buchende kann wählen: (a) die andere, bereits bestehende Buchung stornieren und die neue Buchung anschließend anlegen, oder (b) beide Buchungen parallel behalten — dies erfordert zwingend eine kurze Begründung (Freitext), die mit der neuen Buchung gespeichert wird.
- Ohne Begründung ist Option (b) nicht möglich (Validierungsfehler).
- Dieser Mechanismus ist unabhängig von FR-8 (Meetingraum-Slot-Konflikt zwischen zwei verschiedenen Personen) und von FR-10 (Serienbuchungskonflikt) — er behandelt ausschließlich Selbstüberschneidungen derselben Person über Ressourcengrenzen hinweg.
