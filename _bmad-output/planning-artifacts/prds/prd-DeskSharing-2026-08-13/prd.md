---
title: Desk4Me — Workspace & Meeting Room Booking Management
status: final
created: 2026-08-13
updated: 2026-09-17
project: Desk4Me
license: GNU AGPL-3.0 (Berthold Maier)
---

# PRD: Desk4Me — Workspace & Meeting Room Booking Management (BAMF PoC)

## 0. Document Purpose

Diese PRD richtet sich an Product-Owner, UX-, Architektur- und Umsetzungsverantwortliche des DeskSharing-BAMF-Projekts. Sie baut auf zwei vorgelagerten Sessions auf: einer Forge-Idea-Session (`../../forge/bamf-desk-sharing/forged-idea.md`, 13 gehärtete Entscheidungen) und einer Party-Mode-Diskussion (`../../party-mode/2026-08-13-desk-sharing-bamf.html`, Release-Schnitt R1/R2a/R2b). Begriffe folgen dem Glossar (§3) verbindlich; Features sind gruppiert mit global nummerierten FRs; Annahmen sind inline mit `[ASSUMPTION]` markiert und in §13 indexiert. Technische Integrations- und Architekturdetails, die nicht Teil der Produktanforderung sind, stehen in `addendum.md`.

## 1. Vision

DeskSharing BAMF ermöglicht Mitarbeitenden des Bundesamts für Migration und Flüchtlinge, über alle 50-100 Liegenschaften hinweg in Sekunden einen Arbeitsplatz oder Meetingraum zu finden und zu buchen — am eigenen Standardstandort per Ein-Klick, an unbekannten Standorten über eine schnelle Kartenauswahl. Buchen funktioniert genauso einfach im Auftrag: Team-Assistenzen und Führungskräfte können für abwesende Kolleginnen und Kollegen handeln, ohne sensible Gründe preiszugeben.

Facility Management erhält die volle Kontrolle über Gebäude, Räume und Ausstattung durch ein flexibles Label-System, kann Flächen bei Renovierung oder Defekt gezielt sperren, ohne dass betroffene Nutzer im Ungewissen bleiben. Besondere Vertraulichkeitsanforderungen (z.B. VS-NFD-Aufgaben) lassen sich unbürokratisch abbilden, ohne zum Standardfall zu werden. Wer wo sitzt, bleibt grundsätzlich pseudonymisiert sichtbar — Transparenz für die Organisation, ohne unnötige Preisgabe von Identität.

Ab Release 2 wird die Buchung zusätzlich als vollwertiger, gleichwertiger Gesprächs-Flow verfügbar — kein Chatbot-Anhängsel, sondern ein Weg, der dieselben Fähigkeiten trägt wie der klassische Klick-Pfad.

## 2. Target User

### 2.1 Jobs To Be Done

- **Als Mitarbeiter** will ich in Sekunden einen Arbeitsplatz oder Meetingraum buchen — an meinem Standardstandort ohne Umweg, andernorts über eine schnelle Kartenauswahl — ohne Formulare ausfüllen zu müssen.
- **Als Team-Assistenz/Manager** will ich für abwesende Kolleg:innen buchen und stornieren können, ohne einen Grund offenlegen zu müssen.
- **Als Facility Management** will ich Gebäude, Räume und Desks pflegen, gezielt sperren und Defekte nachverfolgen können, ohne dass bestehende Buchungen unkontrolliert ins Leere laufen.
- **Als Mitarbeiter mit vertraulicher Aufgabe (z.B. VS-NFD)** will ich kurzfristig einen ganzen Raum blockieren können, mit einfacher Begründung, ohne Freigabeprozess.
- **Als Kollege/Führungskraft** will ich nachvollziehen können, wer wo sitzt bzw. gebucht hat, ohne dass dabei unnötig Klarnamen offengelegt werden.

### 2.2 Non-Users (v1)

Ausschließlich interne BAMF-Mitarbeitende mit BAMF-IDM-Konto. Keine externen Dienstleister, Besucher, Praktikant:innen ohne volles IDM-Konto oder andere Behörden in v1.

### 2.3 Key User Journeys

- **UJ-1. Herr Yilmaz bucht seinen Stammtisch in 5 Sekunden.**
  - **Persona + Kontext:** Sachbearbeiter, bucht 3x/Woche denselben Standort.
  - **Entry state:** authentifiziert über BAMF-IDM, öffnet die App.
  - **Path:** Startbildschirm zeigt Standardstandort als Ein-Klick-Chip → antippen → System zeigt freie Desks am Standort, nach Präferenz-Ranking sortiert → einen wählen → bestätigen.
  - **Climax:** Buchung erscheint sofort bestätigt, kein Formular, keine Karte nötig.
  - **Resolution:** Buchung sichtbar in "Meine Buchungen", Desk für den Tag reserviert.

- **UJ-2. Frau Kaya bucht als Team-Assistenz eine Serie für ein ganzes Team.**
  - **Persona + Kontext:** Team-Assistenz mit hinterlegter Vertretungsberechtigung für 12 Mitarbeitende.
  - **Entry state:** authentifiziert, wählt "Buchen für" → Mitarbeiter aus der Liste.
  - **Path:** wählt Liegenschaft über Exploration/Karte → legt Serie an ("jeden Mo+Di bis 31.12.2026") → System prüft alle ~40 Termine.
  - **Climax:** 3 Termine kollidieren, System überspringt sie automatisch und zeigt am Ende eine Lückenliste.
  - **Resolution:** Serie ist aktiv, Mitarbeiter sieht die Buchungen unter eigenem Namen, Team-Assistenz-Handeln bleibt auditierbar im Hintergrund.
  - **Edge case:** Vertretungsberechtigung fehlt → System blockiert die Aktion mit strukturierter Fehlerantwort (FR-12), kein stiller Fehlschlag.

- **UJ-3. Frau Berger wird von einer Sperrung überrascht — und rechtzeitig informiert.**
  - **Persona + Kontext:** Mitarbeiterin mit bestehender Buchung.
  - **Entry state:** nicht in der App, Facility Management sperrt ihren Raum wegen Renovierung.
  - **Path:** FM setzt Sperrung → System storniert automatisch alle betroffenen Buchungen → CloudEvent "Buchung storniert" wird publiziert → Subscriber erzeugt Postkorb-Task und/oder E-Mail.
  - **Climax:** Frau Berger erfährt vorab per Benachrichtigung, nicht erst vor dem gesperrten Raum.
  - **Resolution:** sie bucht proaktiv einen Ersatzplatz.

## 3. Glossar

