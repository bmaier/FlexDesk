# Zusammenfassung der Anforderungsabdeckung

## Management-Zusammenfassung

Die BAMF-Anforderungen wurden am 20.08.2026 im `sprint-change-proposal-2026-08-20.md` strukturiert erfasst und als funktionale Anforderungen (FR-44 bis FR-57) in das `prd.md` integriert.

| Bereich | Vollständig umgesetzt | Teilweise / mit PoC-Grenzen | Noch offen / Klärungsbedarf |
| --- | ---: | ---: | ---: |
| Liegenschaftsreferate (14) | 7 | 4 | 3 |
| Veranstaltungsmanagement (6) | 3 | 3 | 0 |
| **Gesamt (20)** | **10** | **7** | **3** |

---

## Teil 1: Anforderungen der Liegenschaftsreferate
### 1. Buchung aus referatsbezogenem Kontingent / Zonen und freie Büros
- **Status:** Umgesetzt (FR-44, FR-45)
- **Realisierung:**
    - **Datenmodell:** `structure.py:159`, `structure.py:169`, `structure.py:177` sowie `structure.py:104`.
    - **Backend:** In `bookings.py:365-375` wird geprüft, ob der Desk oder Raum einer Zone/Org-Einheit zugewiesen ist. Nicht zugeordnete Personen erhalten HTTP 403 `ZONE_RESTRICTED`.
    - **Frontend:** Eigener Reiter „Zonen & Kontingente“ in `FacilityManagement.tsx:184` zur Zuweisung von Referaten und Desks. Im Buchungsplan (`TargetedBooking.tsx:820`) werden
    gesperrte Zonenplätze visuell als „Zonen-Kontingent“ markiert. Büros ohne Zonenzuordnung bleiben nach Standard (FR-5) für alle BAMF-Mitarbeitenden frei buchbar.

### 2. Mehrfachbuchung durch Berechtigte (VL, GZ / Team-Assistenz)
- **Status:** Umgesetzt (FR-11, FR-12)
- **Realisierung:**
    - Im System existiert die Rolle `team_assistenz` („Team-Assistenz/Manager (Geschäftszimmer)“, siehe `seed_data.py:35`).
    - Über die Funktion „Im Namen von agieren“ (`BookFor.tsx`) kann eine berechtigte Person Kolleginnen und Kollegen auswählen und beliebig viele Plätze an Tagen, Wochen oder Monaten im
    jeweiligen Namen buchen. Alle Handlungen werden im bookings.py:110 protokolliert.
    - **Hinweis:** Bucht eine Person mehrere Plätze auf den eigenen Namen am selben Tag, greift die Doppelbuchungs-Warnung (siehe Punkt 4), die mit Begründung bestätigt werden kann.
### 3. Mehrfachbuchung gilt auch für Besprechungs- und Veranstaltungsräume
- **Status:** Umgesetzt
- **Realisierung:** Die Vertretungsberechtigung (`for_user_id`) greift identisch in `bookings.py:454` und `MeetingRooms.tsx`.


### 4. Anzeige aktueller Verfügbarkeit und Vermeidung von Doppelbuchungen
- **Status:** Umgesetzt (FR-5a, FR-8)
- **Realisierung:**
    - **Verfügbarkeitsanzeige:** Interaktive 2-Stufen-Grundrisse (`FloorplanCanvas.tsx`) und Matrix-Zeitstrahl für Meetingräume mit Echtzeit-Status (frei, belegt, gesperrt, Zonen-
    Kontingent).
- **Kollisionsschutz:** Parallele Buchung desselben Platzes/Raums wird hart mit HTTP 409 abgelehnt; bei Desks wird direkt ein Alternativ-Platz vorgeschlagen (`bookings.py:403`).
- **Persönliche Doppelbuchung:** Bucht ein Nutzer zwei Ressourcen parallel, öffnet sich `DoubleBookingModal.tsx`. Er kann entweder die alte Buchung mit einem Klick stornieren oder
    eine Pflichtbegründung (double_booking_reason) angeben.


### 5. Serienbuchungen (regelmäßige Bürotage, Intervalle, Zeitfenster)

- **Status:** Teilweise umgesetzt (FR-9, FR-10)
- **Realisierung:**
    - Wochentagsmuster (z. B. jeden Di + Do), Intervalle (wöchentlich, zweiwöchentlich, monatlich) und frei wählbares Start-/Enddatum sind in `SeriesBooking.tsx` und
    scheduling.py:28 voll implementiert.
