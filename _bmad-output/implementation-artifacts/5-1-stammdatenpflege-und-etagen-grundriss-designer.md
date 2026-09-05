---
id: "5-1-stammdatenpflege-und-etagen-grundriss-designer"
title: "Story 5.1: Stammdatenpflege, hierarchischer Etagen- und Raum-Grundriss-Designer & FM-weites State-Management"
epic: 5
story: 1
status: done
created: 2026-09-05
---

# Story 5.1: Stammdatenpflege, hierarchischer Etagen- und Raum-Grundriss-Designer & FM-weites State-Management

## User Story
**Als** Facility Manager
**möchte ich** innerhalb des Facility Managements (FM) über alle Teilbereiche (Struktur, Grundriss, Labels, Zonen, Auslastung, Defekte) hinweg ein einheitliches State-Management nutzen, sodass meine gewählte Liegenschaft, Etage und Raum beim Wechsel zwischen den Tabs vollständig erhalten bleiben und ungespeicherte Bearbeitungen nicht verloren gehen,
**damit** ich ohne lästige Re-Selektionen oder Datenverluste nahtlos zwischen Baumstruktur, Zonen und dem 2-stufigen Grundriss-Designer (Etagen-Architektur und Raum-Detailplanung) wechseln und arbeiten kann.

## Akzeptanzkriterien (Acceptance Criteria)

### AC 1: FM-weites synchronisiertes State-Management
- Auswahl von `propertyId`, `floorId` und `roomId` wird zentral in `FacilityManagement` geführt und synchron mit allen aktiven Tabs geteilt:
  - Wird eine Liegenschaft in `Struktur` oder `Grundriss` oder `Zonen` gewählt, gilt diese Auswahl für alle anderen Tabs.
  - Wird in `Struktur` eine Etage oder ein Raum selektiert, übernimmt der `Grundriss` automatisch diese Etage bzw. diesen Raum.
- Der aktive Tab wird URL-gestützt (`useSearchParams` mit `?tab=...`) verwaltet, sodass ein Browser-Refresh oder ein direkter Link (z. B. aus Stammdaten) direkt auf dem gewünschten Tab mit den korrekten Parametern landet.

### AC 2: Tab-State-Persistenz & Erhalt von Bearbeitungsständen
- Alle Tabs (`struktur`, `grundriss`, `labels`, `zonen`, `auslastung`, `defekte`) bleiben im DOM gemountet und werden per CSS (`hidden`) umgeschaltet.
- Beim Hin- und Herwechseln zwischen Tabs bleiben:
  - der ungespeicherte Grundriss, das aktive Werkzeug, der Zoom und das selektierte Element im `FloorplanDesigner`,
  - der aufgeklappte Baum (`expanded`), die aktiven Detailansichten und Formulare in `StructureTab`,
  - die Filter und Zuweisungen in `ZonesTab`
  vollständig erhalten.

### AC 3: Direkte Absprünge zwischen Struktur und Grundriss
- In `StructureTab` bietet jeder Raum (Meetingraum oder Bürofläche) in den Details eine direkte Aktion **„🎨 Diesen Raum im Grundriss-Designer gestalten ↗“**, die unmittelbar in den Tab `grundriss` wechselt und den Raum im Raum-Detailplan öffnet.
- Bei jeder Etage im Strukturbaum gibt es eine Schnellaktion **„🗺️ Grundriss“**, die die Etage im Etagen-Designer öffnet.
- Umgekehrt synchronisiert der Grundriss-Designer bei Wechsel von Etage oder Raum den übergeordneten State, sodass beim Klick zurück auf `Struktur` genau dieser Raum / diese Etage im Baum aufgeklappt und ausgewählt ist.

### AC 4: Explizites Auswahl-Werkzeug („👆 Auswählen & Verschieben“)
- Standardwerkzeug im Designer ist immer `select` („Auswählen & Verschieben“).
- Klick auf ein Element markiert es und zeigt rechts die Eigenschaften; Ziehen verschiebt es flüssig mit 5px-Snapping.
- Im Auswahlmodus führt ein Klick in die freie Fläche zum sauberen Deselektieren – es wird niemals versehentlich ein Objekt erzeugt.
- Hinzufügen-Werkzeuge platzieren genau ein Element und springen automatisch wieder auf `select` zurück.

### AC 5: Reaktive Live-Aktualisierung
- Anlegen von Liegenschaften, Gebäuden, Etagen, Räumen oder Desks triggert `structureVersion`.
- Alle Listen im Grundriss und den Zonen aktualisieren sich sofort live im Hintergrund ohne Browser-Refresh.
- Manueller „🔄 Aktualisieren“-Button in der Kopfleiste.

### AC 6: Testabdeckung & Verifikation
- Frontend-Build (`tsc -b && vite build`) kompiliert fehlerfrei.
- Alle 33 Pytest-Backend-Tests laufen erfolgreich durch.