- **Liegenschaft** — Eine der 50-100 Immobilien/Standorte des BAMF, mit Adresse und Geokoordinaten. Enthält ein oder mehrere Gebäude.
- **Gebäude** — Bauwerk innerhalb einer Liegenschaft. Enthält Räume.
- **Raum** — Räumliche Einheit innerhalb eines Gebäudes, mit fester Raumnummer. Typ: Büro-/Desk-Fläche oder Meetingraum.
- **Meetingraum** — Raum vom Typ Meetingraum: nur als Ganzes buchbar (nicht einzelplatzweise), in Halbstunden-Granularität. Verhält sich funktional grundlegend anders als ein Desk-haltender Raum.
- **Desk** — Einzelner buchbarer Arbeitsplatz innerhalb eines Raums. Kanonischer Begriff — "Platz", "Schreibtisch", "Arbeitsplatz" sind Synonyme in natürlicher Sprache, bedeuten aber immer Desk.
- **Zone** — Von Facility Management eingerichtete, optionale Gruppierung von Desks innerhalb einer Liegenschaft, die einem oder mehreren Referaten/Arbeitsgebieten ein Raumkontingent zuordnet (FR-44). Desks außerhalb jeder Zone bleiben uneingeschränkt buchbar (FR-5).
- **Bestuhlungsoption** — Von Facility Management für einen Veranstaltungs-/Besprechungsraum hinterlegte Bestuhlungsform (inkl. Standard-Bestuhlung) mit zugehöriger Umbaudauer (FR-53/FR-55).
- **Label** — Flexibles, von Facility Management vergebenes Merkmal einer Liegenschaft/eines Gebäudes/Raums/Desks (z.B. Ausstattung). Ergänzt die festen Eigenschaften (Raumnummer, Adresse, Geokoordinaten).
- **Präferenz** — Vom Mitarbeiter hinterlegte gewünschte Label-Kombination, gegen die Desks im Ranking bewertet werden (kein harter Filter).
- **Buchung** — Reservierung eines Desks (ganztags/halbtags) oder Meetingraums (halbstündig) für einen Zeitraum, durch oder im Auftrag eines Mitarbeiters.
- **Serienbuchung** — Buchung nach wiederkehrendem Muster über mehrere Termine bis zu einem Enddatum.
- **Vertretung** — Berechtigung einer Team-Assistenz/eines Managers, im Auftrag eines Mitarbeiters zu buchen/stornieren.
- **Sperrung** — Von Facility Management gesetzter Zustand, der einen Desk/Raum/eine Liegenschaft für einen Zeitraum von der Buchung ausschließt.
- **Vertrauliche Raumblockierung** — Blockierung eines gesamten Raums für vertrauliche Zwecke (z.B. VS-NFD) mit Pflicht-Begründung, ohne Freigabeprozess.
- **IDM-Kennung** — Pseudonymisierte Identität eines Mitarbeiters, Standard-Anzeige in Übersichten.
- **Facility Management (FM)** — Rolle, die Liegenschaften/Gebäude/Räume/Desks/Labels verwaltet, Sperrungen setzt, Defekte bearbeitet.
- **Defektmeldung** — Nutzererfasste Meldung zu einem beschädigten Desk/Raum/Ausstattungsgegenstand.
- **CloudEvent** — Standardisiertes Ereignis (z.B. "Buchung storniert"), über das EventGrid-System publiziert, löst Subscriber aus (Task, E-Mail, ...).
- **Genehmigungspflichtig** — Feste Eigenschaft eines Raums (nicht Teil des Label-Systems), die festlegt, dass eine Buchung erst nach Genehmigung durch den Raumverantwortlichen oder FM wirksam wird, statt direkt bestätigt zu werden.
- **Raumverantwortlicher** — Person, die einem genehmigungspflichtigen Raum zugewiesen ist und Buchungsanfragen für diesen Raum genehmigen oder ablehnen kann.
- **Buchungsanfrage** — Vorläufiger Buchungswunsch für einen genehmigungspflichtigen Raum, der erst nach Genehmigung zu einer bestätigten Buchung wird.

## 4. Features

### 4.1 Desk-Buchung

**Beschreibung:** Kernfunktion für den Regelfall. Zwei Wege parallel: Schnellpfad (Standardstandort, ein Klick) für Stammnutzer wie UJ-1, Explorationspfad (Kartenzoom) für unbekannte Standorte. Präferenzen ranken, filtern nicht hart.

#### FR-1: Desk-Schnellbuchung
Mitarbeiter kann einen Desk am hinterlegten Standardstandort mit einem Klick buchen, ohne Kartenauswahl. Realisiert UJ-1.

**Consequences (testable):**
- Standardstandort ist pro Nutzer konfigurierbar (zuletzt genutzt oder manuell gesetzt).
- Buchung ist nach einem Klick + einer Bestätigung abgeschlossen (max. 2 Interaktionen).

#### FR-2: Desk-Buchung über Kartenauswahl
Mitarbeiter kann über eine Kartenansicht (Land → Region → Stadt → Gebäude → Etage → Raum) eine beliebige Liegenschaft auswählen und dort einen Desk buchen.

#### FR-3: Präferenzbasiertes Ranking
System zeigt verfügbare Desks nach Übereinstimmung mit den hinterlegten Präferenzen des Mitarbeiters sortiert/hervorgehoben an.

**Consequences (testable):**
- Alle verfügbaren Desks bleiben sichtbar und buchbar, unabhängig vom Präferenz-Score (kein Hard-Filter).
- Bei fehlender Präferenz wird die Standard-Sortierung verwendet (z.B. Nähe/Verfügbarkeit).

#### FR-4: Ganztags-/Halbtags-Buchung
Mitarbeiter kann einen Desk standardmäßig ganztägig oder optional halbtags (Vormittag/Nachmittag) buchen.

**Consequences (testable):**
- Der Umschaltzeitpunkt Vormittag/Nachmittag ist pro Liegenschaft konfigurierbar.

#### FR-5: Uneingeschränkte Desk-Verfügbarkeit als Standard
Jeder Mitarbeiter kann jeden verfügbaren Desk an jeder Liegenschaft buchen, sofern die Liegenschaft/Zone nicht gemäß FR-44 mit einem Kontingent versehen ist.

**Consequences (testable):**
- Standardverhalten bleibt uneingeschränkt. Kontingentierung ist Opt-in pro Liegenschaft/Zone (FR-44), nicht systemweiter Default.

#### FR-5a: Konfliktvermeidung bei Desk-Buchung
System verhindert, dass derselbe Desk für überlappende Zeiträume doppelt gebucht wird.

**Consequences (testable):**
- Eine ganztägige Buchung kollidiert mit jeder bestehenden Halbtags- oder Ganztagsbuchung desselben Desks am selben Tag.
- Zwei Halbtagsbuchungen desselben Desks kollidieren nur, wenn sie sich über den liegenschaftsspezifischen Umschaltzeitpunkt (FR-4) hinweg überlappen.
- Bei Konflikt wird die Buchung abgelehnt, nicht die bestehende Buchung überschrieben.

#### FR-44: Referatsbezogenes Raumkontingent / Zonen (Opt-in)
FM kann pro Liegenschaft eine oder mehrere Zonen einrichten, die einem oder mehreren Referaten/Arbeitsgebieten zugeordnete Raumkontingente abbilden. Ist eine Zone aktiv, können nur Mitarbeitende der zugeordneten Referate dort Desks buchen; Büros außerhalb einer Zone bleiben für alle BAMF-Mitarbeitenden uneingeschränkt buchbar (FR-5).

**Consequences (testable):**
- Ohne eingerichtete Zone verhält sich eine Liegenschaft wie bisher (FR-5).
- Ein Desk ist immer entweder Teil genau einer Zone oder uneingeschränkt buchbar, nie beides.
- FM kann Zonen jederzeit auflösen (Rückkehr zu FR-5-Standardverhalten).

### 4.2 Meetingraum-Buchung

**Beschreibung:** Meetingräume sind ausschließlich als Ganzes buchbar, nicht als Einzelplätze, mit feinerer Zeitgranularität als Desks.

#### FR-6: Meetingraum als Ganzes buchbar
Mitarbeiter kann einen Meetingraum vollständig buchen; einzelne Plätze innerhalb eines Meetingraums sind nicht separat buchbar. Gilt direkt für Meetingräume ohne die Eigenschaft "genehmigungspflichtig" (FR-41); für genehmigungspflichtige Meetingräume siehe FR-39/FR-40.

