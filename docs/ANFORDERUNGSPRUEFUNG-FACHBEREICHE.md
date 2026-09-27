# Soll-Ist-Abgleich & Management-Zusammenfassung: Fachliche Anforderungen

**Projekt:** Desk4Me (Proof of Concept)  
**Bezug:** E-Mail-Abstimmung vom 20./23. August 2026 (Referate 12D/E/F, 13D, AL1, AL2, VM)  
**Stand der Prüfung:** 11. September 2026  
**Zieltermin:** Präsentation des Prototyps in KW 38 (14. September 2026)  

---

## 1. Management Summary

Im Vorfeld des Abstimmungstermins am 14.09.2026 wurden die fachlichen Anforderungen der Liegenschaftsreferate (12D, 12E, 12F, 13D) sowie des Veranstaltungsmanagements (VM) gegen den implementierten Stand des Prototyps geprüft.

Die Anforderungen wurden bereits im [`sprint-change-proposal-2026-08-20.md`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-20.md) methodisch analysiert und als funktionale Anforderungen (**FR-44 bis FR-57**) in die PRD ([`prd.md`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/_bmad-output/planning-artifacts/prds/prd-DeskSharing-2026-08-13/prd.md)) übernommen.

### Gesamtstatus auf einen Blick

| Fachbereich | Anforderungen gesamt | Vollständig umgesetzt | Teilweise / mit PoC-Grenzen | Offen / Klärungsbedarf |
|---|:---:|:---:|:---:|:---:|
| **Liegenschaftsreferate** | 14 | 7 | 4 | 3 |
| **Veranstaltungsmanagement (VM)** | 6 | 3 | 3 | 0 |
| **Gesamt** | **20** | **10 (50 %)** | **7 (35 %)** | **3 (15 %)** |

> **Kernaussage für den 14.09.2026:**  
> Alle **funktionalen Kernabläufe** (Zonen/Kontingente, Vertretungs- & Mehrfachbuchungen, Doppelbuchungs-Vermeidung, Bestuhlungsarten inkl. automatischer Rüst-/Umbautage, harte Rollenbeschränkungen für VM-Räume sowie Check-in & No-Show-Freigabe) sind im Prototyp vollständig lauffähig und durch 36 automatisierte Backend-Tests ([`tests/unit`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/tests/unit)) abgesichert.  
> Die verbleibenden Punkte betreffen vor allem **externe Schnittstellen** (PVSplus, Altsystem-Datenbank), **datenschutzrechtliche Grundsatzfragen** (Alarmserver) sowie **Feinabstimmungen der Governance** (differenzierte Buchungshorizonte).

---

## 2. Detaillierte Prüfung: Liegenschaftsreferate (12D, 12E, 12F, 13D)

