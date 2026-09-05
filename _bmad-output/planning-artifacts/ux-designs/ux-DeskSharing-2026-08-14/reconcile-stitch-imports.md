# Reconcile — Stitch-Imports (32 Exporte)

Input: `imports/` — 32 Google-Stitch-Exporte (code.html + meist screen.png) plus `imports/federal_administrative_design_system/DESIGN.md` (Token-Basis). Vollständige Kurationshistorie in `.memlog.md`. Dieses Dokument fasst zusammen, was verwendet, was verworfen und was dabei an qualitativen Ideen bewusst nicht übernommen wurde.

## Verwendet als Winner (1:1 Basis für DESIGN.md/EXPERIENCE.md)

schnellbuchung_2 (als `mockups/schnellbuchung/`, ergänzt um Idee aus schnellbuchung_1 — siehe Korrektur unten), standort_exploration_flow, gezielte_buchung, gezielte_buchung_raumplan_1, meetingr_ume, serienbuchung, buchen_f_r..., meine_buchungen, wer_sitzt_wo, vertrauliche_raumblockierung, genehmigungscenter, meine_pr_ferenzen, fm_administration_erweitert, federal_administrative_design_system/DESIGN.md (Token-Basis), desksharing_bamf_logo, professional_headshot_of_a_german_government_official... (Avatar-Bildsprache).

## KORREKTUR 2026-08-18 — Schnellbuchung war ebenfalls eine 3-Wege-Konkurrenz, nicht ein linearer Flow

Ursprünglich fälschlich als "Dashboard + Schritt 1 + Schritt 2" behandelt (linearer Flow). Beim Durchklicken der Demo aufgefallen: alle drei sind eigenständige konkurrierende Entwürfe für denselben Schnellbuchung-Landing-Screen (identisch: "Willkommen [Name]" + Desk-Empfehlungen + Team-Widget), kein Wizard. Nachanalyse:

| Variante | Stärke | Schwäche |
|---|---|---|
| schnellbuchung_dashboard | Reichhaltige Sidebar (Gebäude-Status, Zeitraum-Widget, Grundriss-CTA) | Kein expliziter Ein-Klick-"gewohnter Platz"-Pfad — nur Match-%-Karten |
| schnellbuchung_1 | Einziger mit explizitem "Gewohnten Platz buchen"-Hero-Button — direkteste FR-1/UJ-1-Umsetzung | Visuell dünn (157 Zeilen), Du-Form-Ansprache |
| schnellbuchung_2 | Foto-Hero, Datums-Tabs, "Buchen"-Button direkt auf jeder Karte, Team/Status-Sidebar, Etagenübersicht | Kein dedizierter "gewohnter Platz"-Pfad, nur "Favorit"-Badge auf einer Karte unter mehreren gleichrangigen |

**Winner: schnellbuchung_2** als visuelle/strukturelle Basis, **ergänzt um schnellbuchung_1s "Gewohnten Platz buchen"-Hero-Button** (in Sie-Form übersetzt) als eigenständige Sektion oberhalb der "Sofort Verfügbar"-Karten. Die redundant gewordene "Desk 12-B/Favorit"-Karte aus dem ursprünglichen Kartenraster wurde entfernt (jetzt durch den Hero-Button abgedeckt). `schnellbuchung_dashboard` komplett verworfen. Ordner umbenannt: `mockups/schnellbuchung-schritt2/` → `mockups/schnellbuchung/`; `mockups/schnellbuchung-dashboard/` und `mockups/schnellbuchung-schritt1/` gelöscht (Rohmaterial bleibt unverändert in `imports/schnellbuchung_dashboard/` bzw. `imports/schnellbuchung_1/` erhalten).

## Ideen aus unterlegenen Varianten übernommen (Blend statt Verwerfen)

| Übernommen aus | In welchen Winner | Was |
|---|---|---|
| gezielte_buchung_raumplan_2 | gezielte_buchung_raumplan_1 | "In der Nähe"-Kollegen-Anwesenheit, inline Buchungszusammenfassung im Sliding-Panel |
| meetingraum_buchung | meetingr_ume | Ganztags-Zeitleisten-Grid mit Drag-to-Select, als sekundäre Ops-Ansicht (jetzt in IA ergänzt) |
| meetingraum_buchung_v2 | meetingr_ume | Zweistufige/dynamische Buchungslogik (CTA "Buchen" vs. "Anfrage senden" je nach Genehmigungspflicht) |
| vertrauliche_blockierung | vertrauliche_raumblockierung | Halten-zum-Blockieren-Long-Press als zusätzliche Versehens-Sicherung |
| anfragen_genehmigungen | genehmigungscenter | Inbox/"Meine Anfragen"-Umschalter (Requester-Selbstbedienungsansicht) |
| verwaltung | fm_administration_erweitert | Standort-Hierarchie-Baumstruktur (Liegenschaft→Gebäude→Raum→Desk) inkl. Desk-Level-Wartungssperren |
| verwaltung_fm_admin | fm_administration_erweitert | Raumdetail-Panel-Referenz ("Raum A.101", Arbeitsplätze & Auslastung) |

## Verworfen — und was dabei bewusst NICHT übernommen wurde