#### FR-7: Halbstunden-Granularität
Meetingraum-Buchung erfolgt in 30-Minuten-Zeitslots.

#### FR-8: Konfliktvermeidung ohne Warteliste
System verhindert die Doppelbuchung eines Meetingraum-Slots.

**Consequences (testable):**
- Ein Slot ist entweder belegt oder frei; es existiert kein Warteschlangen-Mechanismus.
- Ein ausstehender Buchungsanfrage-Slot (FR-39) gilt für diese Konfliktprüfung als belegt, um doppelte Anfragen auf denselben Slot zu vermeiden.

**Out of Scope:**
- Warteliste/Benachrichtigung bei Freiwerden eines Slots.

#### FR-39: Genehmigungspflichtige Meetingraumbuchung
Ist ein Meetingraum als genehmigungspflichtig markiert (FR-41), erzeugt eine Buchung zunächst eine Buchungsanfrage statt einer direkt bestätigten Buchung.

**Consequences (testable):**
- Der Raum gilt für den angefragten Slot erst nach Genehmigung (FR-40) als gebucht.
- Der anfragende Mitarbeiter sieht den Status "ausstehend", bis eine Entscheidung vorliegt.

#### FR-40: Genehmigung oder Ablehnung einer Buchungsanfrage
Der zugewiesene Raumverantwortliche (FR-42) oder eine Person mit FM-Rolle kann eine Buchungsanfrage genehmigen oder ablehnen.

**Consequences (testable):**
- Der Anfragende wird über die Entscheidung benachrichtigt (Muster wie FR-29).
- Bei Ablehnung wird der Slot wieder freigegeben.
- `[Open Question]` Frist/SLA, innerhalb derer eine Entscheidung erfolgen muss, ist nicht festgelegt — siehe §12.

#### FR-46: Raum auf berechtigte Rolle/Einheit beschränken
FM kann einen Raum (insb. Meetingraum) so kennzeichnen, dass ausschließlich Mitarbeitende einer bestimmten Rolle oder Organisationseinheit (z.B. Veranstaltungsmanagement) ihn buchen können. Anders als bei genehmigungspflichtigen Räumen (FR-39/FR-41) können nicht-berechtigte Mitarbeitende den Raum weder buchen noch eine Buchungsanfrage stellen — er ist für sie in der Buchungsansicht nicht als buchbar erreichbar.

**Consequences (testable):**
- FR-46 und FR-41 (genehmigungspflichtig) schließen sich pro Raum nicht aus, sind aber unabhängige Mechanismen: FR-46 filtert, wer überhaupt anfragen darf; FR-41 legt fest, ob eine Anfrage genehmigt werden muss.
- Ein nicht-berechtigter Mitarbeiter sieht den Raum in Übersichten weiterhin (z.B. "wer sitzt wo"/Belegungsanzeige), kann ihn aber nicht auswählen.
- Realisiert den Fall "Südkaserne-Räume nur für Veranstaltungsmanagement".

#### FR-53: Bestuhlungsauswahl bei der Buchung
Mitarbeiter kann bei der Buchung eines Veranstaltungs-/Besprechungsraums neben der Standard-Bestuhlung eine der vom FM für diesen Raum hinterlegten alternativen Bestuhlungsformen auswählen (FR-55).

#### FR-54: Automatische Zusatzreservierung für Umbautage
Weicht die gewählte Bestuhlung (FR-53) von der Standard-Bestuhlung ab, reserviert das System automatisch die für den Umbau benötigten Tage zusätzlich, gemäß der pro Bestuhlungsoption hinterlegten Umbaudauer (FR-55).

**Consequences (testable):**
- Automatisch reservierte Umbautage unterliegen derselben Konfliktprüfung wie reguläre Buchungen (FR-8) — sie blockieren den Raum für andere Buchungen.
- Kollidiert ein Umbautag mit einer bestehenden Buchung, wird die Bestuhlungsauswahl abgelehnt, nicht die bestehende Buchung verdrängt (konsistent mit FR-5a/FR-8-Prinzip).

#### FR-56: Sichtbarkeit der Buchungszuordnung bei Meetingräumen
Alle Mitarbeitenden sehen bei einem gebuchten Meetingraum, für wen bzw. welche Einheit die Buchung erfolgt ist (Klarname oder Organisationseinheit) — abweichend von der Desk-Pseudonymisierung (FR-18).

#### FR-57: Rollen-differenziertes Bemerkungsfeld
Für Mitarbeitende mit VM-Rolle wird an einer Meetingraum-Buchung zusätzlich automatisch ein Bemerkungsfeld (aktuell eine Zeile Freitext) angezeigt, das Details zur Buchung enthält (z.B. Umbautag gemäß FR-54, oder für welche Veranstaltung der Raum benötigt wird). Andere Mitarbeitende sehen dieses Feld nicht.

### 4.3 Serienbuchung

**Beschreibung:** Wiederkehrende Buchungsmuster für Desk oder Meetingraum über einen definierten Zeitraum.

#### FR-9: Serienbuchung anlegen
Mitarbeiter oder Vertreter kann eine wiederkehrende Buchung nach Wochentagsmuster mit konfigurierbarem Intervall (wöchentlich, zweiwöchentlich, monatlich) bis zu einem frei wählbaren Enddatum anlegen (z.B. "jeden Mo+Di bis 31.12.2026"), begrenzt durch den Buchungshorizont (§5). Realisiert UJ-2.

**Consequences (testable):**
- Intervall-Optionen (wöchentlich/zweiwöchentlich/monatlich) gelten für Desk- und Meetingraum-Serien gleichermaßen.
- `[Open Question]` Die Liegenschaftsreferate-Anforderung beschreibt zusätzlich ein rollierendes Kurzhorizont-Muster ("x Wochen im Voraus für die darauffolgende Woche") — unklar, ob das eine FR-9-Variante oder ein eigener Mechanismus ist. Siehe §12.

#### FR-10: Automatischer Umgang mit Teilkonflikten
Bei Terminkollisionen innerhalb einer Serie überspringt das System die betroffenen Einzeltermine automatisch.

**Consequences (testable):**
- Die Serie wird mit den verbleibenden, konfliktfreien Terminen angelegt.
- Nutzer erhält nach Abschluss eine Liste der übersprungenen Termine.

**Out of Scope:**
- Alles-oder-nichts-Ablehnung der gesamten Serie; Einzelentscheidung pro Konflikt.

### 4.4 Vertretung (Buchung im Auftrag)

**Beschreibung:** Team-Assistenz und Manager können stellvertretend für Mitarbeitende handeln.

#### FR-11: Buchung/Stornierung im Auftrag
Team-Assistenz oder Manager mit gültiger Vertretungsberechtigung kann im Namen eines Mitarbeiters buchen oder stornieren. Realisiert UJ-2.

#### FR-12: Herkunft der Vertretungsberechtigung
Vertretungsberechtigung ergibt sich (a) automatisch aus der Linienorganisation (Vorgesetzter, zugeordnete Team-Assistenz) und (b) zusätzlich durch Self-Service-Delegation, bei der ein Mitarbeiter weitere Personen benennt.

**Consequences (testable):**
- Fehlt die Berechtigung, blockiert das System die Aktion und liefert eine strukturierte, maschinenlesbare Fehlerantwort (siehe §6.3), aus der eine UI eine menschenlesbare Meldung ableitet.