- Konflikte werden in einer interaktiven Vorschau angezeigt (inkl. Ersatzarbeitsplatz-Vorschlag); einzelne Tage können vorab abgewählt werden.
- **Einschränkungen / Lücken:**
        1. Tägliche Zeitfenster (Vormittag / Nachmittag): Im Backend über day_part vorhanden, in der UI von SeriesBooking.tsx fehlt aktuell noch das Auswahlfeld (steht fest auf
        Ganztag).
        2. Rollierendes Kurzhorizont-Muster („x Wochen im Voraus für Folgewoche“): Wurde im PRD als Klärungsfrage 19 aufgenommen, ist bisher nicht als Buchungsfenster-
        Restriktion implementiert.
        3. Aus Performancegründen im PoC auf maximal 60 Termine pro Serie begrenzt (scheduling.py:8).


### 6. Flexible Verwaltung von Raumkontingenten und Buchungsberechtigungen

- **Status:** Umgesetzt (FR-45, FR-46)
- **Realisierung:**
    - Zonen können im FM angelegt, umbenannt, mit Referaten verknüpft (optional inkl. aller Unterreferate) und wieder aufgelöst werden.
    - Räume können auf Rollen (z. B. nur VM) oder bestimmte Org-Einheiten beschränkt werden (`structure.py:104`).


### 7. Automatische Bestätigungen, Erinnerungen und Freigabe bei Nichtnutzung
- **Status:** Umgesetzt (PoC-Umfang) (FR-48, FR-49)
- **Realisierung:**
    - Bestätigung erfolgt sofort bzw. nach Genehmigung über das Benachrichtigungssystem.
    - Ein Hintergrund-Task (`main.py:67`) läuft alle 15 Sekunden:
        - Erzeugt Erinnerungen 30 Minuten vor Buchungsbeginn (`REMINDER_WINDOW_MINUTES = 30`).
        - Führt automatische Freigaben bei verpasstem Check-in durch (`ci.status == "pending"` und Frist abgelaufen), storniert die Buchung und benachrichtigt die Person.
    - **Hinweis:** Benachrichtigungen erfolgen im PoC über die In-App-Mitteilungsleiste, nicht via E-Mail/Exchange.

### 8. Sperrung/Freigabe von Arbeitsplätzen und Räumen sowie Zwangsstornierung

- **Status:** Umgesetzt (Rollen-Mapping offen) (FR-26, FR-27, FR-43)
- **Realisierung:**
    - Sperrungen (`/api/fm/locks`) stornieren betroffene Buchungen automatisch und benachrichtigen Nutzer.
    - FM-Zwangsstornierung (`fm.py:680`) mit Pflichtbegründung ist implementiert.
    - **Offener Punkt:** Berechtigung liegt derzeit einheitlich bei der Rolle `fm` (den 12E/12F-Accounts zugewiesen). Eine Aufteilung nach 12E, 12F, VL und RL ist als
    sprint-change-proposal-2026-08-20.md:466 dokumentiert und noch nicht feingranular parametrisiert.


### 9. Anonymisierte Auswertung der tatsächlichen Büroauslastung

- **Status:** Umgesetzt (FR-50)
- **Realisierung:**
    - Auswertungs-Endpunkt `fm.py:1013` und Dashboard im Reiter „Auslastung“ in `FacilityManagement.tsx:1710`.
    - **DSGVO-Schutz:** Bei weniger als 3 Buchungen (`MIN_GROUP_SIZE = 3`) wird die Zahl unterdrückt („Zu wenige Buchungen für Auswertung“), um eine Re-Identifikation kleiner Gruppen
    zu verhindern.
    - **Hinweis:** Basiert auf Buchungs- und Check-in-Daten im Tool (keine IoT-/Präsenzsensorik).

### 10. Raumdaten (Excel) und Grundrisspläne (PDF/JPG) übernehmen

- **Status:** Teilweise umgesetzt / Nur API (FR-51)
- **Realisierung:**
    - Es gibt Backend-Endpunkte für CSV-Raumstammdaten-Import (`fm.py:1248`) und Grundriss-Bildupload (`fm.py:1044`).
    - **Lücken:** Kein direkter `.xlsx`-Parser (muss als `.csv` exportiert werden); keine PDF-Vektorisierung (Pläne werden als Bild-Hintergrund hochgeladen und im FM-Designer interaktiv
    belegt); im Frontend gibt es dafür noch keinen eigenen Upload-Screen (bewusste Vereinfachung laut README).