- **standort_exploration** (ohne `_flow`): komplett verworfen — anderes Design-System ("Liegenschafts-Explorer", eigener Header/Sidebar/Tailwind-Konvention), kein Teil dieser Anwendung. Keine qualitative Idee daraus übernommen, da stilistisch inkompatibel.
- **facility_management_administration**: verworfen zugunsten von fm_administration_erweitert. Dabei NICHT übernommen: das Master-Detail-Muster mit mehreren gleichzeitig sichtbaren Genehmiger:innen pro Raum (Dashboard-Stats-Stil) — falls eine Übersicht "mehrere Verantwortliche pro Raum auf einen Blick" gewünscht ist, ist das ein potenzieller Rückschritt gegenüber diesem Verlierer-Entwurf und sollte bei Bedarf nachträglich ins Facility-Management-Detail-Panel ergänzt werden.
- **anfragen_genehmigungen**: bis auf den Toggle verworfen. NICHT übernommen: der abgerundete, hellere Header-Stil (optisch moderner als genehmigungscenter, aber informationsärmer) — reine Geschmacksfrage, kein Funktionsverlust.
- **meetingraum_buchung**: bis auf das Ops-Grid verworfen. NICHT übernommen: der ursprünglich vermutete kaputte Logo-Platzhalter existierte nicht (Fehlannahme aus dem initialen Screenshot-Review korrigiert, siehe .memlog.md) — kein Fix nötig.
- **meetingraum_buchung_v2**: bis auf die CTA-Logik verworfen. NICHT übernommen: das eigenständige zweiseitige "Raum wählen → Buchungsdetails"-Seitenmodell — stattdessen bleibt meetingr_umes Karten-mit-Sliding-Panel-Muster führend, für IA-Konsistenz mit den übrigen Buchungsflows.
- **vertrauliche_blockierung**: bis auf Long-Press verworfen. NICHT übernommen: die einfachere Ein-Formular-Struktur ohne die granularen Sicherheitsmerkmal-Checkboxen — Klärung ergab, dies ist eine frühere/einfachere Iteration derselben VS-NfD-Funktion, keine bewusst zweite (niedrigere) Freigabestufe. Falls doch einmal eine "leichte" Blockierungsstufe für weniger sensible Fälle gewünscht wird, wäre das eine neue Anforderung, keine wiederzubelebende Altvariante.
- **verwaltung / verwaltung_flow**: bis auf die Baumstruktur-Idee verworfen (verwaltung_flow zu verwaltung: reines Pixel-Duplikat, Formatierungsunterschied). NICHT übernommen: die listenbasierte Flat-Ansicht als Alternative zur Baumstruktur — für FM-Nutzer mit wenigen Liegenschaften könnte eine Liste schneller sein als ein Baum; falls Skalierung auf viele Standorte ausbleibt, ist das ein Punkt für spätere Iteration.
- **gezielte_buchung_flow, gezielte_buchung_raumplan (Basis ohne Suffix)**: verworfen als einfachere/frühere Vorläuferentwürfe (technisch nahezu identisch, kein Grundriss-Hintergrundbild-Unterschied wie ursprünglich vermutet — siehe .memlog.md-Korrektur). Keine eigenständige Idee daraus übernommen.
- **schnellbuchung_flow**: reines Pixel-Duplikat von schnellbuchung_1 (Formatierungsunterschied) — verworfen, keine Idee verloren.
- **meine_pr_ferenzen_flow**: reines Pixel-Duplikat von meine_pr_ferenzen — verworfen, keine Idee verloren.

## Ton-Inkonsistenz bereinigt

`schnellbuchung_1` verwendete vereinzelt Du-Form ("Willkommen Maria,"), alle anderen Winner-Screens Sie-Form. In EXPERIENCE.md zugunsten der durchgängigen Sie-Form vereinheitlicht (Behördenkontext) — auch beim Übernehmen von schnellbuchung_1s Hero-Button-Idee in `mockups/schnellbuchung/` ("Gewohnten Platz buchen" statt "Dein gewohnter Platz").

## KORREKTUR 2026-08-19 — gezielte_buchung war ebenfalls eine Konkurrenz, kein Zwischenschritt

`gezielte_buchung` (als `mockups/gezielte-buchung-suche/`) wurde ursprünglich als Such-/Filter-Zwischenschritt VOR dem Raumplan behandelt. Tatsächlich ist es ein vollständiger, eigenständiger "Grundriss ansehen und Desk wählen"-Screen (abstrakte Zonen-SVG, eigene Buchungslogik, "Jetzt buchen"-Button) — eine Konkurrenz-Variante zu `gezielte_buchung_raumplan_1`, keine Vorstufe. Beim Durchklicken der Demo hatte `gezielte-buchung-suche` zudem gar keinen Link zum Raumplan (Sackgasse), und die Sidebar übersprang `standort-exploration` komplett. Winner: `gezielte_buchung_raumplan_1` (als `mockups/gezielte-buchung-raumplan/`) — hat den vom Nutzer explizit geforderten hierarchischen Gebäude/Etagen-Navigator, den `gezielte_buchung` nicht bietet. `gezielte_buchung` (`mockups/gezielte-buchung-suche/`) verworfen; Präferenz-Filter-Chips-Idee war im Winner bereits vorhanden (eigene "Aktive Filter"-Sektion), keine weitere Übernahme nötig. Navigationskette jetzt: Sidebar → `standort-exploration` → (Liegenschaft-Klick) → `gezielte-buchung-raumplan` (mit Gebäude/Etagen-Navigator) → Buchung.

## Nicht durch Imports abgedeckt

Siehe EXPERIENCE.md → Open Questions (7 Punkte): Wer-sitzt-wo-Empty-State, Onboarding/Login, allgemeine Fehlerzustände, Benachrichtigungs-Panel, Mobile/Responsive, Profil/Account-Einstellungen, Suchergebnis-Ansicht.
