---
title: Sprint Change Proposal — Neue Anforderungen Liegenschaftsreferate & Veranstaltungsmanagement
status: approved
created: 2026-08-20
against-prd: prd-DeskSharing-2026-08-13/prd.md (status: final)
---

# Sprint Change Proposal: Neue Anforderungen Liegenschaftsreferate & Veranstaltungsmanagement

## 1. Issue Summary

Nach Fertigstellung des PRD (`prd-DeskSharing-2026-08-13/prd.md`, Status `final`) wurden zwei neue, direkt von Stakeholdern formulierte Anforderungstexte übermittelt — von den Liegenschaftsreferaten und vom Veranstaltungsmanagement (VM). Ein Abgleich gegen PRD, Addendum, Forged-Idea und UX-Design (`ux-DeskSharing-2026-08-14/`) ergab:

- **Ein direkter Widerspruch:** Die Liegenschaftsreferate fordern referatsbezogene Raumkontingente/Zonen. Das PRD hatte genau das in FR-5 und §9 (Non-Goals) bewusst ausgeschlossen ("Keine Kontingentsteuerung nach Team/Referat") und SM-C2 als Kompensations-Metrik dafür eingeführt.
- **Ein fehlender Mechanismus, in beiden Anforderungstexten unabhängig genannt:** eine harte, rollenbasierte Buchungsbeschränkung (z.B. Südkaserne-Räume nur für VM) — verschieden von der bereits vorhandenen Genehmigungspflicht (FR-39/40, die nur *genehmigt*, nicht *ausschließt*).
- **Zwölf weitere, im PRD schlicht nicht vorhandene Fähigkeiten** (Check-in/No-Show, Erinnerungen, Auslastungsreporting, Datenmigration, Bestuhlung/Umbautage, Buchungshorizont, rollen-differenziertes Bemerkungsfeld u.a.).
- **Fünf offene Klärungsfragen**, die nicht durch eine Design-Entscheidung allein auflösbar sind (Rollen-Mapping VL/GZ, PVSplus-Systemidentität, Alarmserver-Synergie vs. Pseudonymisierung, liegenschaftsskalierte Admin-Rollen, rollierendes vs. festes Serienmuster).

Projektstand: Das Projekt befindet sich noch in der PRD-Phase — es existieren noch keine Epics/Stories und keine eigenständige Architecture (nur `addendum.md` mit technischen Notizen). Der Change wurde daher ausschließlich gegen PRD, Addendum und UX-Design geprüft.

## 2. Impact Analysis

### Epic Impact
N/A — es existieren noch keine Epics/Stories (`bmad-create-epics-and-stories` wurde noch nicht durchlaufen). Kein Rollback-Bedarf, da noch nichts implementiert ist.

### Artifact Conflicts

**PRD** (`prd-DeskSharing-2026-08-13/prd.md`) — Action-needed:
- FR-5 + §9 Non-Goal + SM-C2 müssen angepasst werden (Widerspruchsauflösung).
- 14 neue FRs (FR-44 bis FR-57) über §4.1–§4.9.
- 1 neue NFR (Buchungshorizont, §5).
- 1 FR-Verfeinerung (FR-9, Serienintervalle).
- 1 Scope-Klärung an bestehendem FR (FR-18).
- 10 neue Einträge in §12 Open Questions (14–23).
- 1 neuer Eintrag in §13 Assumptions Index.

**Addendum** (`addendum.md`) — Action-needed:
- Neue Integrationspunkte: bestehendes Raumbelegungstool (Bestandsbuchungen), Referat 12E (Raumstammdaten/Grundrisspläne).
- PVSplus-vs-DataGrid-Services-Klärung als offener Punkt übernommen.