#### FR-13: Auditierbarkeit von Vertretungshandlungen
Jede im Auftrag durchgeführte Buchung/Stornierung wird dem betroffenen Mitarbeiter im Buchungskontext zugeordnet, mit dem ausführenden Vertreter separat protokolliert. `[Open Question]` Aufbewahrungsdauer und Zugriffsberechtigung für dieses Protokoll — siehe §12.

### 4.5 Stornierung

**Beschreibung:** Stornierung durch Mitarbeiter selbst oder berechtigten Vertreter, bewusst ohne erfassten Grund.

#### FR-14: Stornierung durch Mitarbeiter oder Vertreter
Mitarbeiter oder ein gemäß FR-12 berechtigter Vertreter kann eine bestehende Buchung stornieren.

#### FR-15: Kein erfasster Stornierungsgrund
System erfasst keinen Freitext- oder Kategorie-Grund für eine Stornierung.

**Consequences (testable):**
- Die Berechtigungsprüfung (FR-12) ist die einzige Voraussetzung für eine Stornierung im Auftrag.
- `[ASSUMPTION]` Damit wird bewusst vermieden, besondere Kategorien personenbezogener Daten (z.B. Gesundheitsdaten bei "krank") im System zu erfassen.

#### FR-43: FM-Zwangsstornierung unabhängig vom Anlass
Facility Management kann jede Buchung — einschließlich fest gebuchter Meetingräume und Desks — jederzeit und unabhängig vom Anlass stornieren, unabhängig von FR-27 (das nur die automatische Stornierung infolge einer Sperrung beschreibt).

**Consequences (testable):**
- Die Stornierung löst dieselbe Benachrichtigung wie jede andere Fremdstornierung aus (FR-29).
- `[NOTE FOR PM]` Aktive Kontaktaufnahme zur betroffenen Person (z.B. Telefonanruf) bei Zwangsstornierung fest gebuchter Termine ist eine Verfahrensempfehlung, bewusst **nicht** als blockierender Bestätigungs-/Eskalations-Workflow spezifiziert — siehe §9 Non-Goals. Ein komplexeres Verfahren (inkl. ggf. automatisierter Ersatzbuchung durch FM) wird erst nach ersten Produktionserfahrungen ausgearbeitet.

### 4.6 Vertrauliche Raumblockierung

**Beschreibung:** Sonderfall für vertrauliche Aufgaben (z.B. VS-NFD). Bewusst kein Kontrollmechanismus — die Reibung liegt allein darin, dass es ein separater, unübersehbarer Schritt ist, kein Standardpfad. Zu unterscheiden von genehmigungspflichtigen Räumen (§4.2, FR-39/FR-40): dort schützt eine Genehmigung eine knappe Ressource (z.B. einen begehrten Meetingraum), hier schützt bewusste Reibung ohne Prüfung eine vertrauliche Nutzung — zwei unterschiedliche Mechanismen für zwei unterschiedliche Zwecke, kein Widerspruch.

#### FR-16: Ganzen Raum für vertrauliche Zwecke blockieren
Mitarbeiter kann einen gesamten Raum (inkl. aller darin enthaltenen Desks) mit einer Pflicht-Begründung als Freitext blockieren.

**Consequences (testable):**
- Die Aktion ist ein eigenständiger Vorgang, getrennt vom regulären Buchungsfluss — nicht als Standardoption im normalen Buchungspfad angeboten.
- Ohne ausgefüllte Begründung ist die Blockierung nicht abschließbar.

#### FR-17: Keine Freigabeprüfung, aber Pflicht-Audit-Log
System führt keine Berechtigungs- oder Freigabeprüfung für eine vertrauliche Raumblockierung durch. `[NOTE FOR PM]` Diese Entscheidung ist vorläufig, bis die Prüfung mit dem BAMF-Geheimschutzbeauftragten (§12) stattgefunden hat.

**Consequences (testable):**
- Jede vertrauliche Raumblockierung wird in einem zugriffsbeschränkten Audit-Log erfasst (wer, wann, welcher Raum, Begründungstext) als kompensierende Mindestkontrolle, unabhängig davon, ob später ein Freigabeprozess ergänzt wird.
- Der Zugriff auf dieses Audit-Log ist auf eine noch zu benennende, eng begrenzte Rolle beschränkt (z.B. Geheimschutzbeauftragter), nicht auf reguläres Facility Management.

**Out of Scope (vorbehaltlich §12-Prüfung):**
- Approval-Workflow, Berechtigungsrollen (z.B. SÜG-Sicherheitsüberprüfung) für VS-NFD.

### 4.7 Sichtbarkeit & Präsenzanzeige

**Beschreibung:** Pseudonymisierung als Standard, mit kontrolliertem Klarnamen-Zugriff für Vertretungsbeziehungen und einer bewussten Opt-in-Ausnahme.

#### FR-18: Pseudonymisierte Standardansicht (Desk-Buchungen)
System zeigt "wer sitzt wo"-Übersichten für Desk-Buchungen standardmäßig nur mit IDM-Kennung, nicht mit Klarnamen. Gilt nicht für Meetingraum-/Veranstaltungsbuchungen — siehe FR-56.

**Consequences (testable):**
- `[NOTE FOR PM]` Diese Scope-Einschränkung auf Desk-Buchungen ist eine bewusste Auslegung des neuen Anforderungspunkts "alle sehen, für wen der Raum gebucht ist" — zu bestätigen, da sie von der bisherigen DSGVO-Einordnung (§6.1) abweicht, die "wer sitzt wo" generisch behandelte.

#### FR-19: Klarname im Vertretungskontext
Der Mitarbeiter, für den eine Buchung erfolgt, sowie seine gemäß FR-12 hinterlegten Vertreter sehen den Klarnamen im jeweiligen Buchungskontext — unabhängig davon, ob der Mitarbeiter selbst oder ein Vertreter die Buchung ausgeführt hat.

#### FR-20: Keine automatische Pseudonym-Auflösung
Eine Zuordnung von IDM-Kennung zu Klarname erfolgt nie automatisch in der Anzeige, sondern nur über einen separaten, bewussten IDM-Lookup-Schritt. `[Open Question]` Welche Rollen diesen Lookup auslösen dürfen und ob der Lookup selbst protokolliert wird — siehe §12.

#### FR-21: Freiwillige Namens-Offenlegung
Mitarbeiter kann optional seinen Klarnamen als eigenes Label hinterlegen; dieses ist dann für andere sichtbar.

**Consequences (testable):**
- Die Offenlegung ist ein aktiver Opt-in, keine Voreinstellung.

### 4.8 Facility-Management-Verwaltung

**Beschreibung:** FM verwaltet die physische und semantische Struktur — Hierarchie, feste Eigenschaften, flexible Labels, Sperrungen, Defekte.

#### FR-22: Verwaltung von Liegenschaft/Gebäude/Raum/Desk
FM kann Liegenschaften, Gebäude, Räume und Desks anlegen und pflegen, inklusive fester Eigenschaften (Raumnummer, Adresse, Geokoordinaten).

#### FR-23: Label-Vergabe
FM kann flexible Labels (z.B. Ausstattungsmerkmale) an Liegenschaft, Gebäude, Raum oder Desk vergeben.

#### FR-24: Dubletten-Vermeidung bei Labels
System schlägt beim Anlegen eines neuen Labels ähnliche, bestehende Labels vor.

**Consequences (testable):**
- `[ASSUMPTION]` Ähnlichkeit wird über eine textbasierte Distanzmetrik ermittelt (konkreter Schwellenwert der Implementierung vorbehalten, siehe `addendum.md`); die Vorschlagsfunktion ist keine Pflichtvoraussetzung zum Anlegen, sondern ein Hinweis.