### 1. Buchung aus referatsbezogenem Kontingent / Zonen + freie Büros
* **Anforderung:** Mitarbeitende buchen ihren Schreibtisch / Raum direkt aus einem referatsbezogenen Raumkontingent oder Zonen, die nach Arbeitsgebieten eingerichtet werden; daneben gibt es Büros, die unabhängig von der Referatszuordnung von allen MA Ihrer Organisation gebucht werden können.
* **Status:** **Vollständig umgesetzt** (FR-44, FR-45)
* **Technische Umsetzung:**
  * **Datenmodell:** Tabellen [`Zone`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/models/structure.py#L159), [`ZoneDepartment`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/models/structure.py#L169), [`ZoneDesk`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/models/structure.py#L177) und [`RoomDepartment`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/models/structure.py#L104).
  * **Backend-Prüfung:** In [`create_desk_booking`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/routers/bookings.py#L365-L375) wird geprüft, ob ein Desk oder Raum einer Zone zugeordnet ist und ob der Buchende zur berechtigten Organisationseinheit gehört (inkl. konfigurierbarer Kaskade auf Unterreferate). Nichtberechtigte erhalten HTTP 403 `ZONE_RESTRICTED`.
  * **Frontend:** Zonenverwaltung im Tab *„Zonen & Kontingente“* ([`FacilityManagement.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/FacilityManagement.tsx#L184)). Im Grundriss ([`TargetedBooking.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/TargetedBooking.tsx#L820)) werden gesperrte Plätze visuell als *„Zonen-Kontingent“* markiert. Büros ohne Zonenzuordnung bleiben nach Standard (FR-5) für alle Mitarbeitenden frei buchbar.

---

### 2. Mehrfachbuchungen durch Berechtigte (VL, GZ)
* **Anforderung:** Einzelne Personen sind berechtigt, mehrere APL an einem Tag/Woche/Monat zu buchen (z. B. für Kolleginnen und Kollegen), bei entsprechendem Recht/Rolle (VL, GZ).
* **Status:** **Vollständig umgesetzt** (FR-11, FR-12)
* **Technische Umsetzung:**
  * **Rolle & Delegation:** Das System beinhaltet die Rolle `team_assistenz` (*„Team-Assistenz/Manager (Geschäftszimmer)“*, siehe [`seed_data.py`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/seed_data.py#L35)) sowie ein flexibles Delegationsmodell ([`Delegation`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/models/reference.py#L99)).
  * **Benutzeroberfläche:** Über die Maske **„Im Namen von agieren“** ([`BookFor.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/BookFor.tsx)) kann eine Vertretungsperson ausgewählt werden. Danach können beliebig viele Plätze über Tage, Wochen und Monate für Kolleginnen und Kollegen gebucht werden.
  * **Auditierung:** Jede Buchung im Auftrag wird revisionssicher im [`BookingAudit`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/models/bookings.py#L110) erfasst (`booked_by_user_id` vs. `booked_for_user_id`).

---

### 3. Mehrfachbuchungen für Besprechungs- und Veranstaltungsräume
* **Anforderung:** Gilt auch für Besprechungs- / Veranstaltungsräume.
* **Status:** **Vollständig umgesetzt**
* **Technische Umsetzung:**
  * Das Delegations- und Vertretungsprinzip greift einheitlich für Meetingräume ([`create_room_booking`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/routers/bookings.py#L454) und [`MeetingRooms.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/MeetingRooms.tsx)).

---

### 4. Anzeige aktueller Verfügbarkeit & Vermeidung von Doppelbuchungen
* **Status:** **Vollständig umgesetzt** (FR-5a, FR-8)
* **Technische Umsetzung:**
  * **Verfügbarkeitsanzeige:** Interaktive 2-Stufen-Grundrisse ([`FloorplanCanvas.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/components/FloorplanCanvas.tsx)), Kachel- und Matrix-Ansichten für Konferenzräume mit Live-Status (*frei*, *belegt*, *gesperrt*, *Zonen-Kontingent*).
  * **Kollisionsvermeidung (Ressource):** Parallele Buchung desselben Platzes/Raums durch zwei Personen wird mit HTTP 409 abgelehnt; bei Desks wird direkt ein gleichwertiger Alternativ-Arbeitsplatz vorgeschlagen ([`_suggest_alternative_desk`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/routers/bookings.py#L403)).
  * **Doppelbuchungsschutz (Person):** Bucht eine Person parallel zwei Arbeitsplätze oder zwei Räume, öffnet sich das [`DoubleBookingModal.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/components/DoubleBookingModal.tsx): Sie kann entweder die Erstbuchung mit einem Klick stornieren oder nur mit einer Pflichtbegründung (`double_booking_reason`) fortfahren.

---

### 5. Serienbuchungen (Turnus, Zeitfenster, Vorlauf)
* **Anforderung:** Serienbuchungen für regelmäßige Bürotage (z. B. jeden Di und Do) x Wochen im Voraus für die darauffolgende Woche reservieren; Intervalle (tägliche Zeitfenster, z. B. Vormittag / Nachmittag) möglich.
* **Status:** **Teilweise umgesetzt** (FR-9, FR-10)
* **Ist-Stand:**
  * Wochentagsmuster (Mo–So frei kombinierbar), Intervalle (*wöchentlich*, *zweiwöchentlich*, *monatlich*) und frei wählbares Start-/Enddatum sind implementiert ([`SeriesBooking.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/SeriesBooking.tsx)).
  * Terminvorschau mit Abwahlmöglichkeit einzelner Tage und Ersatzplatz-Vorschlägen bei Teilkonflikten.
* **Abweichungen / Offene Punkte:**
  1. *Halbtages-Zeitfenster:* Das Backend unterstützt `day_part` (*am*, *pm*, *full*), in der Maske von `SeriesBooking.tsx` fehlt jedoch noch das entsprechende Auswahl-Dropdown (steht fest auf Ganztag).
  2. *Rollierendes Kurzhorizont-Muster („x Wochen im Voraus für Folgewoche“):* Als Klärungsfrage (Open Question 19) im PRD markiert, bisher nicht als eigenes Buchungsfenster abgebildet.
  3. *PoC-Deckelung:* Aus Performanzgründen im Prototyp auf max. 60 Einzeltermine pro Serie beschränkt ([`MAX_SERIES_OCCURRENCES = 60`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/services/scheduling.py#L8)).

---

### 6. Flexible Verwaltung von Raumkontingenten und Buchungsrechten
* **Status:** **Vollständig umgesetzt** (FR-45, FR-46)
* **Technische Umsetzung:**
  * Zonen können im FM angelegt, mit Organisationseinheiten verknüpft (optional inklusive aller Unterabteilungen), mit Desks belegt und aufgelöst werden ([`FacilityManagement.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/FacilityManagement.tsx)).
  * Räume können strukturell auf Rollen (z. B. VM) oder Org-Einheiten ([`RoomDepartment`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/models/structure.py#L104)) beschränkt werden.

---

### 7. Automatische Bestätigungen, Erinnerungen & Freigabe bei Nichtnutzung
* **Status:** **Umgesetzt (PoC-Umfang)** (FR-48, FR-49)
* **Technische Umsetzung:**
  * Bestätigung erfolgt sofort bzw. nach Raum-Genehmigung über das Benachrichtigungssystem.
  * Hintergrund-Sweep ([`_sweep_loop`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/main.py#L67) in `main.py`) läuft alle 15 Sekunden:
    * **Erinnerung:** Versendet 30 Minuten vor Buchungsbeginn eine Mitteilung an den Buchenden.
    * **No-Show-Freigabe:** Verstreicht die Check-in-Frist ohne Check-in, wird die Buchung automatisch storniert (`cancel_kind="checkin_missed"`), der Platz freigegeben und der Nutzer benachrichtigt.
  * *Hinweis PoC-Scope:* Benachrichtigungen erfolgen über den In-App-Postkorb, keine Exchange/SMTP-Mails.

---

### 8. Sperrung/Freigabe von Arbeitsplätzen/Räumen & Zwangsstornierung
* **Anforderung:** Arbeitsplätze oder ganze Räume können (zentral/12E/12F/VL/RL) gesperrt/freigegeben oder Reservierungen gelöscht werden.
* **Status:** **Umgesetzt (Rollen-Mapping noch verallgemeinert)** (FR-26, FR-27, FR-43)
* **Technische Umsetzung:**
  * Sperrung von Desks, Räumen oder Liegenschaften via [`/api/fm/locks`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/routers/fm.py#L636) storniert kollidierende Buchungen automatisch und benachrichtigt Betroffene.
  * FM-Zwangsstornierung ([`force_cancel`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/routers/fm.py#L680)) mit Pflichtbegründung vorhanden.
  * *Offener Punkt:* Berechtigung liegt derzeit einheitlich bei der Rolle `fm` (in Demo-Daten den 12E/12F-Accounts zugewiesen). Eine Aufteilung nach `12E`, `12F`, `VL`, `RL` ist als Open Question 20 dokumentiert und noch nicht feingranular aufgesplittet.

---

### 9. Anonymisierte Auswertung der tatsächlichen Büroauslastung
* **Status:** **Vollständig umgesetzt** (FR-50)
* **Technische Umsetzung:**
  * Endpunkt [`/api/fm/occupancy`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/routers/fm.py#L1013) und Dashboard im Reiter *„Auslastung“* in [`FacilityManagement.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/FacilityManagement.tsx#L1710).
  * **DSGVO-Schutz:** Bei weniger als 3 Buchungen (`MIN_GROUP_SIZE = 3`) wird der Wert unterdrückt (*„Zu wenige Buchungen für Auswertung“*), um eine Re-Identifikation kleiner Gruppen auszuschließen.
  * *Hinweis:* Basiert auf Buchungs- und Check-in-Zahlen im System (keine IoT-/Drehkreuz-Präsenzsensorik).

---

### 10. Übernahme vorhandener Raumdaten (Excel) & Grundrisspläne (PDF/JPG)
* **Status:** **Teilweise umgesetzt / API-Ebene** (FR-51)
* **Ist-Stand:**
  * Backend-Endpunkte für CSV-Raumstammdaten-Import ([`import_room_master_data`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/routers/fm.py#L1248)) und Grundriss-Bildupload ([`upload_floorplan`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/routers/fm.py#L1044)) vorhanden.
* **Abweichungen / Offene Punkte:**
  * Kein nativer `.xlsx`-Parser (muss als `.csv` gespeichert werden).
  * Keine automatische Vektorisierung von PDF-Grundrissen (Grundrisspläne dienen als Bild-Hintergrund, Desks/Räume werden im FM-Canvas-Designer interaktiv platziert).
  * Im Frontend gibt es dafür keinen eigenen Upload-Screen (bewusste PoC-Vereinfachung laut README).

---

### 11. Rollen- & Rechtesystem, DSGVO-Konformität, Liegenschafts-Berechtigungen
* **Status:** **Weitgehend umgesetzt** (FR-18, FR-20, FR-21, FR-50)
* **Ist-Stand:**
  * **DSGVO:** „Wer sitzt wo“ ([`WhoSitsWhere.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/WhoSitsWhere.tsx)) zeigt standardmäßig nur pseudonymisierte IDM-Kennungen. Klarnamen nur bei freiwilligem Opt-in oder manuellem Klick auf „Name auflösen“ (inkl. Protokollierung).
  * **Rollen:** `mitarbeiter`, `team_assistenz`, `fm`, `raumverantwortlicher`, `vsnfd`, `vm` sind eingerichtet; Nutzer- und Rollenpflege existiert unter [`MasterData.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/MasterData.tsx).
* **Offene Punkte:**
  * *Liegenschaftsspezifische Buchungsberechtigungen:* Standardmäßig gilt FR-5 (jeder MA darf an jedem Standort freie Büros buchen). Eine harte Beschränkung, dass Mitarbeiter A nur Liegenschaft X buchen darf, ist im PoC nicht aktiviert.
  * Login ist simuliert (kein echtes Keycloak/IDM).

---

### 12. Check-in-Pflicht & automatische Freigabe bei No-Show
* **Status:** **Vollständig umgesetzt** (FR-47, FR-48)
* **Technische Umsetzung:**
  * Konfigurierbar auf Liegenschafts-, Raum- oder Desk-Ebene ([`checkin_required`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/models/structure.py#L24), [`checkin_window_minutes`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/models/structure.py#L25)).
  * Mitarbeitende können in [`MyBookings.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/MyBookings.tsx) einchecken. Erfolgt kein Check-in vor Ablauf des Zeitfensters, storniert der Hintergrund-Sweep die Buchung automatisch, gibt den Platz frei, schreibt ein Audit-Log und benachrichtigt die Person (automatisiert getestet in [`test_double_booking_and_checkin.py`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/tests/unit/test_double_booking_and_checkin.py#L73)).

---

### 13. Schnittstelle zu PVSplus / Alternativ: Profil anlegen
* **Status:** **Alternative umgesetzt, Schnittstelle offen**
* **Ist-Stand:**
  * Es existiert keine Schnittstelle zu PVSplus (als Klärungsfrage 22 im PRD hinterlegt).
  * Die in der E-Mail genannte Alternative (*„Mitarbeitende legen eigens Profil an“*) ist umgesetzt: Unter **„Meine Präferenzen“** ([`Preferences.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/Preferences.tsx)) können Standardstandort, Ausstattungswünsche, Klarname-Freigabe und Vertretungen gepflegt werden; Admins verwalten Personen und Org-Einheiten in den Stammdaten.

---

### 14. Prüfung von Synergieeffekten mit dem Alarmserver
* **Status:** **Nicht umgesetzt / Offene Grundsatzfrage**
* **Hintergrund:**
  * Im PRD als Klärungsfrage 23 festgehalten: Die Nutzung von Anwesenheitsdaten für Notfall- und Evakuierungszwecke erfordert zwingend Klarnamen und Anwesenheits-Echtzeitdaten. Dies steht in direktem Spannungsverhältnis zur geforderten datenschutzrechtlichen Pseudonymisierung (FR-18).
  * Muss vor einer technischen Konzeption mit dem behördlichen Datenschutzbeauftragten abgestimmt werden.

---

## 3. Detaillierte Prüfung: Veranstaltungsmanagement (VM)

### 15. Bestehende Buchungen aus dem Vorgänger-Tool automatisiert übertragen
* **Status:** **Teilweise umgesetzt / API-Ebene** (FR-52)
* **Ist-Stand:**
  * Endpunkt [`/api/fm/import/legacy-bookings`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/routers/fm.py#L1270) importiert zukünftige Meetingraum-Buchungen via CSV (`room_id, user_idm_code, start_at, end_at`).
* **Offene Punkte:**
  * Das konkrete Quellsystem, dessen Datenbankschema und Exportformate sind noch nicht benannt (Klärungsfrage 16).
  * Kein eigener Frontend-Screen (Upload erfolgt per API).

---

### 16. Bestuhlungsoptionen & automatische Reservierung von Umbautagen
* **Status:** **Vollständig umgesetzt** (FR-53, FR-54, FR-55)
* **Technische Umsetzung:**
  * Bestuhlungsformen (*Boardroom, U-Form, Block, Theater, Schulung, Stuhlkreis*) inkl. Rüstzeit ([`changeover_days`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/models/structure.py#L134)) sind pro Raum hinterlegbar.
  * In [`MeetingRooms.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/MeetingRooms.tsx#L74) wählbar mit Live-Vorschau der Stuhlanordnung auf dem Canvas.
  * Weicht die Wahl von der Standardbestuhlung ab und sind Umbautage definiert, erzeugt das Backend ([`create_room_booking`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/routers/bookings.py#L497-L508)) automatisch vorangehende Reservierungen mit `is_changeover_slot=True` und der Bemerkung *„Umbautag“*.
  * Ist der Umbautag bereits belegt, wird die Buchung mit `CHANGEOVER_CONFLICT` abgewiesen (keine Verdrängung).

---

### 17. Südkaserne: Buchungsberechtigung auf Veranstaltungsmanagement beschränkbar
* **Status:** **Vollständig umgesetzt** (FR-46)
* **Technische Umsetzung:**
  * Räume besitzen das Feld [`restricted_role_code`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/models/structure.py#L81). In den Demodaten der Nürnberg-Zentrale (ehem. Südkaserne) ist dies für den Boardroom Wien (B.03) bereits mit `"vm"` konfiguriert ([`seed_data.py`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/seed_data.py#L487)).
  * Mitarbeitende ohne VM-Rolle erhalten HTTP 403 `NOT_AUTHORIZED_ROOM`; im Zeitstrahl wird der Raum mit *„Nicht berechtigt“* gesperrt.

---

### 18. Serientermine (wöchentlich, zweiwöchentlich, monatlich bis zu 1 Jahr mit flexiblem Enddatum)
* **Status:** **Umgesetzt (mit PoC-Begrenzung)** (FR-9)
* **Technische Umsetzung:**
  * Alle drei Intervalle und flexible Datumsangaben werden in [`SeriesBooking.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/SeriesBooking.tsx) unterstützt.
  * *Hinweis:* Sicherheitsdeckelung auf max. 60 Einzeltermine pro Serie im Prototyp ([`MAX_SERIES_OCCURRENCES = 60`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/services/scheduling.py#L8)).

---

### 19. Buchungshorizont für das VM bis Ende des Folgejahres (bis Ende 2027)
* **Status:** **Technisch möglich / Rollenspezifische Obergrenze noch nicht differenziert**
* **Technische Umsetzung:**
  * Es gibt im Backend keine Jahres-Obergrenze; Termine im Jahr 2027 können im Backend und in den Frontend-Datumspickern gebucht werden.
  * *Offener Punkt:* Eine Differenzierung, wonach reguläre Mitarbeitende z. B. nur 4 Wochen im Voraus buchen dürfen und *ausschließlich* das VM bis Ende 2027 buchen kann, ist derzeit noch nicht als Regelwerk hinterlegt.

---

### 20. Sichtbarkeit: Alle sehen Buchungsname; VM sieht zusätzliches Bemerkungsfeld
* **Status:** **Weitgehend umgesetzt / Anzeige-Detail offen** (FR-56, FR-57)
* **Technische Umsetzung:**
  * **Transparenz (FR-56):** In der Konferenzraum-Timeline sehen alle Mitarbeitenden Klarname und Referat der buchenden Person ([`catalog.py`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/backend/app/routers/catalog.py#L208-L211) und [`MeetingRooms.tsx`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/MeetingRooms.tsx#L864-L874)).
  * **Bemerkungsfeld (FR-57):** Im Buchungsdialog wird das Feld *„Bemerkung (nur für VM sichtbar)“* ausschließlich Nutzern mit der Rolle `vm` angezeigt ([`MeetingRooms.tsx:1258`](file:///Users/A3694852/temp/MunsiAI/DeskShareClaudePoC/frontend/src/pages/MeetingRooms.tsx#L1258)). Bei automatisch generierten Umbautagen wird hier automatisch *„Umbautag“* eingetragen.
  * *Anzeigedetail:* In der visuellen Zeitstrahl-Matrix wird die Bemerkung bei regulär belegten Slots aktuell nicht als Tooltip für VM-Rollen eingeblendet (nur bei Sperrungen oder in der Buchungsliste unter *„Meine Buchungen“*).

---

## 4. Empfohlene Agenda & Diskussionspunkte für den Termin am 14.09.2026

Zur Vorbereitung auf den Termin mit den Referaten 12D/E/F und 13D am 14.09.2026 sollten folgende Kernbotschaften und Diskussionsfragen fokussiert werden:

1. **Live-Demonstration der Kernanforderungen (Stärken des Prototyps):**
   * *Flow A:* Buchung aus Zonen-Kontingenten vs. frei buchbaren Desks.
   * *Flow B:* Buchen im Auftrag für Kolleginnen und Kollegen (Geschäftszimmer-Workflow) inkl. Doppelbuchungs-Warnung.
   * *Flow C:* Meetingraum-Buchung mit Bestuhlungswechsel, automatischer Blockierung von Umbautagen und VM-Zugriffsschutz (Südkaserne).
   * *Flow D:* Check-in-Pflicht und automatische Stornierung/Freigabe bei No-Show.
2. **Zu klärende Fachfragen (Entscheidungsbedarfe):**
   * *Buchungshorizonte:* Sollen normale Mitarbeitende auf einen festen Zeitraum (z. B. 4 Wochen) beschränkt werden, während das VM bis Jahresende 2027 buchen darf?
   * *Datenübernahme:* Welches Format und welches Altsystem wird für die bestehenden Raumbelegungen genutzt (Export-Möglichkeit als CSV)?
   * *Schnittstelle PVSplus:* Soll für Release 1 das Self-Service-Profilierungsmodell beibehalten werden, oder ist ein automatisierter Stammdatenabgleich zwingend erforderlich?
   * *Alarmserver:* Datenschutzrechtliche Grundsatzentscheidung zur Notfall-Präsenzerfassung versus DSGVO-Pseudonymisierung.