**UX Design** (`ux-DeskSharing-2026-08-14/`) — Action-needed, aber teilweise bereits vorbereitet:
- Sidebar-IA und Baumstruktur (`DESIGN.md`) kennen keine "Zone"-Ebene — Facility-Management-Baumstruktur muss um Zonen-Knoten erweitert werden.
- Grundriss-Visualisierung (SVG-Pattern) existiert bereits als UI-Baustein (`mockups/gezielte-buchung-raumplan/`) — reduziert Aufwand für FR-51, deckt aber nicht die PDF/JPG-Konvertierung ab.
- Fehlende Screens/Komponenten: Check-in-Flow, Erinnerungs-Benachrichtigung, Auslastungs-Reporting-Dashboard, Bestuhlungsauswahl, VM-Bemerkungsfeld, Zonen-Verwaltung im FM-Baum.
- KPI-Kachel-Komponente (bereits im Design-System definiert, siehe Genehmigungscenter) ist direkt für FR-50-Reporting wiederverwendbar.

**Sonstige Artefakte** (Deployment, IaC, Monitoring, Tests, CI/CD): N/A — vor Implementierungsbeginn nicht relevant.

### Technical Impact
Keiner unmittelbar (kein Code existiert). Mittelbar: FR-44/45 (Zonen), FR-46 (Zugriffsbeschränkung), FR-47/48 (Check-in) und FR-53–55 (Bestuhlung) führen neue Entitäten/Zustandsmaschinen ein, die bei der kommenden Architektur-Phase (`bmad-architecture`) mitgedacht werden müssen — insbesondere deren Zusammenspiel mit der bestehenden Konfliktprüfung (FR-5a/FR-8) und der semantischen Datenschicht (§4.11, FR-34–38), da neue Entitäten auch neue RDF/SHACL-Shapes brauchen.

## 3. Recommended Approach

**Gewählter Ansatz: Hybrid aus Direct Adjustment (Option 1) für alle additiven Punkte + expliziter Konfliktauflösung für FR-5.**

Für den FR-5-Widerspruch wurde mit dem Nutzer ein **Opt-in-Zonenmodell** (FR-44/45) vereinbart statt einer vollständigen Umkehr der ursprünglichen Entscheidung: FR-5 bleibt Standardverhalten, Referate mit Bedarf aktivieren gezielt Zonen mit Kontingent. Das bewahrt die bereits bewusst getroffene, im PRD begründete Design-Entscheidung (uneingeschränkte Buchbarkeit als Ausgangspunkt), erfüllt aber die neue Anforderung vollständig für die Liegenschaften, die sie brauchen.

Alle übrigen 13 Punkte sind reine Ergänzungen ohne Rückwirkung auf bestehende FRs (Ausnahme: FR-9-Verfeinerung, FR-18-Scope-Klärung — beide additiv, keine Streichung bestehenden Verhaltens).

**Rollback (Option 2):** Nicht viabel/nicht nötig — nichts implementiert.
**MVP-Review (Option 3):** Nicht in vollem Umfang nötig dank Hybrid-Lösung für FR-5. Die neuen FRs sollten dennoch vor der nächsten Phase (`bmad-create-epics-and-stories`) explizit gegen §10 MVP Scope geprüft werden — dieses Proposal trifft dazu keine Entscheidung (siehe Abschnitt 5).

**Aufwand:** Medium (Dokumenten-Update, keine Code-Auswirkung). **Risiko:** Low für additive Punkte, Medium für FR-44/45 (neues Domänenkonzept "Zone", noch nicht architektonisch durchdacht).

## 4. Detailed Change Proposals

Alle 11 Änderungen wurden im Dialog mit dem Nutzer einzeln freigegeben (Incremental-Modus). Vollständiger Wortlaut je Änderung:

### 4.1 — FR-5 + Non-Goal + neue FR-44 (Referats-Kontingente als Opt-in)