#### FR-25: Manuelle Dubletten-Korrektur
FM kann bereits entstandene doppelte Labels manuell zusammenführen oder korrigieren.

#### FR-26: Zeitlich befristete oder offene Sperrung
FM kann einen Desk, Raum oder eine Liegenschaft für einen Zeitraum (befristet, oder ab Datum mit/ohne Enddatum) sperren.

#### FR-27: Automatische Stornierung bei nachträglicher Sperrung
Setzt FM eine Sperrung, die bestehende Buchungen betrifft, storniert das System diese automatisch und löst eine Benachrichtigung an die Betroffenen aus. Realisiert UJ-3.

#### FR-28: Defektmeldung
Mitarbeiter kann einen Desk, Raum oder Ausstattungsgegenstand als defekt melden; die Meldung ist für nachfolgende Nutzer und FM sichtbar.

**Consequences (testable):**
- Eine Defektmeldung setzt für sich genommen keine Sperrung und storniert keine bestehenden Buchungen; dafür muss FM die Meldung explizit in eine Sperrung (FR-26) überführen.

#### FR-41: Raum als genehmigungspflichtig markieren
FM kann einen Raum (insbesondere Meetingräume) als genehmigungspflichtig kennzeichnen.

**Consequences (testable):**
- Diese Eigenschaft ist strukturell am Raum-Datensatz verankert — eine feste Eigenschaft wie Raumnummer, nicht Teil des flexiblen Label-Systems (FR-23).

#### FR-42: Raumverantwortliche zuweisen
FM kann einem genehmigungspflichtigen Raum eine oder mehrere Personen als Raumverantwortliche zuweisen.

#### FR-45: Zonen- und Kontingentverwaltung
FM kann Zonen (FR-44) anlegen, Referate/Arbeitsgebiete zuordnen, Desks einer Liegenschaft einer Zone zu- oder abweisen sowie Zonen jederzeit auflösen. FM kann zusätzlich Buchungsberechtigungen für einzelne Räume/Zonen auf bestimmte Rollen oder Organisationseinheiten beschränken (siehe FR-46, harte Zugriffsbeschränkung — unabhängig vom Zonenmodell).

**Consequences (testable):**
- Änderungen an Zonenzuordnung wirken nicht rückwirkend auf bereits bestätigte Buchungen (kein automatischer Storno wie bei FR-26/FR-27 Sperrung — Zonenzuordnung ist Zugriffssteuerung, keine Sperrung).
- FM-Rolle ist hierfür ausreichend; keine zusätzliche Rolle nötig.

#### FR-50: Anonymisierte Auslastungsauswertung
FM kann aggregierte Auslastungskennzahlen (z.B. Buchungsquote pro Liegenschaft/Zone/Zeitraum) einsehen, ohne Rückschluss auf einzelne Mitarbeitende.

**Consequences (testable):**
- Auswertung erfolgt ausschließlich aggregiert — keine Einzelbuchungs-Drilldown-Ansicht, auch nicht auf IDM-Kennungs-Ebene (strenger als FR-18, das Einzelbuchungen pseudonymisiert weiterhin anzeigt).
- `[ASSUMPTION]` Eine Mindestgruppengröße pro Auswertungssegment (z.B. keine Anzeige für Segmente < N Buchungen) wird angenommen, um Re-Identifikation bei kleinen Gruppen zu verhindern — konkreter Schwellenwert Implementierungsdetail.

#### FR-51: Übernahme bestehender Raumstammdaten und Grundrisspläne
System ermöglicht den Import bestehender Raumstammdaten (z.B. Raumnummer, Beschreibung aus Tabellenformat) sowie die Zuordnung bestehender Grundrisspläne (PDF/JPG) zu Liegenschaften/Gebäuden, aus denen Räume und Desks für die Buchung ausgewählt werden können.

**Consequences (testable):**
- Import ist ein FM-Werkzeug (einmalig pro Liegenschaft bei Onboarding), kein laufender Sync — Abgrenzung zu FR-22 (laufende manuelle Pflege).
- Grundrisspläne, die nicht als navigierbare Kartierung vorliegen, blockieren die Buchbarkeit der Liegenschaft nicht — Fallback ist eine Listenansicht ohne Grundriss (siehe Empty-States im UX-Design, bereits vorgesehen).

#### FR-52: Übernahme bestehender Buchungen aus dem Vorgängersystem
System ermöglicht die automatisierte Übertragung bestehender/offener Buchungen aus dem aktuellen Raumbelegungstool in das neue System.

**Consequences (testable):**
- Betrifft nur Meetingraum-/Veranstaltungsbuchungen, die zum Migrationszeitpunkt noch in der Zukunft liegen — keine Übernahme historischer, bereits abgeschlossener Buchungen.
- `[Open Question]` Datenformat/Schnittstelle des aktuellen Raumbelegungstools ist noch nicht bekannt, siehe §12 und `addendum.md`.

#### FR-55: Verwaltung von Bestuhlungsoptionen pro Raum
FM kann für einen Veranstaltungs-/Besprechungsraum verfügbare Bestuhlungsoptionen (inkl. Standard-Bestuhlung) hinterlegen, jeweils mit der Anzahl benötigter Umbautage (FR-54).

**Consequences (testable):**
- Bestuhlungsoptionen sind strukturelle Raum-Eigenschaften wie FR-41 (genehmigungspflichtig), nicht Teil des flexiblen Label-Systems (FR-23) — sie steuern automatisches Buchungsverhalten (FR-54), keine reine Anzeige-Eigenschaft.

### 4.9 Benachrichtigungen

**Beschreibung:** Buchungs-Lifecycle-Ereignisse lösen Benachrichtigungen an Betroffene aus. Der konkrete Mechanismus (Event-driven über CloudEvents/EventGrid) ist in `addendum.md` dokumentiert; hier die produktseitige Anforderung.

#### FR-29: Benachrichtigung bei Fremdeingriff in eine Buchung
System benachrichtigt betroffene Mitarbeitende, wenn ihre Buchung durch eine Sperrung (FR-27), eine Stornierung im Auftrag (FR-11) oder einen Serienkonflikt (FR-10) verändert oder storniert wurde. Realisiert UJ-3 gemeinsam mit FR-27 — FR-27 liefert die Stornierung, FR-29 den Benachrichtigungs-Klimax.

**Consequences (testable):**
- Benachrichtigung erfolgt über mindestens einen konfigurierbaren Kanal (z.B. Postkorb-Aufgabe, E-Mail).
- Das auslösende Ereignis ist unabhängig vom jeweils verdrahteten Kanal als eigenständiges, konsumierbares Ereignis beobachtbar (Architektur-Umsetzung siehe `addendum.md`).

#### FR-49: Proaktive Erinnerung vor Buchungsbeginn/Check-in-Frist
System sendet eine Erinnerung an den Buchenden vor Beginn einer bevorstehenden Buchung sowie — falls Check-in-Pflicht (FR-47) aktiv ist — vor Ablauf des Check-in-Zeitfensters.

**Consequences (testable):**
- Nutzt denselben konfigurierbaren Kanal-Mechanismus wie FR-29 (Postkorb-Aufgabe, E-Mail, …), aber als eigenständiges Ereignis — nicht an einen Fremdeingriff gebunden.
- `[Open Question]` Vorlaufzeit der Erinnerung (z.B. X Stunden vor Buchungsbeginn) ist konfigurierbar oder fix — Implementierungsdetail, siehe §12.
- Betrifft nur reguläre Buchungen; vertrauliche Raumblockierungen (§4.6) sind wie beim Chat-Pfad (FR-33) bewusst ausgenommen — Konsistenz mit der dortigen Begründung (bewusste Reibung/Unauffälligkeit).

