# Epics and Stories — DeskSharing BAMF

## Epic 1: Liegenschaften und Standort-Exploration

### Story 1.1: Standort-Exploration mit Deutschlandkarte
Als Mitarbeiter möchte ich alle Liegenschaften auf einer interaktiven Deutschlandkarte sehen, um schnell zu einem Standort zu navigieren.

### Story 1.2: Gebäude- und Etagen-Navigator
Als Mitarbeiter möchte ich in einer Liegenschaft durch Gebäude und Etagen navigieren, um Arbeitsbereiche einzusehen.

## Epic 2: Arbeitsplatz- und Gezielte Buchung

### Story 2.1: Schnellbuchung am Standardstandort
Als Mitarbeiter möchte ich mit einem Klick meinen bevorzugten Arbeitsplatz buchen.

### Story 2.2: Gezielte Buchung mit interaktivem Etagen-Grundriss
Als Mitarbeiter möchte ich über die 5-Ebenen-Hierarchie (Liegenschaft -> Gebäude -> Etage) zu einer Etage navigieren, im interaktiven Etagen-Grundriss Räume auswählen und per Drill-Down in den Raum-Innenplan wechseln, um dort Desks mit Ausstattung visuell oder per Listenansicht auszuwählen und direkt zu buchen.
- **Akzeptanzkriterien:**
  - 3-stufige Baum-Navigation (Liegenschaft -> Gebäude -> Etage) mit automatischer Selektion.
  - Umschaltung zwischen interaktiver Grundrissansicht und tabellarischer Listenansicht.
  - Im Etagen-Grundriss: Klick auf Raum öffnet den Raum-Innenplan mit allen Schreibtischen und Möbeln.
  - Anzeige des Buchungsstatus (Frei, Gebucht, Eigen, Gesperrt) in Echtzeit.

## Epic 3: Delegation und Serienbuchung

### Story 3.1: Buchen für Kolleginnen und Kollegen
Als Team-Assistenz möchte ich Arbeitsplätze im Auftrag von Mitarbeitenden buchen.

### Story 3.2: Serienbuchung mit automatischer Konfliktüberbrückung
Als Mitarbeiter möchte ich regelmäßige Arbeitsplatzserien anlegen.

## Epic 4: Meetingräume und Buchungsservice

### Story 4.1: Meetingraum-Katalog und Buchung mit Genehmigungspflicht
Als Mitarbeiter möchte ich Meetingräume nach Kapazität und Ausstattung filtern und direkt oder mit Freigabeworkflow anfragen.

### Story 4.2: Vertrauliche Raumblockierung
Als Mitarbeiter mit vertraulichen Aufgaben (VS-NFD) möchte ich Räume exklusiv blockieren können.

### Story 4.3: Meetingraum-Grundriss im FM Designer und interaktive Grundriss-Buchung
Als Facility Manager möchte ich Meetingräume im Grundriss-Designer auf dem Etagenplan einzeichnen und mit realen Meetingräumen verknüpfen, und als Mitarbeiter möchte ich Meetingräume direkt im interaktiven Grundriss sehen und per Klick buchen oder anfragen.

### Story 4.4: Detaillierter Meetingraum-Grundriss mit automatischer Bestuhlung, Drag & Drop und Catering-Option mit Kostenstellen-Abrechnung & Genehmigungswarnung
Als Facility Manager und buchender Mitarbeiter möchte ich Meetingräume als echte Räume mit automatischer Bestuhlungsanordnung (Konferenztisch, U-Form, Kino, Schulung, etc.) und allen Stühlen gemäß Raumkapazität planen und per Drag & Drop flexibel nachbearbeiten können; bei der Buchung soll zudem Catering ausgewählt werden können, welches standardmäßig über die Kostenstelle der eigenen Organisationseinheit abgerechnet wird oder bei abweichender Org-Einheit/Kostenstelle eine explizite Genehmigungswarnung mit Bestätigungspflicht verlangt.
- **Akzeptanzkriterien:**
  - Konfigurierbare Bestuhlungsformen (Standard/Konferenz, U-Form, Block, Theater/Kino, Parlamentarisch, Stuhlkreis) mit Rüstzeiten.
  - Generierung aller Stühle gemäß Raumkapazität im Innenraum-Plan, frei per Drag & Drop im FM editierbar.
  - Catering-Option mit Auswahl von Catering-Art und Rechnungs-Kostenstelle.
  - Automatische Vorbelegung der eigenen Kostenstelle (`User.cost_center` / `Department.cost_center`).
  - Pflicht-Bestätigungswarnung (`cost_center_warning_acknowledged`) bei Angabe einer fremden Kostenstelle.

## Epic 5: Facility Management und Raumkontingente

### Story 5.1: Stammdatenpflege und Etagen-Grundriss-Designer
Als Facility Manager möchte ich Liegenschaften, Gebäude, Etagen, Räume und Schreibtische in einer strikten 5-Ebenen-Hierarchie verwalten, Grundrisse auf Etagen- und Raum-Ebene zeichnen und beim Wechsel zwischen FM-Reitern stets den Bearbeitungs- und Navigationskontext behalten.
- **Akzeptanzkriterien:**
  - Saubere 5-Ebenen-Stammdatenpflege ohne Verwechslung von Etage und Raum.
  - Persistentes FM State-Management (SessionStorage): Gewählte Liegenschaft, Gebäude, Etage und Raum bleiben beim Wechsel zwischen den Tabs erhalten.
  - Nach Neuanlage von Etagen oder Räumen sofortige Aktualisierung aller Dropdowns und Pläne ohne Browser-Reload.
  - Etagen-Planer für Raum-Shapes und Infrastruktur (Treppen, Türen, Wände) mit Drag & Drop.
  - Raum-Innenplaner für Desks, Konferenztische und Bestuhlungen.

### Story 5.2: Referatsbezogene Zonen und Raumkontingente
Als Facility Manager möchte ich Zonen für Abteilungen definieren, um exklusive Kontingente zu steuern.

### Story 5.3: Zentrale Stammdatenverwaltung (Orgeinheiten, Kostenstellen, Benutzer, Liegenschaften, Räume) & Kostenstellen-Zuordnung
Als Administrator und Facility Manager möchte ich über einen separaten Menüpunkt alle Stammdaten (Organisationseinheiten mit Kostenstellen, Benutzerzuordnungen mit Kostenstellen, Liegenschaften, Gebäude, Etagen, Räume und Ausstattungsmerkmale) an zentraler Stelle einsehen und bearbeiten können.