**PRD §4.1, FR-5**
```
ALT:
#### FR-5: Uneingeschränkte Desk-Verfügbarkeit
Jeder Mitarbeiter kann jeden verfügbaren Desk an jeder Liegenschaft buchen.

Consequences (testable):
- Keine Kontingentierung nach Team, Referat oder Zugehörigkeit. Trade-off
  bewusst akzeptiert; Team-Nachbarschaft wird stattdessen über SM-C2
  beobachtet (§11).

NEU:
#### FR-5: Uneingeschränkte Desk-Verfügbarkeit als Standard
Jeder Mitarbeiter kann jeden verfügbaren Desk an jeder Liegenschaft buchen,
sofern die Liegenschaft/Zone nicht gemäß FR-44 mit einem Kontingent versehen ist.

Consequences (testable):
- Standardverhalten bleibt uneingeschränkt. Kontingentierung ist Opt-in
  pro Liegenschaft/Zone (FR-44), nicht systemweiter Default.

#### FR-44: Referatsbezogenes Raumkontingent / Zonen (Opt-in)
FM kann pro Liegenschaft eine oder mehrere Zonen einrichten, die einem oder
mehreren Referaten/Arbeitsgebieten zugeordnete Raumkontingente abbilden.
Ist eine Zone aktiv, können nur Mitarbeitende der zugeordneten Referate dort
Desks buchen; Büros außerhalb einer Zone bleiben für alle BAMF-Mitarbeitenden
uneingeschränkt buchbar (FR-5).

Consequences (testable):
- Ohne eingerichtete Zone verhält sich eine Liegenschaft wie bisher (FR-5).
- Ein Desk ist immer entweder Teil genau einer Zone oder uneingeschränkt
  buchbar, nie beides.
- FM kann Zonen jederzeit auflösen (Rückkehr zu FR-5-Standardverhalten).
```

**PRD §9 Non-Goals**
```
ALT:
- Keine Kontingentsteuerung nach Team/Referat.

NEU:
- Keine systemweite Kontingentsteuerung nach Team/Referat als Zwangsdefault
  — siehe FR-44 für das Opt-in-Zonenmodell.
```

**PRD §11, SM-C2**
```
ALT:
SM-C2: Beschwerden über fehlende Team-Nachbarschaft im Präferenz-Ranking —
Ranking-Erfolg (SM-1) darf nicht isoliert vom tatsächlichen Nutzerempfinden
optimiert werden. Balanciert SM-1 aus.

NEU:
SM-C2: Beschwerden über fehlende Team-Nachbarschaft im Präferenz-Ranking
außerhalb aktiver Zonen (FR-44) — dort greift weiterhin Ranking statt
Kontingent. Balanciert SM-1 aus.
```

**Begründung:** Löst den Widerspruch ohne FR-5 komplett zu kassieren — bestehendes Buchungsverhalten/-architektur bleibt Default, Referate mit Bedarf bekommen das gewünschte Kontingentmodell als bewusst aktivierte Ausnahme.

---

### 4.2 — FM-Verwaltung von Zonen/Kontingenten (neue FR-45)

**PRD §4.8 Facility-Management-Verwaltung**
```
NEU (nach FR-42 einzufügen):

#### FR-45: Zonen- und Kontingentverwaltung
FM kann Zonen (FR-44) anlegen, Referate/Arbeitsgebiete zuordnen, Desks
einer Liegenschaft einer Zone zu- oder abweisen sowie Zonen jederzeit
auflösen. FM kann zusätzlich Buchungsberechtigungen für einzelne
Räume/Zonen auf bestimmte Rollen oder Organisationseinheiten beschränken
(siehe FR-46, harte Zugriffsbeschränkung — unabhängig vom Zonenmodell).

Consequences (testable):
- Änderungen an Zonenzuordnung wirken nicht rückwirkend auf bereits
  bestätigte Buchungen (kein automatischer Storno wie bei FR-26/FR-27
  Sperrung — Zonenzuordnung ist Zugriffssteuerung, keine Sperrung).
- FM-Rolle ist hierfür ausreichend; keine zusätzliche Rolle nötig.
```

**Begründung:** Deckt *"Möglichkeit, Raumkontingente und Buchungsberechtigungen flexibel zu verwalten"* direkt ab. Bewusst getrennt von Sperrung (FR-26/27) — eine Zonenänderung ist keine Verfügbarkeits-Sperre, sondern eine Zugriffsregel.

---

### 4.3 — Harte rollenbasierte Buchungsbeschränkung (neue FR-46)