### 4.10 Chat-basierte Buchung

**Beschreibung:** Ab Release 2 ein vollwertiger, paralleler Weg zum Klick-Pfad — kein Anhängsel. R2a deckt Buchungen ab, R2b erweitert auf FM-Verwaltung. Antworten sind interaktive Komponenten, kein reiner Fließtext.

#### FR-30: Konversationsbasierte Buchung *(R2a)*
Mitarbeiter kann Desk-, Meetingraum- und Serienbuchungen vollständig über einen Chat-Dialog durchführen — funktional gleichwertig zu den Klick-Pfaden aus §4.1–§4.3.

#### FR-31: Generative UI-Komponenten im Chat
Der Chat-Dialog liefert interaktive Komponenten (z.B. Kartenausschnitt, Kalender, auswählbare Desk-Karten) statt reinen Fließtexts.

#### FR-32: Konversationsbasierte FM-Verwaltung *(R2b)*
Facility Management kann Label-Vergabe, Sperrungen und Defektbearbeitung über denselben Konversations-Flow durchführen.

#### FR-33: Chat als paralleler, nicht ersetzender Weg
Der Chat-Pfad ersetzt den Klick-Pfad (§4.1 Schnellpfad/Explorationspfad) nicht; beide bleiben dauerhaft vollständig nutzbar.

**Out of Scope:**
- Release 1 enthält keinen Chat-Pfad (siehe §10 MVP Scope).
- Der Gleichwertigkeitsanspruch von FR-30 bezieht sich ausdrücklich nur auf §4.1–§4.3 (Desk-, Meetingraum-, Serienbuchung). Vertretung (§4.4) über Chat ist erst mit einer expliziten künftigen Erweiterung vorgesehen, nicht automatisch mit R2a enthalten.
- Vertrauliche Raumblockierung (§4.6) ist dauerhaft vom Chat-Pfad ausgeschlossen — ihre einzige Kontrolle ist die bewusste Reibung eines separaten, unübersehbaren Schritts (FR-16/17), die ein Konversationsfluss aufheben würde. Diese Ausnahme gilt auch für FR-32 (R2b).

### 4.11 Semantische Datenschicht

**Beschreibung:** Durchgängige, maschinenprüfbare Bedeutung aller Kern-Entitäten — der eigentliche Wert liegt in garantierter Konsistenz zwischen Frontend, Backend, API und späteren KI-Tool-Calls (§4.10), nicht darin, dass ein Sprachmodell Synonyme sonst nicht verstünde. `[ASSUMPTION]` Dies ist ein selbst gesetzter Qualitätsanspruch ohne externes Mandat (kein bekannter externer Konsument) — Aufwand hierfür wird bewusst in Kauf genommen.

#### FR-34: Publizierte RDF-Vokabulare
System stellt eigene, versionierte RDF-Vokabulare als statische Dateien über HTTP bereit.

#### FR-35: SHACL-Shapes über Endpunkt
System stellt SHACL-Shapes für die Kern-Entitäten des Glossars (§3) über einen Endpunkt bereit.

#### FR-36: Semantische Verlinkung in OpenAPI
System stellt eine OpenAPI-Spezifikation für alle Backend-Operationen bereit; jede API-Ressource und -Operation ist darin über eine definierte x-Extension mit ihrer RDF-Klasse/Property bzw. SHACL-Shape verlinkt.

#### FR-37: JSON-LD-Auslieferung
API-Antworten sind als JSON-LD auslieferbar.

#### FR-38: schema.org als Basis
Eigene Vokabulare referenzieren schema.org, wo passende Begriffe existieren; eigene Begriffe werden nur definiert, wo schema.org keine Entsprechung bietet.

### 4.12 Check-in

**Beschreibung:** Optionale, von FM pro Liegenschaft aktivierbare Pflicht, eine Buchung durch Check-in zu bestätigen; verhindert "Geisterbuchungen" und gibt ungenutzte Plätze automatisch frei.

#### FR-47: Check-in-Pflicht (konfigurierbar)
FM kann pro Liegenschaft festlegen, ob Buchungen (Desk und/oder Meetingraum) einen Check-in innerhalb eines Zeitfensters nach Buchungsbeginn erfordern.

**Consequences (testable):**
- Standardmäßig ist keine Liegenschaft check-in-pflichtig (Opt-in wie FR-44).
- `[Open Question]` Check-in-Mechanismus (App-Tap, QR-Code am Desk, o.ä.) und Länge des Zeitfensters sind Implementierungsdetail, siehe §12.

#### FR-48: Automatische Freigabe bei Nichteinchecken
Checkt der Buchende nicht innerhalb des Zeitfensters (FR-47) ein, storniert das System die Buchung automatisch und gibt den Desk/Raum frei.

**Consequences (testable):**
- Löst dieselbe Benachrichtigung aus wie andere Fremdeingriffe (FR-29).
- Bei Buchung im Auftrag (FR-11) trifft die Check-in-Pflicht den Mitarbeiter, für den gebucht wurde, nicht den Vertreter.

## 5. Cross-Cutting NFRs

- **Performance:** Buchungsvorgang über den Schnellpfad (FR-1) muss in ≤10 Sekunden abschließbar sein.
- **Skalierung:** System muss gleichzeitige Buchungsvorgänge über 50-100 Liegenschaften korrekt verarbeiten, ohne Race Conditions bei Slot-Konflikten (FR-5a, FR-8, FR-10).
- **Beobachtbarkeit:** System emittiert OpenTelemetry-konforme Traces/Metriken (siehe `addendum.md`).
- **Barrierefreiheit:** Alle Oberflächen erfüllen BITV 2.0 / WCAG 2.1 AA. `[Open Question]` Konkrete Konformitätskriterien pro Komponententyp (insbesondere Kartenexploration FR-2 und generative Chat-UI FR-31, siehe §12) sowie Barrierefreiheitserklärung und Feedback-Mechanismus sind vor Launch mit dem Barrierefreiheitsbeauftragten festzulegen.
- **Sicherheit:** Rollenbasierte Zugriffskontrolle für Vertretung (FR-12), Pseudonym-Auflösung (FR-20), vertrauliche Raumblockierung (FR-17) und Genehmigung von Buchungsanfragen (FR-40, FR-42) ist Pflicht; konkrete Rollenmodell-Details siehe `addendum.md`.
- **Buchungshorizont:** Meetingraum-Buchungen (inkl. Serientermine, FR-9) müssen mindestens bis zum Ende des jeweiligen Folgejahres im Voraus möglich sein (Stand 2026: bis Jahresende 2027) — rollierend, nicht als fixes Enddatum. `[Open Question]` Ob und welcher Horizont für Desk-Buchungen gilt, ist offen — siehe §12.

## 6. Constraints & Guardrails

### 6.1 Compliance & Regulatorik