### 11. Rollen- und Rechteverwaltung, DSGVO-Konformität und Liegenschaftsberechtigung

- **Status:** Weitgehend umgesetzt (FR-18, FR-20, FR-21, FR-50)
- **Realisierung:**
    - **DSGVO:** „Wer sitzt wo“ (`WhoSitsWhere.tsx`) zeigt standardmäßig nur pseudonymisierte IDM-Kennungen. Klarnamen nur bei freiwilligem Opt-in oder manuellem Klick auf „Name
    auflösen“ (Audit-Trail).
- **Rollen:** `mitarbeiter`, `team_assistenz`, `fm`, `raumverantwortlicher`, `vsnfd`, `vm` sind eingerichtet; Nutzer- und Rollenpflege existiert unter `MasterData.tsx`.
- **Lücke:** Liegenschaftsspezifische Buchungsberechtigungen (Mitarbeiter A darf nur in Liegenschaft X buchen) sind noch nicht aktiv; Standard ist uneingeschränkte Buchbarkeit
    aller nicht-kontingentierten Standorte (FR-5).


### 12. Check-in-Pflicht und automatische Freigabe bei Nichtnutzung

- **Status:** Vollständig umgesetzt (FR-47, FR-48)
- **Realisierung:**
    - Check-in-Pflicht kann pro Liegenschaft, Raum oder Desk aktiviert werden (`structure.py:24`, `structure.py:25`).
    - Nutzer können in `MyBookings.tsx` einchecken. Erfolgt kein Check-in vor Ablauf der Frist, storniert der Hintergrund-Sweep die Buchung automatisch und gibt den Platz frei
    (überprüft durch test_double_booking_and_checkin.py:73).


### 13. Schnittstelle zu PVSplus / Alternative: Profil anlegen

- **Status:** Alternative umgesetzt, Schnittstelle nicht implementiert
- **Realisierung:**
    - Eine Schnittstelle zu PVSplus existiert nicht (ist als `sprint-change-proposal-2026-08-20.md:475` dokumentiert).
    - Die in der Mail vorgeschlagene Alternative („Mitarbeitende legen eigens Profil an“) ist umgesetzt: Unter „Meine Präferenzen“ (`Preferences.tsx`) können Standardstandort,
    Ausstattungswünsche, Klarname-Freigabe und eigene Vertreter hinterlegt werden; Admins können Nutzer und Organisationseinheiten über die Stammdatenpflege pflegen.


### 14. Synergieeffekte mit dem Alarmserver prüfen

- **Status:** Nicht umgesetzt / Offene Fachfrage
- **Realisierung:**
    - Im PRD als `sprint-change-proposal-2026-08-20.md:478` festgehalten: Eine Notfall-/Evakuierungsanbindung erfordert zwingend Klarnamen und Anwesenheits-Echtzeitdaten, was im
    Zielkonflikt mit der geforderten DSGVO-Pseudonymisierung (FR-18) steht. Muss vorab mit dem behördlichen Datenschutzbeauftragten geklärt werden.

---
## Teil 2: Anforderungen des Veranstaltungsmanagements (VM)

### 15. Bestehende Buchungen aus dem Vorgänger-Tool automatisiert übertragen

- **Status:** Teilweise umgesetzt / API-Ebene (FR-52)
- **Realisierung:**
    - Endpunkt `fm.py:1270` importiert zukünftige Meetingraum-Buchungen per CSV (`room_id`, `user_idm_code`, `start_at`, `end_at`).
    - **Lücke:** Das konkrete Datenformat und eine Direktschnittstelle des bisherigen Tools sind noch unbekannt (`sprint-change-proposal-2026-08-20.md:309`); kein eigener Frontend-
    Bildschirm.


### 16. Bestuhlungsoptionen und automatische Reservierung von Umbautagen

- **Status:** Vollständig umgesetzt (FR-53, FR-54, FR-55)
- **Realisierung:**
    - Bestuhlungsformen (Boardroom, U-Form, Block, Theater, Schulung, Stuhlkreis) sind konfigurierbar inkl. Rüstzeit (`structure.py:134`).
    - In `MeetingRooms.tsx:74` wählbar mit Live-Visualisierung der Bestuhlung auf dem Canvas.
    - Weicht die Wahl von der Standardbestuhlung ab und sind Umbautage definiert, erzeugt das Backend (`bookings.py:497-508`) automatisch vorangehende Reservierungen mit der
    Kennzeichnung is_changeover_slot=True und der Bemerkung „Umbautag“. Kollidiert ein Umbautag mit einer anderen Buchung, wird die Buchung mit CHANGEOVER_CONFLICT verhindert.