**PRD §4.2 Meetingraum-Buchung**
```
NEU:

#### FR-46: Raum auf berechtigte Rolle/Einheit beschränken
FM kann einen Raum (insb. Meetingraum) so kennzeichnen, dass ausschließlich
Mitarbeitende einer bestimmten Rolle oder Organisationseinheit (z.B.
Veranstaltungsmanagement) ihn buchen können. Anders als bei genehmigungs-
pflichtigen Räumen (FR-39/FR-41) können nicht-berechtigte Mitarbeitende den
Raum weder buchen noch eine Buchungsanfrage stellen — er ist für sie in der
Buchungsansicht nicht als buchbar erreichbar.

Consequences (testable):
- FR-46 und FR-41 (genehmigungspflichtig) schließen sich pro Raum nicht
  aus, sind aber unabhängige Mechanismen: FR-46 filtert, wer überhaupt
  anfragen darf; FR-41 legt fest, ob eine Anfrage genehmigt werden muss.
- Ein nicht-berechtigter Mitarbeiter sieht den Raum in Übersichten weiterhin
  (z.B. "wer sitzt wo"/Belegungsanzeige), kann ihn aber nicht auswählen.
- Realisiert den Fall "Südkaserne-Räume nur für Veranstaltungsmanagement".
```

**Begründung:** Deckt sowohl *"gilt auch für Besprechungs-/Veranstaltungsräume"* als auch *"Südkaserne … nur VM"* ab — beide beschreiben denselben fehlenden Mechanismus, bewusst von FR-39/41 abgegrenzt.

---

### 4.4 — Check-in-Pflicht + Auto-Freigabe bei No-Show (neue §4.12)

**PRD, neuer Abschnitt nach §4.11 Semantische Datenschicht**
```
NEU:

### 4.12 Check-in

**Beschreibung:** Optionale, von FM pro Liegenschaft aktivierbare Pflicht,
eine Buchung durch Check-in zu bestätigen; verhindert "Geisterbuchungen"
und gibt ungenutzte Plätze automatisch frei.

#### FR-47: Check-in-Pflicht (konfigurierbar)
FM kann pro Liegenschaft festlegen, ob Buchungen (Desk und/oder
Meetingraum) einen Check-in innerhalb eines Zeitfensters nach Buchungs-
beginn erfordern.

Consequences (testable):
- Standardmäßig ist keine Liegenschaft check-in-pflichtig (Opt-in wie
  FR-44).
- [Open Question] Check-in-Mechanismus (App-Tap, QR-Code am Desk, o.ä.)
  und Länge des Zeitfensters sind Implementierungsdetail, siehe §12.

#### FR-48: Automatische Freigabe bei Nichteinchecken
Checkt der Buchende nicht innerhalb des Zeitfensters (FR-47) ein, storniert
das System die Buchung automatisch und gibt den Desk/Raum frei.

Consequences (testable):
- Löst dieselbe Benachrichtigung aus wie andere Fremdeingriffe (FR-29).
- Bei Buchung im Auftrag (FR-11) trifft die Check-in-Pflicht den
  Mitarbeiter, für den gebucht wurde, nicht den Vertreter.
```

**PRD §12 Open Questions** — neuer Punkt 14: Check-in-Mechanismus und Zeitfenster-Länge für FR-47/48.

**Begründung:** Eigenständiger, optionaler Abschnitt, weil er sowohl Desk- als auch Meetingraum-Buchungen betrifft und ein FM-Konfigurationsschalter ist, kein Kernverhalten.

---

### 4.5 — Proaktive Erinnerungen (neue FR-49)