- **BITV 2.0 / WCAG 2.1 AA** — rechtlich verbindlich für Bundesbehörden, gilt für alle Oberflächen inkl. Barrierefreiheitserklärung und Feedback-Mechanismus.
- **DSGVO** — Pseudonymisierung als Standard (§4.7); keine Erfassung besonderer Datenkategorien (FR-15).
- **VS-NFD-Handhabung** — `[NOTE FOR PM]` Blockierung ohne Freigabeprüfung (§4.6, FR-17) ist eine bewusste, aber vorläufige Entscheidung mit Pflicht-Audit-Log als Mindestkontrolle — sie gilt erst als final, wenn sie mit dem tatsächlichen BAMF-Geheimschutzbeauftragten gegengeprüft wurde (§12).
- **Personalrat/Mitbestimmung** — `[Open Question]` Ein System, das erfasst, wer wo sitzt und wer für wen bucht/storniert, löst voraussichtlich Mitbestimmungsrechte des Personalrats aus. Klärung und ggf. Dienstvereinbarung sind ein Rollout-Gate, siehe §8/§12.
- **DSFA/DPIA** — `[Open Question]` Systematische Anwesenheitserfassung über 50-100 Standorte ist ein plausibler Art.-35-DSGVO-Trigger; Klärung mit dem BAMF-Datenschutzbeauftragten steht aus, siehe §12.

### 6.2 Data Governance

- Stammdaten (Liegenschaften/Räume/Desks/Labels) und Bewegungsdaten (Buchungen) liegen in getrennten DB-Schemas. `[ASSUMPTION]` Diese Trennung ist die Grundlage für unterschiedliche Aufbewahrungsregeln je Datenklasse (siehe Open Question §12).
- Deployment-Technologie ist festgelegt (containerisiert, Kubernetes in Produktion — siehe `addendum.md`). `[Open Question]` Konkreter Hosting-Betreiber und BSI-C5-Zertifizierung/EVB-IT-Cloud-Konformität sind noch zu klären.
- `[Open Question]` Aufbewahrungs- und Löschkonzept je Datenklasse (Bewegungsdaten, Vertretungs-Audit-Log FR-13, VS-NFD-Audit-Log FR-17) fehlt bislang vollständig — siehe §12.
- `[Open Question]` Kein Zusammenhang zwischen Mitarbeiter-Austritt (HR-Integration, siehe `addendum.md`) und Löschung/Anonymisierung von Stammdaten, Bewegungsdaten und Labels (inkl. FR-21 Klarnamens-Label) — siehe §12.

### 6.3 Architektur-Voraussetzungen für Release 2a

Release 1 muss so gebaut werden, dass Release 2a (Chat-Buchung, §4.10) die Release-1-API direkt nutzen kann, ohne Neubau:

- Benannte/eigenständige Operationen (FR-1–FR-29 als diskrete Backend-Operationen, nicht als UI-Nebeneffekt).
- Stabile Bezeichner für Kernobjekte, unabhängig von Label-Texten.
- Strukturierte statt textuelle Fehlerantworten (siehe FR-12-Konsequenz).

Details siehe `addendum.md` ("API-Design-Grundsätze für Release 1").

**Warum das die semantische Datenschicht (§4.11) erfordert:** Der Release-2a-Chat-Agent (Google Agent ADK, siehe `addendum.md`) muss zur Laufzeit wissen, welche Backend-Operation zu welcher Nutzeräußerung passt und welche Felder eine Operation erwartet. Ohne veröffentlichte, versionierte RDF-Vokabulare und SHACL-Shapes (FR-34, FR-35) müsste der Agent dieses Wissen aus unstrukturiertem OpenAPI-Freitext (Beschreibungsfeldern) ableiten — das bricht bei jeder Backend-Umbenennung und ist nicht über verschiedene Frameworks/LLMs hinweg stabil überprüfbar. Mit FR-34–FR-38 bindet der Agent stattdessen gegen maschinenlesbare, versionierte Shapes, die unabhängig vom konkreten LLM oder Chat-Framework Bestand haben. Das ist der konkrete Bruchfall, den die semantische Datenschicht verhindert: Sie liefert die maschinenlesbare Grundlage für die drei Bedingungen oben, nicht nur eine thematische Nähe zu ihnen.

## 7. Integration & Abhängigkeiten

Kurzgefasst (Details in `addendum.md`): BAMF-IDM/IAM (Keycloak), BAMF-Stammdaten/Codelisten, HR-System, EventGrid/CloudEvents, OpenTelemetry, TaskManagement.

## 8. Rollout & Change Management

`[ASSUMPTION, aus Marktrecherche]` Phasierter Rollout (1-2 Pilot-Liegenschaften vor Ausrollung auf alle 50-100 Standorte) statt Big-Bang — Adoption ist laut Marktrecherche primär ein Organisations-, kein Software-Problem. `[Open Question]` Welcher Standort eignet sich als Pilot?

## 9. Non-Goals (Explicit)

- Keine externe Nutzung (Besucher, andere Behörden, Dienstleister) in v1.
- Keine systemweite Kontingentsteuerung nach Team/Referat als Zwangsdefault — siehe FR-44 für das Opt-in-Zonenmodell.
- Keine Warteliste für Meetingräume.
- Keine Einkaufslösung — bewusste Build-Entscheidung (siehe `.memlog.md`).
- Kein automatisierter Eskalations-/Bestätigungs-Workflow bei FM-Zwangsstornierung (FR-43) in v1 — bewusst einfach gehalten, wird nach ersten Produktionserfahrungen ausgearbeitet.
- Keine automatisierte Ersatzbuchung durch FM bei Zwangsstornierung in v1 — FM kann bei Bedarf manuell umbuchen, kein automatisierter Prozess.

*Bewusst nicht (mehr) hier gelistet:* Ein Approval-Workflow für vertrauliche Raumblockierung ist aktuell nicht vorgesehen (§4.6, FR-17), aber nicht als endgültiges Non-Goal festgeschrieben — das hängt von der noch ausstehenden Prüfung durch den Geheimschutzbeauftragten ab (§12).

## 10. MVP Scope

### 10.1 In Scope (Release 1)

Desk-Buchung inkl. optionaler Zonen-/Kontingentverwaltung (§4.1, FR-44/FR-45), Meetingraum-Buchung inkl. genehmigungspflichtiger Räume, harter Zugriffsbeschränkung und Bestuhlungsauswahl (§4.2, FR-39/FR-40, FR-46, FR-53–FR-55), Serienbuchung (§4.3), Vertretung (§4.4), Stornierung inkl. FM-Zwangsstornierung (§4.5, FR-43), Vertrauliche Raumblockierung (§4.6), Sichtbarkeit/Pseudonymisierung inkl. abweichender Meetingraum-Sichtbarkeit (§4.7, FR-56/FR-57), FM-Verwaltung inkl. Raumverantwortliche, Auslastungsauswertung und Datenübernahme (§4.8, FR-41/FR-42, FR-50–FR-52), Benachrichtigungen inkl. Erinnerungen (§4.9, FR-49), Check-in (§4.12, FR-47/FR-48), semantische Datenschicht (§4.11, FR-34–38) — von Anfang an mitgebaut, nicht nachgerüstet, da Architektur-Voraussetzung für Release 2a.

### 10.2 Out of Scope für MVP

- Chat-basierte Buchung → Release 2a.
- Chat-basierte FM-Verwaltung → Release 2b.
- `[NOTE FOR PM]` "Chat wird bevorzugt" als Erfolgskriterium — erst messbar nach Release-2a-Betrieb, siehe §11.

## 11. Success Metrics

**Primary**
- **SM-1:** Adoptionsrate — Anteil der Desk-Buchungen, die über das System statt informell (Zuruf, Excel, o.ä.) erfolgen. `[Open Question]` Zielwert und Messzeitraum noch offen. Validiert FR-1, FR-2.
- **SM-2:** Buchungsdauer Schnellpfad — P90-Zeit von Start bis Bestätigung ≤10 Sekunden. Validiert FR-1.