### 17. Südkaserne: Buchungsberechtigung auf Veranstaltungsmanagement (VM) beschränken

- **Status:** Vollständig umgesetzt (FR-46)
- **Realisierung:**
    - Räume besitzen das Attribut `structure.py:81`. In den Demodaten der Nürnberg-Zentrale (ehem. Südkaserne) ist dies für Konferenzräume bereits mit `"vm"` belegt (siehe
    seed_data.py:487).
    - Nicht-VM-Mitarbeiter erhalten bei Buchungsversuch einen Fehler 403 `NOT_AUTHORIZED_ROOM`, und im Zeitstrahl wird der Raum mit dem Hinweis „Nicht berechtigt“ gesperrt.


### 18. Serientermine (wöchentlich, zweiwöchentlich, monatlich bis zu 1 Jahr, flexibles Enddatum)

- **Status:** Umgesetzt (mit PoC-Begrenzung) (FR-9)
- **Realisierung:**
    - Alle drei Intervalle und flexible Start- und Enddaten werden unterstützt (`SeriesBooking.tsx:221-239`).
    - **Hinweis:** Auch hier gilt die PoC-Sicherheitsgrenze von 60 Terminen pro Serie (`scheduling.py:8`).


### 19. Buchungshorizont für VM bis Ende des Folgejahres (aktuell bis Ende 2027)

- **Status:** Technisch möglich / Keine rollenspezifische Obergrenze
- **Realisierung:**
    - Das System besitzt keine starre Obergrenze für das Kalenderjahr – Termine im Jahr 2027 können im Backend und in den Frontend-Datumspickern problemlos gewählt und gebucht
    werden.
    - **Hinweis:** Es gibt derzeit noch keine Differenzierung, die normale Mitarbeiter z. B. auf 4 Wochen deckelt und nur dem VM das Buchen bis Ende 2027 erlaubt.


### 20. Sichtbarkeit: Alle sehen Buchungsname; VM sieht zusätzliches Bemerkungsfeld

- **Status:** Weitgehend umgesetzt / Anzeige-Detail offen (FR-56, FR-57)
- **Realisierung:**
    - **Sichtbarkeit (FR-56):** Bei Meetingräumen wird die Buchungszuordnung (Name und Org-Einheit) für alle Mitarbeitenden im Tages-Zeitstrahl offengelegt (`catalog.py:208-211` und
    MeetingRooms.tsx:864-874).
    - **Bemerkungsfeld (FR-57):** Im Buchungsdialog wird das Feld „Bemerkung (nur für VM sichtbar)“ ausschließlich Nutzern mit der Rolle `vm` angezeigt (`MeetingRooms.tsx:1258`). Bei
    automatisch generierten Umbautagen wird hier automatisch „Umbautag“ eingetragen.
    - **Kleines Anzeigedetail:** Im Zeitstrahl der Raumübersicht wird die Bemerkung bei belegten Slots derzeit nur im Mouseover bei Sperrungen angezeigt, nicht als eigene
    Informationsspalte für VM-Nutzer.

---
## Fazit (KW 38)

Der Prototyp deckt die fachlichen Kernabläufe für die anstehende Präsentation in der 38. KW ab. 
Alle zentralen Flows (Zonen, Bestuhlungen inkl. automatischer Umbautage,
VM-Zugriffsbeschränkung, Check-in/No-Show und Buchungs-Delegation) sind lauffähig und durch automatisierte Tests (unit: 36 Tests erfolgreich) abgesichert.

Offene Punkte und Klärungsbedarf:

1. Schnittstellen: Festlegung des Altsystem-Formats für Buchungsübernahme und Klärung der PVSplus-Anbindung.
2. Datenschutz-Abstimmung: Klärung mit dem Datenschutzbeauftragten bezüglich Alarmserver-Synergie vs. Pseudonymisierung.
3. Feinjustierung: Freigabe des Buchungshorizonts für reguläre Mitarbeiter vs. VM sowie Einbindung des Vormittag/Nachmittag-Schalters in der Serienbuchungsmaske.