**PRD §4.9 Benachrichtigungen**
```
NEU (nach FR-29):

#### FR-49: Proaktive Erinnerung vor Buchungsbeginn/Check-in-Frist
System sendet eine Erinnerung an den Buchenden vor Beginn einer bevor-
stehenden Buchung sowie — falls Check-in-Pflicht (FR-47) aktiv ist — vor
Ablauf des Check-in-Zeitfensters.

Consequences (testable):
- Nutzt denselben konfigurierbaren Kanal-Mechanismus wie FR-29
  (Postkorb-Aufgabe, E-Mail, …), aber als eigenständiges Ereignis — nicht
  an einen Fremdeingriff gebunden.
- [Open Question] Vorlaufzeit der Erinnerung (z.B. X Stunden vor
  Buchungsbeginn) ist konfigurierbar oder fix — Implementierungsdetail,
  siehe §12.
- Betrifft nur reguläre Buchungen; vertrauliche Raumblockierungen (§4.6)
  sind wie beim Chat-Pfad (FR-33) bewusst ausgenommen — Konsistenz mit der
  dortigen Begründung (bewusste Reibung/Unauffälligkeit).
```

**PRD §12 Open Questions** — neuer Punkt 15: Vorlaufzeit der Erinnerung (FR-49).

**Begründung:** FR-29 deckt bisher nur reaktive Benachrichtigungen bei Fremdeingriff ab. "Erinnerungen" ist ein eigenständiger, proaktiver Trigger-Typ.

---

### 4.6 — Anonymisierte Büroauslastungs-Auswertung (neue FR-50)

**PRD §4.8 Facility-Management-Verwaltung**
```
NEU (nach FR-46):

#### FR-50: Anonymisierte Auslastungsauswertung
FM kann aggregierte Auslastungskennzahlen (z.B. Buchungsquote pro
Liegenschaft/Zone/Zeitraum) einsehen, ohne Rückschluss auf einzelne
Mitarbeitende.

Consequences (testable):
- Auswertung erfolgt ausschließlich aggregiert — keine Einzelbuchungs-
  Drilldown-Ansicht, auch nicht auf IDM-Kennungs-Ebene (strenger als FR-18,
  das Einzelbuchungen pseudonymisiert weiterhin anzeigt).
- [ASSUMPTION] Eine Mindestgruppengröße pro Auswertungssegment (z.B.
  keine Anzeige für Segmente < N Buchungen) wird angenommen, um
  Re-Identifikation bei kleinen Gruppen zu verhindern — konkreter
  Schwellenwert Implementierungsdetail.
```

**PRD §13 Assumptions Index** — neuer Eintrag: §4.8, FR-50 — Mindestgruppengröße pro Auswertungssegment.

**Begründung:** Reine FM-Analytics-Funktion, bisher komplett fehlend. Bewusst strenger als FR-18 formuliert.

---

### 4.7 — Datenübernahme: Raumstammdaten, Grundrisspläne, Bestandsbuchungen (neue FR-51/52)

**PRD §4.8 Facility-Management-Verwaltung**
```
NEU (nach FR-50):

#### FR-51: Übernahme bestehender Raumstammdaten und Grundrisspläne
System ermöglicht den Import bestehender Raumstammdaten (z.B. Raumnummer,
Beschreibung aus Tabellenformat) sowie die Zuordnung bestehender Grundriss-
pläne (PDF/JPG) zu Liegenschaften/Gebäuden, aus denen Räume und Desks für
die Buchung ausgewählt werden können.

Consequences (testable):
- Import ist ein FM-Werkzeug (einmalig pro Liegenschaft bei Onboarding),
  kein laufender Sync — Abgrenzung zu FR-22 (laufende manuelle Pflege).
- Grundrisspläne, die nicht als navigierbare Kartierung vorliegen, blockieren
  die Buchbarkeit der Liegenschaft nicht — Fallback ist eine Listenansicht
  ohne Grundriss (siehe Empty-States im UX-Design, bereits vorgesehen).

#### FR-52: Übernahme bestehender Buchungen aus dem Vorgängersystem
System ermöglicht die automatisierte Übertragung bestehender/offener
Buchungen aus dem aktuellen Raumbelegungstool in das neue System.

Consequences (testable):
- Betrifft nur Meetingraum-/Veranstaltungsbuchungen, die zum Migrations-
  zeitpunkt noch in der Zukunft liegen — keine Übernahme historischer,
  bereits abgeschlossener Buchungen.
- [Open Question] Datenformat/Schnittstelle des aktuellen Raumbelegungs-
  tools ist noch nicht bekannt, siehe §12 und addendum.md.
```

