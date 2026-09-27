# Forged Idea: Desk4Me

**Ausgangsidee:** Desk-/Raum-Sharing-Plattform für Behörde mit 50-100 Liegenschaften. Flexible Buchung durch Mitarbeiter selbst oder in Vertretung (Team-Assistenz/Manager), Facility-Management-Verwaltung von Gebäuden/Räumen/Desks, Meetingraum-Buchung, Serienbuchungen, vertrauliche Raumnutzung (VS-NFD), Chat-basierte Buchung mit KI, durchgängige Semantic-Web-Datenmodellierung.

**Status: GEHÄRTET**

## Identität & Sichtbarkeit
- Buchende Person + hinterlegte Vertreter (Team-Assistenz/Manager) sehen Klarnamen im Buchungskontext.
- Alle anderen sehen nur IDM-Kennung/Pseudonym in Übersichten ("wer sitzt wo").
- Pseudonym→Name-Auflösung nie automatisch angezeigt, nur über separaten bewussten IdM-Lookup-Schritt.

## Delegation (Buchen/Stornieren im Auftrag)
- Mischmodell: Org-Sync (Linienvorgesetzter + zugeordnete Team-Assistenz automatisch berechtigt) + Self-Service (Mitarbeiter kann zusätzliche Vertreter benennen).
- Kein Stornierungsgrund wird im System erfasst — reine Berechtigungsprüfung. (Verworfen: Freitext-/Kategorie-Grundfeld, wegen Art.-9-DSGVO-Risiko bei Gesundheitsdaten wie "krank".)

## VS-NFD / vertrauliche Raumnutzung
- Ganzer Raum (inkl. nicht nutzbarer weiterer Desks) blockierbar mit Pflicht-Begründung.
- Begründung ist rein dokumentarisch. Kein Freigabe-Workflow, keine Berechtigungsprüfung im System. (Verworfen: Approval-Mechanismus — bewusst nicht gewollt.)

## Chat-Buchung / KI
- KI ausdrücklich gewünscht (Korrektur eines Tippfehlers im Ursprungstext: "kein" → "eine").
- Frontend: A2UI + AG-UI + CopilotKit.
- Backend: zusätzlich Google Agent ADK zur gekapselten Implementierung der Agentenlogik.

## Semantic-Web-Schicht (RDF/SHACL/JSON-LD)
- Persönlicher Qualitätsanspruch des Auftraggebers — kein externes Mandat, kein bekannter externer Konsument.
- Ziel: durchgängige, geprüft eindeutige semantische Bedeutung aller Datenfelder/Objekte.
- Eigentliche Begründung für Architektur/PRD: garantierte, maschinenprüfbare Konsistenz zwischen Frontend, Backend, KI-Tool-Calls — nicht "KI braucht RDF um Synonyme zu verstehen" (LLMs verstehen Sprachvariation bereits nativ).

## Buchungs-UX (Desk)
- Schnellpfad: Standardstandort/zuletzt genutzte Standorte als Ein-Klick-Chip, keine Karte nötig für den Regelfall.
- Explorationspfad: volle Kartenansicht mit Cluster-Zoom (Land → Region → Stadt → Gebäude → Etage → Raum) für neue/unbekannte Standorte.
- Halbtags-Umschaltzeitpunkt (Vormittag/Nachmittag-Grenze) ist pro Liegenschaft konfigurierbar, nicht systemweit fix.
- Präferenz-Matching: Ranking/Hervorhebung der besten Treffer, keine harte Filterung — alle Desks bleiben sichtbar/buchbar unabhängig vom Präferenz-Score.
- Keine Team-/Referats-Kontingente — jeder Mitarbeiter darf jeden Desk an jeder Liegenschaft buchen.

## Sperrung & Serienbuchung
- Facility Management sperrt Desk/Raum/Liegenschaft (befristet oder ab Datum, mit/ohne Enddatum).
- Nachträgliche Sperrung mit bestehenden Buchungen: automatische Stornierung + Benachrichtigung an Betroffene (Benachrichtigungskanal noch offen).
- Serienbuchung mit Teilkonflikten: Konflikttermine automatisch übersprungen, Serie entsteht mit Lücken, Nutzer erhält am Ende eine Liste der ausgelassenen Termine. (Verworfen: alles-oder-nichts-Ablehnung; Einzelentscheidung pro Konflikt.)

## Meetingräume
- Nur ganze Räume buchbar (keine Einzelplätze), halbstundenbasiert.
- Keine Warteliste — Doppelbuchung wird schlicht verhindert (Slot belegt oder frei).

## Label-System (Gebäude/Raum/Desk-Eigenschaften)
- Facility Management vergibt Labels.
- Gute Vorschlagstechnik beim Anlegen soll Dubletten vermeiden (z.B. Ähnlichkeitsvorschläge).
- Bereits entstandene Dubletten sind manuell korrigierbar/zusammenführbar.

## Offen / nicht in dieser Session behandelt
Falls für PRD relevant, dort noch klären: Benachrichtigungskanal (E-Mail-System?), Meetingraum-Ausstattung-Label-Details, Architektur/Technologie-Details (vom Nutzer bewusst auf später verschoben).