**Secondary**
- **SM-3:** Serienbuchungsnutzung — Anteil Buchungen als Serie statt Einzelbuchung. Validiert FR-9.
- **SM-4:** Vertretungsnutzung — Anzahl/Anteil Buchungen im Auftrag. Validiert FR-11.
- **SM-5** *(erst relevant nach Release 2a)*: Anteil komplexer Buchungen (Serien, VS-NFD, Präferenzen-Einrichtung), die über Chat statt Klick-Pfad laufen. Validiert FR-30.

**Counter-metrics (nicht optimieren)**
- **SM-C1:** Fehlbuchungsrate (z.B. falscher Standort/Zeitraum aus Versehen) — darf nicht durch zusätzliche Bestätigungsschritte gesenkt werden, die die 10-Sekunden-Zielzeit (SM-2) gefährden. Balanciert SM-2 aus.
- **SM-C2:** Beschwerden über fehlende Team-Nachbarschaft im Präferenz-Ranking außerhalb aktiver Zonen (FR-44) — dort greift weiterhin Ranking statt Kontingent. Balanciert SM-1 aus.

## 12. Open Questions

1. **Rollout:** Konkreter Pilot-Standort für den phasierten Rollout (§8).
2. **Hosting/Infrastruktur:** Hosting-Betreiber und BSI-C5-/EVB-IT-Cloud-Konformität (§6.2) — inkl. Prüfung, ob der Release-2-Chat-Backend-Anbieter (Google Agent ADK, siehe `addendum.md`) dieselbe Anforderung erfüllt.
3. **Compliance:** VS-NFD-Handhabung final mit dem BAMF-Geheimschutzbeauftragten abstimmen (§6.1, FR-17) — inkl. wer Zugriff auf das neue Pflicht-Audit-Log erhält.
4. **Integration:** Detaillierte Integrationsspezifikation zu IDM/IAM, HR-System (DataGrid Services), Stammdaten/Codelisten (siehe `addendum.md`).
5. **Metrics:** Zielwert und Messzeitraum für Adoptionsrate (SM-1).
6. **Integration:** Konkrete Benachrichtigungskanäle (E-Mail-System, Postkorb-System) technisch festlegen (siehe `addendum.md`).
7. **Compliance:** Personalrat-Mitbestimmung/Dienstvereinbarung klären, bevor der Pilot-Rollout (§8) startet — vergleichbare Prüfung wie bei VS-NFD (Punkt 3).
8. **Compliance:** DSFA/DPIA (Art. 35 DSGVO) mit dem BAMF-Datenschutzbeauftragten klären und terminieren — Gate vor Pilot-Rollout.
9. **Data Governance:** Aufbewahrungs- und Löschkonzept je Datenklasse festlegen (Bewegungsdaten, Vertretungs-Audit-Log FR-13, VS-NFD-Audit-Log FR-17) — mit dem BAMF-Datenschutzbeauftragten, analog zu Punkt 3.
10. **Data Governance:** Zusammenhang Mitarbeiter-Austritt ↔ Datenlöschung/-anonymisierung (Stammdaten, Bewegungsdaten, Labels inkl. FR-21) festlegen.
11. **Sicherheit:** Welche Rollen dürfen Pseudonym-Auflösung (FR-20) auslösen, und wird der Lookup selbst protokolliert?
12. **Barrierefreiheit:** BITV 2.0/WCAG-2.1-AA-Konformitätskriterien pro Komponententyp mit dem Barrierefreiheitsbeauftragten festlegen, insbesondere für Kartenexploration (FR-2) und generative Chat-UI (FR-31).
13. **Prozess:** Frist/SLA für die Genehmigung einer Buchungsanfrage bei genehmigungspflichtigen Räumen (FR-40) — z.B. automatische Eskalation an FM, wenn der Raumverantwortliche nicht rechtzeitig entscheidet?
14. **Check-in:** Mechanismus (App/QR/o.ä.) und Zeitfenster-Länge für FR-47/48.
15. **Erinnerungen:** Vorlaufzeit vor Buchungsbeginn/Check-in-Frist (FR-49) — konfigurierbar oder fix?
16. **Migration:** Format/Schnittstelle des aktuellen Raumbelegungstools (Bestandsbuchungen, FR-52) sowie Konvertierungsansatz für PDF/JPG-Grundrisspläne zu navigierbaren Kartierungen (FR-51).
17. **Buchungshorizont:** Gilt für Desk-Buchungen ebenfalls ein maximaler Vorausbuchungshorizont, oder bleibt dieser unbegrenzt (Unterschied zum NFR-Buchungshorizont für Meetingräume, §5)?
18. **Sichtbarkeit Meetingraum-Buchung (FR-56):** Klarname der buchenden Person oder nur die Organisationseinheit? Beeinflusst DSGVO-Einordnung von §6.1 und muss mit dem Datenschutzbeauftragten abgestimmt werden, analog zu Punkt 8/9.
19. **Serienbuchung:** Ist das rollierende Kurzhorizont-Muster der Liegenschaftsreferate (FR-9-Ergänzung) eine Variante von FR-9 oder ein eigenständiger Mechanismus? Mit Fachbereich klären.
20. **Rollenmodell:** Mapping der genannten Rollen "VL"/"GZ" (Mehrfachbuchung, vermutlich Geschäftszimmer ~ Team-Assistenz) sowie "zentral/12E/12F/RL" (Sperr-/Löschberechtigung) auf das bestehende Vertretungs-/FM-Rollenmodell (FR-12, FR-26, FR-43) — inkl. ob eine liegenschaftsskalierte Admin-Ebene (Rechte nur für bestimmte Liegenschaften) nötig ist (§6.1, Vergabe von Rechten/Rollen).
21. **Rollenmodell:** Mengen-/Rate-Limit für Mehrfachbuchungen durch VL/GZ ("mehrere APL an einem Tag/Woche/Monat") — gibt es eine Obergrenze pro Rolle?
22. **Integration:** Ist "PVSplus" identisch mit dem in `addendum.md` genannten "HR-System (DataGrid Services)", oder ein zusätzliches System? Falls zusätzlich: Verhältnis zu Org-Sync (FR-12) klären.
23. **Synergie Alarmserver:** Prüfung angefragt, ob Anwesenheitsdaten für Notfall-/Evakuierungszwecke genutzt werden können — steht in Spannung zu FR-18–20 (Pseudonymisierung als Standard), da Notfallzugriff vermutlich Klarnamen/Ist-Anwesenheit braucht. Mit Datenschutzbeauftragtem klären, analog Punkt 8/9/18.

## 13. Assumptions Index

- §4.5, FR-15 — Kein erfasster Stornierungsgrund, um Verarbeitung besonderer Datenkategorien (Gesundheitsdaten) zu vermeiden.
- §4.8, FR-24 — Label-Ähnlichkeit über textbasierte Distanzmetrik, konkreter Schwellenwert der Implementierung vorbehalten.
- §4.11 — Semantische Datenschicht ist selbst gesetzter Qualitätsanspruch, kein externes Mandat.
- §6.2 — Stammdaten/Bewegungsdaten in getrennten DB-Schemas.
- §8 — Phasierter Rollout empfohlen (aus Marktrecherche, noch nicht explizit bestätigt).
- §4.8, FR-50 — Mindestgruppengröße pro Auswertungssegment zur Re-Identifikations-Vermeidung, konkreter Schwellenwert offen.