**PRD §12 Open Questions** — neuer Punkt 16: Format/Schnittstelle des aktuellen Raumbelegungstools + Konvertierungsansatz für Grundrisspläne.

**Addendum.md** (neue Notiz unter "Integrationslandschaft")
```
NEU:
- Bestehendes Raumbelegungstool — Quelle für Bestandsbuchungen (FR-52).
  Konkretes System/Format vom Nutzer noch nicht benannt, zu klären.
- Referat 12E — hält aktuelle Raumstammdaten als Excel (Raumnummer,
  Beschreibung) sowie Grundrisspläne als PDF/JPG (FR-51). Einmaliger
  Import, kein laufender Sync.
```

**Begründung:** Zwei getrennte FRs, weil unterschiedliche Datenklassen (Stammdaten vs. Bewegungsdaten, vgl. §6.2) und unterschiedliche Quellsysteme betroffen sind.

---

### 4.8 — Bestuhlungsauswahl + automatische Umbautag-Reservierung (neue FR-53/54/55)

**PRD §4.2 Meetingraum-Buchung**
```
NEU (nach FR-46):

#### FR-53: Bestuhlungsauswahl bei der Buchung
Mitarbeiter kann bei der Buchung eines Veranstaltungs-/Besprechungsraums
neben der Standard-Bestuhlung eine der vom FM für diesen Raum hinterlegten
alternativen Bestuhlungsformen auswählen (FR-55).

#### FR-54: Automatische Zusatzreservierung für Umbautage
Weicht die gewählte Bestuhlung (FR-53) von der Standard-Bestuhlung ab,
reserviert das System automatisch die für den Umbau benötigten Tage
zusätzlich, gemäß der pro Bestuhlungsoption hinterlegten Umbaudauer (FR-55).

Consequences (testable):
- Automatisch reservierte Umbautage unterliegen derselben Konfliktprüfung
  wie reguläre Buchungen (FR-8) — sie blockieren den Raum für andere
  Buchungen.
- Kollidiert ein Umbautag mit einer bestehenden Buchung, wird die
  Bestuhlungsauswahl abgelehnt, nicht die bestehende Buchung verdrängt
  (konsistent mit FR-5a/FR-8-Prinzip).
```

**PRD §4.8 Facility-Management-Verwaltung**
```
NEU (nach FR-52):

#### FR-55: Verwaltung von Bestuhlungsoptionen pro Raum
FM kann für einen Veranstaltungs-/Besprechungsraum verfügbare Bestuhlungs-
optionen (inkl. Standard-Bestuhlung) hinterlegen, jeweils mit der Anzahl
benötigter Umbautage (FR-54).

Consequences (testable):
- Bestuhlungsoptionen sind strukturelle Raum-Eigenschaften wie FR-41
  (genehmigungspflichtig), nicht Teil des flexiblen Label-Systems (FR-23)
  — sie steuern automatisches Buchungsverhalten (FR-54), keine reine
  Anzeige-Eigenschaft.
```

**Begründung:** Drei separate FRs für drei unterschiedliche Verantwortlichkeiten: Nutzerauswahl, automatische Systemreaktion mit Konfliktprüfungs-Interaktion, FM-seitige Konfiguration.

---

### 4.9 — Expliziter Buchungshorizont (neue NFR in §5)

**PRD §5 Cross-Cutting NFRs**
```
NEU (Ergänzung):

- Buchungshorizont: Meetingraum-Buchungen (inkl. Serientermine, FR-9)
  müssen mindestens bis zum Ende des jeweiligen Folgejahres im Voraus
  möglich sein (Stand 2026: bis Jahresende 2027) — rollierend, nicht als
  fixes Enddatum. [Open Question] Ob und welcher Horizont für Desk-
  Buchungen gilt, ist offen — siehe §12.
```

**PRD §12 Open Questions** — neuer Punkt 17: Buchungshorizont für Desk-Buchungen.

**Begründung:** Bisher definiert das PRD nirgends eine Obergrenze, wie weit im Voraus überhaupt gebucht werden kann.

---

### 4.10 — Meetingraum-Sichtbarkeit + VM-Bemerkungsfeld (Klärung zu FR-18, neue FR-56/57)

**PRD §4.7 Sichtbarkeit & Präsenzanzeige**
```
ALT:
#### FR-18: Pseudonymisierte Standardansicht
System zeigt "wer sitzt wo"-Übersichten standardmäßig nur mit IDM-Kennung,
nicht mit Klarnamen.

NEU:
#### FR-18: Pseudonymisierte Standardansicht (Desk-Buchungen)
System zeigt "wer sitzt wo"-Übersichten für Desk-Buchungen standardmäßig
nur mit IDM-Kennung, nicht mit Klarnamen. Gilt nicht für Meetingraum-/
Veranstaltungsbuchungen — siehe FR-56.

Consequences (testable):
- [NOTE FOR PM] Diese Scope-Einschränkung auf Desk-Buchungen ist eine
  bewusste Auslegung des neuen Anforderungspunkts "alle sehen, für wen der
  Raum gebucht ist" — zu bestätigen, da sie von der bisherigen
  DSGVO-Einordnung (§6.1) abweicht, die "wer sitzt wo" generisch behandelte.
```

**PRD §4.2 Meetingraum-Buchung**
```
NEU (nach FR-55):

#### FR-56: Sichtbarkeit der Buchungszuordnung bei Meetingräumen
Alle Mitarbeitenden sehen bei einem gebuchten Meetingraum, für wen bzw.
welche Einheit die Buchung erfolgt ist (Klarname oder Organisationseinheit)
— abweichend von der Desk-Pseudonymisierung (FR-18).

#### FR-57: Rollen-differenziertes Bemerkungsfeld
Für Mitarbeitende mit VM-Rolle wird an einer Meetingraum-Buchung
zusätzlich automatisch ein Bemerkungsfeld (aktuell eine Zeile Freitext)
angezeigt, das Details zur Buchung enthält (z.B. Umbautag gemäß FR-54,
oder für welche Veranstaltung der Raum benötigt wird). Andere
Mitarbeitende sehen dieses Feld nicht.
```

**PRD §12 Open Questions** — neuer Punkt 18: Klarname oder nur Organisationseinheit bei FR-56, DSGVO-Abstimmung nötig.

**Begründung:** Statt FR-18 stillschweigend zu brechen, wird die Pseudonymisierung explizit auf Desk-Buchungen begrenzt und für Meetingräume ein eigener, bewusst abweichender Sichtbarkeits-FR eingeführt.

---

### 4.11 — FR-9-Verfeinerung + gebündelte offene Punkte (Rollenmodell, PVSplus, Alarmserver)

**PRD §4.3 Serienbuchung**
```
ALT:
#### FR-9: Serienbuchung anlegen
Mitarbeiter oder Vertreter kann eine wiederkehrende Buchung nach
Wochentagsmuster bis zu einem Enddatum anlegen (z.B. "jeden Mo+Di bis
31.12.2026"). Realisiert UJ-2.

NEU:
#### FR-9: Serienbuchung anlegen
Mitarbeiter oder Vertreter kann eine wiederkehrende Buchung nach
Wochentagsmuster mit konfigurierbarem Intervall (wöchentlich, zwei-
wöchentlich, monatlich) bis zu einem frei wählbaren Enddatum anlegen
(z.B. "jeden Mo+Di bis 31.12.2026"), begrenzt durch den Buchungshorizont
(§5). Realisiert UJ-2.

Consequences (testable):
- Intervall-Optionen (wöchentlich/zweiwöchentlich/monatlich) gelten für
  Desk- und Meetingraum-Serien gleichermaßen.
- [Open Question] Die Liegenschaftsreferate-Anforderung beschreibt
  zusätzlich ein rollierendes Kurzhorizont-Muster ("x Wochen im Voraus für
  die darauffolgende Woche") — unklar, ob das eine FR-9-Variante oder ein
  eigener Mechanismus ist. Nicht in diesem Proposal aufgelöst, siehe §12.
```

**PRD §12 Open Questions** — neue Punkte 19–23:
```
19. Serienbuchung: Ist das rollierende Kurzhorizont-Muster der
    Liegenschaftsreferate (FR-9-Ergänzung oben) eine Variante von FR-9
    oder ein eigenständiger Mechanismus? Mit Fachbereich klären.
20. Rollenmodell: Mapping der genannten Rollen "VL"/"GZ" (Mehrfachbuchung,
    vermutlich Geschäftszimmer ~ Team-Assistenz) sowie "zentral/12E/12F/RL"
    (Sperr-/Löschberechtigung) auf das bestehende Vertretungs-/FM-
    Rollenmodell (FR-12, FR-26, FR-43) — inkl. ob eine liegenschafts-
    skalierte Admin-Ebene (Rechte nur für bestimmte Liegenschaften) nötig
    ist (§6.1, Vergabe von Rechten/Rollen).
21. Rollenmodell: Mengen-/Rate-Limit für Mehrfachbuchungen durch VL/GZ
    ("mehrere APL an einem Tag/Woche/Monat") — gibt es eine Obergrenze
    pro Rolle?
22. Integration: Ist "PVSplus" identisch mit dem in addendum.md
    genannten "HR-System (DataGrid Services)", oder ein zusätzliches
    System? Falls zusätzlich: Verhältnis zu Org-Sync (FR-12) klären.
23. Synergie Alarmserver: Prüfung angefragt, ob Anwesenheitsdaten für
    Notfall-/Evakuierungszwecke genutzt werden können — steht in
    Spannung zu FR-18–20 (Pseudonymisierung als Standard), da Notfall-
    zugriff vermutlich Klarnamen/Ist-Anwesenheit braucht. Mit
    Datenschutzbeauftragtem klären, analog Punkt 8/9/18.
```

**Begründung:** Diese fünf Punkte sind entweder zu unterspezifiziert für einen belastbaren FR-Vorschlag oder betreffen eine Rollenmodell-Frage, die ohnehin schon als offener NFR-Sicherheitspunkt im PRD steht. Statt zu raten, werden sie als benannte, nachverfolgbare Open Questions geführt.

## 5. Implementation Handoff

**Scope-Klassifikation: Moderate–Major** (Dokumenten-Ebene moderat — reine PRD-/Addendum-Edits, kein Code betroffen; inhaltlich major, da neue Domänenkonzepte wie "Zone" und "Check-in" eingeführt werden, die die kommende Architektur-Phase prägen).

**Empfohlene Route:**

1. **PM (John, `bmad-prd` Update-Modus):** Dieses Proposal als Change-Signal einspielen, die 11 Änderungen wortgetreu in `prd.md`/`addendum.md` übernehmen, und die markierten `[NOTE FOR PM]`/`[Open Question]`-Punkte — insbesondere FR-18-Scope (4.10) und Alarmserver-Synergie (4.11, Punkt 23) — mit den Stakeholdern (Liegenschaftsreferate, VM, ggf. Datenschutzbeauftragter) klären, bevor der PRD-Status wieder auf `final` gesetzt wird.
2. **UX (Sally, `bmad-ux`):** Nach PRD-Update — Zonen-Knoten in Facility-Management-Baumstruktur, Check-in-Flow, Erinnerungs-Benachrichtigung, Auslastungs-Dashboard, Bestuhlungsauswahl, VM-Bemerkungsfeld als neue/erweiterte Screens ergänzen.
3. **Architect (Winston, `bmad-architecture`):** Sobald PRD final ist — insbesondere Zone/Referat-Datenmodell (FR-44/45), Zugriffsbeschränkungs-Mechanismus (FR-46) und Check-in-Zustandsmaschine (FR-47/48) architektonisch einordnen, inkl. Auswirkung auf die semantische Datenschicht (§4.11).

**Erfolgskriterien:** PRD-Status wieder `final`, alle 10 neuen Open Questions (14–23) mit Verantwortlichen und Zieldatum versehen, keine der drei `[NOTE FOR PM]`-Markierungen mehr offen, bevor `bmad-create-epics-and-stories` gestartet wird.
