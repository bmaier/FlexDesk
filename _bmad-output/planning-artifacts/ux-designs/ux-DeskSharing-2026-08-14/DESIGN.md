---
name: DeskSharing BAMF — Federal Administrative Design System
description: Institutionell-vertrauenswürdiges, aber modernes Design-System für die BAMF Desk-Sharing-Web-App — MD3-abgeleitete Navy/Teal/Slate-Palette, Inter-Typografie, hohe Datendichte für Buchungs-, Genehmigungs- und Facility-Management-Workflows.
status: final
sources:
  - mockups/ (kuratierte Screens + Bild-Assets, siehe Do's and Don'ts für die genaue Aufschlüsselung)
  - imports/ (32 rohe Google-Stitch-Exporte, Winner-Auswahl siehe .memlog.md / reconcile-stitch-imports.md)
  - imports/federal_administrative_design_system/DESIGN.md
  - imports/desksharing_bamf_logo/screen.png
  - imports/professional_headshot_of_a_german_government_official_in_their_40s_friendly_but/screen.png
created: 2026-08-14
updated: 2026-08-19
colors:
  surface: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#43474f'
  inverse-surface: '#2d3133'
  outline: '#737780'
  outline-variant: '#c3c6d1'
  primary: '#001e40'
  on-primary: '#ffffff'
  primary-container: '#003366'
  on-primary-container: '#799dd6'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#00231f'
  on-tertiary: '#ffffff'
  tertiary-container: '#003a35'
  on-tertiary-container: '#38ac9f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#a7c8ff'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#1f477b'
  secondary-fixed: '#d3e4fe'
  on-secondary-fixed: '#0b1c30'
  tertiary-fixed: '#89f5e7'
  tertiary-fixed-dim: '#6bd8cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#005049'
  # WCAG-optimierter Fokusring — ergänzt, da die Prosa des Quell-Systems einen
  # '#2563EB Ring' für Fokuszustände forderte, dieser Ton aber im Frontmatter fehlte.
  focus-ring: '#2563eb'
  background: '#f7f9fb'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-tabular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 4px
  DEFAULT: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1280px
  gutter: 20px
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.on-primary}'
    radius: '{rounded.DEFAULT}'
  button-accent:
    background: '{colors.tertiary-container}'
    foreground: '{colors.on-tertiary}'
    radius: '{rounded.DEFAULT}'
    note: 'Niemals {colors.on-tertiary-container} als Füllung verwenden — siehe Do/Don\'t.'
  button-secondary:
    background: '{colors.surface-container}'
    foreground: '{colors.on-surface}'
    radius: '{rounded.DEFAULT}'
  button-destructive:
    background: '{colors.error}'
    foreground: '{colors.on-error}'
    radius: '{rounded.DEFAULT}'
  input-field:
    background: '{colors.surface}'
    focus-ring: '{colors.focus-ring}'
    radius: '{rounded.DEFAULT}'
  desk-card:
    background: '{colors.surface}'
    radius: '{rounded.md}'
    status-strip-available: '{colors.tertiary-container}'
    status-strip-occupied: '{colors.outline-variant}'
  meeting-room-card:
    background: '{colors.surface-container-lowest}'
    radius: '{rounded.md}'
    availability-strip-free: '{colors.tertiary-container}'
    availability-strip-occupied: '{colors.outline}'
  kpi-tile:
    background: '{colors.surface-container-lowest}'
    radius: '{rounded.md}'
    value-color: '{colors.primary}'
  badge-status-positive:
    background: '{colors.tertiary-fixed}'
    foreground: '{colors.on-tertiary-fixed-variant}'
    radius: '{rounded.full}'
    note: 'Korrigiert von {colors.on-tertiary-container} (WCAG-Fail ~2,6:1) auf {colors.on-tertiary-fixed-variant} (~7,3:1) — siehe Colors-Abschnitt.'
  badge-status-neutral:
    background: '{colors.surface-container-highest}'
    foreground: '{colors.on-surface-variant}'
    radius: '{rounded.full}'
  badge-status-negative:
    background: '{colors.error-container}'
    foreground: '{colors.on-error-container}'
    radius: '{rounded.full}'
  chip-filter-active:
    background: '{colors.primary}'
    foreground: '{colors.on-primary}'
    radius: '{rounded.full}'
  chip-filter-inactive:
    background: '{colors.surface-container-high}'
    foreground: '{colors.on-surface-variant}'
    radius: '{rounded.full}'
  sidebar-nav-item-active:
    background: '{colors.secondary-container}'
    foreground: '{colors.on-primary-fixed-variant}'
    radius: '{rounded.DEFAULT}'
    note: 'Siehe Components → Sidebar-Navigation für die Kontrast-Korrektur-Begründung.'
  tree-node-selected:
    background: '{colors.secondary-container}'
    foreground: '{colors.on-primary-fixed-variant}'
    radius: '{rounded.sm}'
    note: 'Siehe Components → Sidebar-Navigation für die Kontrast-Korrektur-Begründung.'
  timeline-block-booked:
    background: '{colors.surface-variant}'
    foreground: '{colors.on-surface-variant}'
    radius: '{rounded.sm}'
  timeline-block-new:
    background: '{colors.primary-fixed}'
    foreground: '{colors.on-primary-fixed-variant}'
    radius: '{rounded.sm}'
  modal:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
    scrim: '{colors.inverse-surface}'
  avatar:
    radius: '{rounded.full}'
    border: '{colors.surface}'
    fallback-background: '{colors.primary-container}'
    fallback-foreground: '{colors.on-primary-container}'
  floorplan-desk-available:
    fill: '{colors.surface}'
    border: '{colors.on-tertiary-fixed-variant}'
    radius: '{rounded.sm}'
  floorplan-desk-match:
    fill: '{colors.tertiary-container}'
    border: '{colors.tertiary-container}'
    radius: '{rounded.sm}'
  floorplan-desk-occupied:
    fill: '{colors.surface-container-highest}'
    radius: '{rounded.sm}'
  focus-ring:
    color: '{colors.focus-ring}'
    width: 2px
    offset: 2px
---

## Brand & Style

DeskSharing BAMF ist eine interne Fachanwendung für eine Bundesbehörde — die Ästhetik muss **institutionell vertrauenswürdig** wirken (Aktenzeichen, Sicherheitsfreigaben, VS-NFD-Prozesse gehören zum Alltag), darf dabei aber ausdrücklich **nicht** wie ein langweiliges Formular-Tool aussehen. Discovery-Vorgabe war explizit: funktional wie Google Workspace, aber sehr modern und ansprechend. Das System löst diesen Spagat über drei Mittel: (1) ein zurückhaltendes, dunkles Navy als Autoritätsfarbe statt buntem Corporate-Blau, (2) ein einzelnes kräftiges Teal als "es funktioniert"-Akzent für Verfügbarkeit und erfolgreiche Buchungen, und (3) große, mit Bento-Grids, Ambient-Glow-Verläufen, Hover-Lift und weichen Schatten inszenierte Flächen statt dichter Tabellenformulare. Sicherheitskritische Screens (vertrauliche Raumblockierung, Zwangsstorno) brechen bewusst mit der sonst freundlichen Teal-Sprache und wechseln auf Error-Rot und Warnhinweise, um im richtigen Moment ernst zu wirken.

Die visuelle Sprache ist ein M3-artiges (Material Design 3) Tonal-System: Navy/Teal/Slate als Farbfamilien, Inter als alleinige Schriftart, eine durchgängige 4-Punkt-Spacing-Skala und eine Radius-Leiter von scharf (Chips) bis weich (Modals). Datendichte variiert bewusst nach Kontext — hoch in Grundriss-/Zeitleisten-Ansichten (wo Überblick zählt), großzügig in Formularen und Wizard-Schritten (wo Fehler vermieden werden sollen).

## Colors

Die Palette folgt Material Design 3, mit einer wichtigen Anpassung: `primary-container` und `tertiary-container` sind bewusst **dunkel** (Tiefnavy `{colors.primary-container}` bzw. Tannenteal `{colors.tertiary-container}`), während ihre zugehörigen `on-primary-container`/`on-tertiary-container`-Töne (`{colors.on-primary-container}`, `{colors.on-tertiary-container}`) bewusst **hell** sind — umgekehrt zur sonst üblichen MD3-Konvention, bei der Container hell und deren Text dunkel ist.

- **Primary Navy (`{colors.primary}`)** trägt globale Navigation, Markenauftritt und primäre Buttons — die Autoritätsfarbe der Behörde.
- **Accent Teal (`{colors.tertiary-container}`, dunkel, mit `{colors.on-tertiary}`-Text)** ist die "es klappt"-Farbe: primäre Buchungs-CTAs, Verfügbarkeits-Statusstreifen, Erfolgsmeldungen. Wird **nie** dekorativ eingesetzt.
- **Secondary Slate (`{colors.secondary}`, `{colors.secondary-container}`)** trägt unterstützenden Text, Metadaten und den aktiven Sidebar-Zustand.
- **Error (`{colors.error}`, `{colors.error-container}`)** ist reserviert für Ablehnungen, Zwangsstorno, Genehmigungspflicht-Hinweise und die VS-NFD-Sicherheitskennzeichnung — nie für gewöhnliche Warnungen.
- **Background & Surface:** Ein einziger, konsistenter Kühlgrau-Ton `{colors.background}` (= `{colors.surface}`) bildet die Anwendungs-Leinwand; `{colors.surface-container-lowest}` (Weiß) hebt Karten und Eingabeflächen leicht ab. *Korrektur bei der Extraktion:* Die Quelle (`imports/federal_administrative_design_system/DESIGN.md`) nannte in der Prosa `#F8FAFC`, während das Frontmatter-Token `#f7f9fb` führte — beide Vorkommen sind hier auf `#F7F9FB` vereinheitlicht, den Wert, den alle gesichteten Winner-Screens tatsächlich im Tailwind-Konfig verwenden.
- **Fokus-Zustände (`{colors.focus-ring}`, `#2563EB`):** Ein dediziertes, kräftiges Blau für Tastaturfokus auf allen interaktiven Elementen. *Ergänzung bei der Extraktion:* Die Quelle beschrieb in der Prosa einen "hochkontrastigen #2563EB-Ring", der im Frontmatter fehlte — als eigener Token `focus-ring` ergänzt, weil weder das Marken-Teal (`{colors.on-tertiary-container}` ≈ 2,8:1 auf Weiß) noch Navy allein zuverlässig sichtbare Fokusringe auf allen Untergründen liefern. `{colors.focus-ring}` erreicht ~4,6:1 gegen `{colors.background}` und erfüllt damit WCAG 2.1 AA für Nicht-Text-Kontrast mit Reserve.

**Wichtige Kontrast-Regel** (siehe Do's and Don'ts): `{colors.on-primary-container}` und `{colors.on-tertiary-container}` sind ausschließlich als Text-/Icon-Farbe *auf* der jeweiligen dunklen Container-Fläche selbst zulässig — niemals als Text auf hellen Washes (`bg-tertiary-container/10`, `bg-tertiary-fixed/30` u. ä.) oder als Buttonfüllung mit weißer Schrift. Für Text auf hellen Flächen stehen die deutlich dunkleren `{colors.on-tertiary-fixed-variant}` (Teal, ~7,3:1) und `{colors.on-primary-fixed-variant}` (Navy, ~7,2:1) bereit. **Kanonische WCAG-Korrektur** (einzige vollständige Erklärung, siehe Buttons/Badges/Do's-and-Don'ts für Kurzverweise darauf): Mehrere Stitch-Exporte füllten den Accent-/Buchen-Button sowie Status-Badges/Match-Prozent-Kreise mit dem hellen `{colors.on-tertiary-container}` (`#38AC9F`) auf hellem Grund bzw. mit weißer Schrift — das ergibt nur **~2.6–2,8:1 Kontrast** und verfehlt WCAG 2.1 AA (4,5:1) deutlich. Bei der Extraktion durchgängig auf die dunkle `{colors.tertiary-container}`-Füllung (Buttons, >10:1) bzw. `{colors.on-tertiary-fixed-variant}` (`#005049`, Badge-Text, ~7,3:1) korrigiert; Match-Prozent-Kreise ebenso von `{colors.on-primary-container}` (~1,5:1) auf `{colors.on-primary-fixed-variant}` (`#1F477B`, ~7,2:1).

Vermeiden: Rot als generische Fehlerfarbe für Nicht-Fehler-Zustände, Verlaufsflächen außerhalb der dezenten Ambient-Glow-Blur-Kreise, mehr als eine Akzentfarbe pro Screen.

## Typography

**Inter** ist die einzige Schriftfamilie — neutral, extrem gut lesbar, passend zum behördlichen Ton, ohne steif zu wirken.

- `headline-lg` / `headline-lg-mobile` — Seitentitel ("Willkommen, Dr. Schmidt", "Meetingräume").
- `headline-md` — Abschnittsüberschriften innerhalb einer Seite.
- `headline-sm` — Karten-/Panel-Titel (Desk-Namen, Raumnamen, Wizard-Schrittüberschriften).
- `body-lg` / `body-md` — Fließtext, Beschreibungen, Formularhilfetexte.
- `label-md` — Kleine, oft großgeschriebene Labels für Kategorien, Sidebar-Sektionsüberschriften, Badges (nie für längeren Fließtext).
- `data-tabular` — Ausschließlich für Zahlen, Uhrzeiten, Datumsangaben und Desk-/Raum-IDs, damit Ziffern in Listen und Zeitleisten exakt fluchten.

## Layout & Spacing

Skala: `{spacing.base}` / `{spacing.xs}` / `{spacing.sm}` / `{spacing.md}` / `{spacing.lg}` / `{spacing.xl}` (4/4/8/16/24/32px). Desktop-Grid: 12 Spalten, `{spacing.container-max}` (1280px) Max-Breite, zentriert, `{spacing.gutter}` (20px) Außenabstand. Die fixierte Sidebar ist 288px (72 Tailwind-Units) breit; der Content-Bereich erhält `pl-72` Offset plus einen 64px hohen, transluzent-blurrenden Header (`backdrop-blur-md`, `bg-surface/80`).

Informationsdichte ist bewusst kontextabhängig: **hoch** in Grundriss-/Zeitleisten-/Baumstruktur-Ansichten (Gezielte Buchung, Meetingräume-Timeline, Facility-Management-Baum), **großzügig** in Formularen und Wizard-Schritten (Vertrauliche Raumblockierung, Serienbuchung) — dort erzwingt zusätzlicher Weißraum Sorgfalt statt Tempo. Zweispaltige Layouts (Hauptaktion links/mittig, Kontext-Sidebar rechts: Team-Anwesenheit, Statusmeldungen, Mini-Karte) sind das Standardmuster für Buchungs-Screens.

## Elevation & Depth

Tonale Ebenen, ergänzt um dezente Ambient-Schatten:

- **Ebene 0 (Hintergrund):** `{colors.background}` (`#F7F9FB`) — die Basisfläche der Anwendung. *(Korrigiert von der abweichenden `#F8FAFC`-Angabe der Quell-Prosa, siehe Colors.)*
- **Ebene 1 (Fläche):** `{colors.surface-container-lowest}` (Weiß) für Hauptinhalt und inaktive Karten. Kein Schatten, stattdessen 1px `{colors.outline-variant}`-Rahmen.
- **Ebene 2 (Interaktiv):** Gleiche Fläche, aber mit `shadow-sm`/`shadow-md` (0px 4px 6px -1px rgba(0,51,102,0.05)) für Desk-Karten, Meetingraum-Karten und Hover-Zustände — der Navy-getönte Schatten-Farbstich verankert auch Schatten optisch in der Markenpalette.
- **Ebene 3 (Overlay):** Modals, Dropdowns, Sliding-Panels — `shadow-xl` (0px 20px 25px -5px rgba(0,0,0,0.1)) plus Scrim `{colors.inverse-surface}` bei 40–60% Deckkraft mit Backdrop-Blur.
- **Ambient-Glow:** Große, stark verwischte (blur-2xl/3xl), niedrig-opake Farbkreise (`{colors.primary-fixed}`/`{colors.tertiary-fixed}` bei 10–30%) hinter Hero-Bereichen und Panel-Ecken — das "modern, nicht langweilig"-Signaturelement des Systems. Sparsam einsetzen: maximal ein bis zwei Glow-Flächen pro Screen.

## Shapes

Eine 4/8/12/16/24px-Radiusleiter, verfeinert aus den tatsächlich in allen gesichteten Winner-Screens implementierten Tailwind-Radien (die Quelle nannte abweichende Werte, die in keinem Screen so umgesetzt wurden):

- `{rounded.sm}` (4px) — Chips im Kleinstformat, Status-Tags ("Zone B"), Tooltip-Ecken, Floorplan-Desk-Symbole.
- `{rounded.DEFAULT}` (8px) — Buttons, Eingabefelder, Listenzeilen, Sidebar-Nav-Einträge.
- `{rounded.md}` (12px) — Karten: Desk-Karten, Meetingraum-Karten, KPI-Kacheln, Sidebar-Baum-Container.
- `{rounded.lg}` (16px) — Modals/Dialoge, Wizard-Schritt-Container, große Info-Panels.
- `{rounded.xl}` (24px) — Hero-Banner, große interaktive Kartenflächen, Grundriss-Container.
- `{rounded.full}` — Avatare, Pill-Buttons/Chips, Status-Punkte.

Bilder (Headshots, Raumfotos) übernehmen stets den Radius ihres Containers.

## Components

### Buttons
- **Primary** — `{colors.primary}`-Füllung, `{colors.on-primary}`-Text, `{rounded.DEFAULT}`. Für Standard-Formularaktionen ("Speichern", "Weiter").
- **Accent/Buchen** — `{colors.tertiary-container}`-Füllung (dunkles Teal), `{colors.on-tertiary}`-Text (Weiß), `{rounded.DEFAULT}`. Die zentrale "Buchen"/"Jetzt buchen"-Aktion überall in der App. *Korrektur:* siehe Colors-Abschnitt ("Kanonische WCAG-Korrektur") — nie das helle `{colors.on-tertiary-container}` als Füllung verwenden.
- **Secondary** — `{colors.surface-container}`-Füllung, `{colors.on-surface}`-Text. Für "Abbrechen", "Details", untergeordnete Aktionen.
- **Destructive** — `{colors.error}`-Füllung, `{colors.on-error}`-Text. Für "Ablehnen", "Stornierung durchführen", Zwangsstorno.
- **Zustände:** Hover hellt Füllung um ~10% auf bzw. hebt die Karte 1–2px an (`hover:-translate-y-0.5`); Active/Pressed `scale-95`; Disabled 50% Opazität + `cursor-not-allowed`; Loading ersetzt Label durch rotierendes `progress_activity`-Icon.

### Desk-Cards (siehe `mockups/schnellbuchung/`, `mockups/gezielte-buchung-raumplan/`)
`{colors.surface}`-Füllung, `{rounded.md}`, `shadow-sm` (→ `shadow-md` on hover), 2px breiter **Status-Strip** an der linken Kante: `{colors.tertiary-container}` = verfügbar/Top-Match, `{colors.outline-variant}` = belegt. Enthält Desk-ID (`headline-sm`), Standort (`body-md`, `{colors.on-surface-variant}`), Ausstattungs-Chips (siehe Chips), Kollegen-Anwesenheits-Avatare (gestapelt, `-space-x-2`) und einen Buchen-Button. Bei Hover erscheint optional ein Vollflächen-Overlay (`{colors.primary}` bei 90%, `backdrop-blur-sm`) mit zentriertem Accent-Button — nur auf der Schnellbuchungs-Übersicht, nicht in dichten Listen.

### Meetingraum-Karten (siehe `mockups/meetingraeume/`)
`{colors.surface-container-lowest}`, `{rounded.md}`, 1.5px Verfügbarkeits-Strip links (`{colors.tertiary-container}` frei / `{colors.outline}` belegt). Enthält Raumfoto (96–128px, `object-cover`, Radius folgt Container), "Frei"/"Belegt"-Pill-Overlay auf dem Foto, Kapazität + Ausstattungs-Chips, eine **Mini-Timeline** (siehe Kalender/Timeline) und einen dynamischen CTA: `{colors.tertiary-container}`-Füllung + "Buchen", wenn genehmigungsfrei; `{colors.tertiary-container}`-Füllung + "Anfragen"/Send-Icon, wenn genehmigungspflichtig (Badge "Freigabe Req." zusätzlich sichtbar, siehe Badges).

### Sidebar-Navigation
Fixierte linke Sidebar, 288px breit, `{colors.surface-container-low}`, `shadow-[1px_0_8px_rgba(0,0,0,0.02)]`. **Die Sektionsnamen und Linktexte waren über die Winner-Screens uneinheitlich** (Sektionen hießen wahlweise "Workspace"/"Arbeitsplatz"/"Navigation"; derselbe Link hieß "Meetingraum-Buchung" an einer Stelle und "Meetingräume" an anderer; "Vertrauliche Blockierung" vs. "Raum blockieren" vs. "Vertrauliche Raumblockierung"; "Genehmigungen" vs. "Genehmigungs-Inbox" vs. "Genehmigungscenter"). Für die Anwendung gilt ab sofort ein **einziges, verbindliches Schema** — Linktext entspricht immer dem H1-Seitentitel des Zielscreens:

1. **ARBEITSPLATZ** (oberste Sektion, häufigste Aktionen)
   - Schnellbuchung
   - Gezielte Buchung
   - Meetingräume
   - Serienbuchung
   - Meine Buchungen
   - Wer sitzt wo?
2. **VERWALTUNG** (durch Trennlinie abgesetzt; erfordert erweiterte Berechtigung/Genehmiger- oder FM-Rolle)
   - Genehmigungscenter
   - Facility-Management
   - Vertrauliche Raumblockierung
3. **SPEZIALFUNKTIONEN** (unterste Sektion, direkt über der Profilkarte; seltene, aber wichtige Einzelaktionen)
   - Buchen für...
   - Meine Präferenzen

Aktiver Eintrag: `{colors.secondary-container}`-Füllung, `{colors.on-primary-fixed-variant}`-Text (korrigiert von `{colors.on-secondary-container}`, das mit nur 4,55:1 AA lediglich mit 0,05 Marge bestand — `{colors.on-primary-fixed-variant}` erreicht ~7,06:1), `font-semibold`, `shadow-sm`, `{rounded.DEFAULT}`. Inaktiv: `{colors.on-surface-variant}`, Hover `{colors.surface-container-high}`. Sektionslabels in `label-md`, Versalien, `{colors.on-surface-variant}` (nicht `{colors.outline}` — letzteres unterschreitet mit 4,07:1 auf diesem Hintergrund die 4,5:1-Schwelle für Normaltext), `tracking-widest`. Profilkarte (Avatar + Name + Rolle) fest am unteren Rand.

### Badges / Chips / Status-Tags
- **Positiv/Verfügbar** (`badge-status-positive`) — `{colors.tertiary-fixed}`-Füllung (helles Mint) oder `{colors.tertiary-container}`/10-Wash, Text/Icon in `{colors.on-tertiary-fixed-variant}` (dunkles Teal), `{rounded.full}`. *Korrektur:* siehe Colors-Abschnitt ("Kanonische WCAG-Korrektur") — betrifft auch die Match-Prozent-Kreise (z.B. "98%"). *Architektur-Open-Point (PRD-Audit 2026-08-19):* FR-3 verlangt nur eine sortierte/hervorgehobene Darstellung passender Desks, keine quantifizierte Prozentzahl — welches Gewichtungsmodell die angezeigte Zahl tatsächlich berechnet (Anzahl übereinstimmender Labels? Gewichtete Präferenzen?), ist architektonisch ungeklärt und muss vor Umsetzung definiert werden, damit die UI keine Genauigkeit suggeriert, die das Backend nicht einlöst.
- **Neutral/Ausstehend** (`badge-status-neutral`) — `{colors.surface-container-highest}`-Füllung, `{colors.on-surface-variant}`-Text.
- **Negativ/Genehmigungspflichtig** (`badge-status-negative`) — `{colors.error-container}`-Füllung, `{colors.on-error-container}`-Text (bereits dunkel-auf-hell, unverändert korrekt).
- **Filter-Chips** — aktiv: `{colors.primary}`-Füllung/`{colors.on-primary}`-Text; inaktiv: `{colors.surface-container-high}`/`{colors.on-surface-variant}`; beide `{rounded.full}`.
- **Ausstattungs-/Zonen-Tags** ("Zone B", "Fensterplatz") — `{colors.surface-container}`-Füllung, `{colors.on-surface-variant}`-Text, `{rounded.sm}`. Dieser dunkel-auf-hell-Tag war bereits kontrastkonform (>10:1) und wurde unverändert übernommen.

### Listen
Zeilenhöhe 48–64px, 1px `{colors.outline-variant}`/20–30%-Trenner, kein Zebra-Muster. Zahlen-/Zeitspalten in `data-tabular`. Zeilen-Hover: `{colors.surface-container-low}`. Sekundäraktionen (Details/Stornieren) sind standardmäßig unsichtbar und erscheinen erst bei Hover (`opacity-0 group-hover:opacity-100`), um die Liste ruhig zu halten.

### Formulare / Wizard-Schritte
Mehrschrittige Prozesse (Vertrauliche Raumblockierung: 3 Schritte; Serienbuchung: 2 Schritte) nummerieren jeden Abschnitt mit einem `{colors.primary}`-gefüllten Kreis (32px, weiße Ziffer) vor der Abschnittsüberschrift, statt eines klassischen Progress-Balkens. Abschnitte sitzen in eigenen `{colors.surface-container}`-Karten (`{rounded.lg}`, `shadow-sm`) mit großzügigem `{spacing.lg}`-Innenabstand. Pflicht-Bestätigungs-Checkboxen (VS-NFD) sind großzügig (20×20px), mit `{colors.primary}` beim Ankreuzen gefüllt und schalten den Submit-Button erst frei, wenn aktiviert. Sicherheitsmerkmal-Auswahl erfolgt über Pill-Checkboxen statt klassischer Checkbox-Listen. Eingabefelder: `{colors.surface}`-Füllung, kein sichtbarer Rand im Ruhezustand, `{rounded.DEFAULT}`, bei Fokus 2px `{colors.focus-ring}`-Ring statt der in einzelnen Exporten uneinheitlich verwendeten Teal-/Navy-Ringe.

### KPI-Kacheln
`{colors.surface-container-lowest}`, `{rounded.md}`, `shadow-sm`, dezenter farbiger Blur-Kreis in der Ecke (siehe Elevation). Struktur: kleines rundes Icon-Badge, `label-md`-Beschriftung in Versalien (`{colors.on-surface-variant}` — nicht `{colors.outline}`, das auf diesem Weiß nur 4,49:1 erreicht, unter der 4,5:1-Schwelle für Normaltext), große `headline-lg`-Kennzahl in `{colors.primary}`, optionaler Trend-Indikator (Pfeil-Icon + Kurztext). Verwendet im Genehmigungscenter (Neue/Genehmigt/Abgelehnt + Wochentrend) und in Schnellbuchung/Meetingräume (Bento-Ministatistiken).

### Baumstruktur / Tree-Nav (siehe `mockups/facility-management/`)
Rekursiv einrückende Zeilen (`pl-lg` pro Ebene) mit vertikaler Verbindungslinie (`{colors.outline-variant}`/30, 1px) und `expand_more`/`chevron_right`-Toggle-Icon (rotiert 90° beim Ein-/Ausklappen). Hierarchie: Liegenschaft (`domain`-Icon, `{colors.primary}`) → Gebäude (`apartment`-Icon, `{colors.secondary}`) → Raum (`meeting_room`-Icon bei Typ Meetingraum, `chair_alt`-Icon bei Typ Büro-/Desk-Fläche) → Desk (`desk`-Icon, nur unter Büro-/Desk-Flächen-Räumen). Ausgewählter Knoten: `{colors.secondary-container}`-Füllung, `{colors.on-primary-fixed-variant}`-Text (siehe Sidebar-Navigation-Korrektur oben), `{rounded.DEFAULT}`. Genehmigungspflichtige Räume/Desks tragen ein kleines `admin_panel_settings`-Icon rechts in der Zeile (`{colors.tertiary-fixed-dim}`). Jede Zeile zeigt bei Hover einen runden "+"-Button (`{rounded.full}`, 28px, `{colors.on-surface-variant}`, `hover:{colors.surface-container-highest}`) rechtsbündig, der das Entität-Formular für die nächsttiefere Ebene öffnet — bei Tastaturfokus auf die Zeile ebenfalls sichtbar (kein hover-only). Am unteren Ende der Baum-Karte ein volltoniger "+ Neue Liegenschaft"-Textlink in `{colors.primary}`.

### Label-Chip-Picker (siehe `mockups/facility-management-label-katalog/`)
Zugewiesene Labels als Pill-Chips (`{rounded.full}`, `{colors.secondary-container}`-Füllung, `{colors.on-secondary-container}`-Text, kleines `×`-Icon rechts zum Entfernen). Darunter ein volles Eingabefeld (`{colors.surface-container-low}`, `{rounded.DEFAULT}`, `sell`-Icon links) mit Live-Filter gegen den Katalog. Bei erkannter Ähnlichkeit zu einem bestehenden Label erscheint darunter ein Inline-Hinweisblock (`{colors.error-container}`/40%-Füllung, dünner `{colors.error}`/20%-Rand, `{rounded.DEFAULT}`) mit zwei Textlink-Aktionen ("vorhandenes verwenden" primär hervorgehoben, "trotzdem neu anlegen" sekundär). Im Label-Katalog: gleiche Chip-Optik in Zeilenform, dazu Checkbox links (Mehrfachauswahl für "Zusammenführen"), Verwendungs-Zähler (`data-tabular`) rechts, "Mögliches Duplikat"-Badge (`{colors.error-container}`) bei Ähnlichkeitstreffern.

### Entität-Formular (siehe `mockups/facility-management/`)
Öffnet im selben Detail-Panel wie die Raum-/Desk-Ansicht (keine Modal-Verwendung), Header mit `arrow_back`-Icon statt Schließen-`×`, um den hierarchischen Anlegekontext sichtbar zu halten ("Wird angelegt unter: Haus 1"). Felder in `{colors.surface-container-low}`-Eingabezeilen (`{rounded.DEFAULT}`, 48px Höhe), Typ-Auswahl (z.B. Meetingraum/Büro-Fläche) als zwei nebeneinanderliegende Chips analog zum Filter-Chip-Muster (aktiv: `{colors.primary}`-Füllung). Feldgruppen ohne Bezug zum gewählten Entitätstyp werden vollständig ausgeblendet, nicht nur deaktiviert. Footer mit zwei Buttons rechtsbündig: sekundär "Abbrechen", primär "Anlegen" mit Check-Icon.

### Kalender / Timeline-Grid
Zwei Ausprägungen: (1) **Mini-Timeline** auf Meetingraum-Karten — schmaler horizontaler Balken (`{rounded.full}`, 8px hoch), Segmente in `{colors.tertiary-container}`/80% (frei) und `{colors.outline-variant}`/50% (gebucht), Stundenlabels darunter in `label-md`. (2) **Ganztags-Zeitleisten-Grid** (Ops-Ansicht) — Spalten pro Stunde, Zeilen pro Raum, aktuelle Uhrzeit als vertikale `{colors.error}`-Linie mit Zeit-Tooltip, Termine als abgerundete Blöcke (`{colors.secondary-container}`/`{colors.tertiary-container}`/`{colors.surface-container-highest}` je nach Typ), Drag-to-create erzeugt einen `{colors.primary-fixed}`-Block mit Add-Icon während des Ziehens.

### Modals / Dialoge (siehe `mockups/sitzung-abgelaufen/`)
`{colors.surface}`, `{rounded.lg}`, `shadow-xl`, zentriert über `{colors.inverse-surface}`-Scrim (40–60%, `backdrop-blur-sm`). Header trägt bei destruktiven Aktionen (Zwangsstorno, Ablehnen) eine volltonige `{colors.error}`-Kopfzeile mit Warn-Icon; bei bestätigenden Aktionen (Genehmigen) eine `{colors.tertiary-fixed}`/20%-Kopfzeile. Footer immer rechtsbündig: sekundär (Abbrechen) links vom primären/destruktiven Button. Öffnen/Schließen animiert über `scale-95→100` + `opacity-0→100`, 200–300ms. Ausnahme ohne Sekundärbutton: Sitzung-abgelaufen-Modal (nur "Erneut anmelden", `{colors.primary}`-Kopfzeile statt Error/Success-Tönung — kein Fehler, aber auch kein Erfolg).

### Avatare / Headshots
40px Standard, 48px in Genehmigungslisten, `{rounded.full}`, 2px `{colors.surface}`-Rand, `object-cover`. Foto-Stil orientiert sich am kuratierten Referenzbild (`professional_headshot_of_a_german_government_official...`): neutral-professionell, warmes natürliches Licht, Business-Kleidung, leicht unscharfer Bürohintergrund — keine Studio-Hochglanz-Optik. Fallback ohne Foto: Initialen-Kreis, `{colors.primary-container}`-Füllung mit `{colors.on-primary-container}`-Text (≈4,6:1, geprüft und ausreichend) oder `{colors.secondary-container}`/`{colors.on-secondary-container}`. Abwesenheits-/Homeoffice-Zustand: 60% Deckkraft + optional `grayscale`. Präsenz-Punkt (12px, `{rounded.full}`, `{colors.tertiary-fixed}`) unten rechts überlappend für "jetzt im Haus".

### Interaktive Karten / Grundriss-Visualisierung (siehe `mockups/gezielte-buchung-raumplan/` + `mockups/standort-exploration/`)
Zwei Muster: (1) **Abstrakte Geo-Karte** (Standort-Exploration) — Foto-Hintergrund gedimmt, Liegenschafts-Marker als Kreise mit Radius/Farbe nach Auslastung (`{colors.primary}` = viel frei, `{colors.tertiary}` = mittel, `{colors.error}` = fast voll), Klick öffnet Popover mit Kurzinfo + Deep-Link. (2) **SVG-Grundriss** (Gezielte Buchung, Meetingräume-Gebäudeplan) — echte Architektur-Linien (Wände `{colors.outline-variant}`, Fenster `{colors.primary-fixed}`, Türen gestrichelt), Desks als 40×40px `{rounded.sm}`-Quadrate: verfügbar = weiße Füllung + `{colors.on-tertiary-fixed-variant}`-Rand (≥3:1 gegen `{colors.surface}`, erfüllt WCAG 1.4.11 für Nicht-Text-UI-Grenzen — der zuvor verwendete `{colors.on-tertiary-container}`-Rand erreichte nur 2,63:1 und war ein WCAG-Fail), Top-Match = `{colors.tertiary-container}`/20%-Füllung + Ping-Animation, belegt = `{colors.surface-container-highest}`-Füllung, 50% Opazität, `cursor-not-allowed`. Verfügbar/Top-Match/belegt dürfen sich nicht allein über Farbe/Opazität unterscheiden (WCAG 1.4.1): jeder Zustand trägt zusätzlich einen kleinen Status-Icon-Indikator auf dem Desk-Quadrat — z.B. ein Häkchen-Icon für Top-Match, ein Schloss-Icon für belegt. Pan/Zoom über Drag + `+`/`−`-Buttons unten rechts; Legende unten links oder als Footer-Leiste. Klick auf einen Desk öffnet ein seitliches Sliding-Panel (siehe Modals) statt eines Modals, damit die Karte sichtbar bleibt.

**Gebäude/Etagen-Navigator** (links neben dem Grundriss, Gezielte Buchung — Raumplan): dieselbe Baumstruktur-Optik wie Facility-Management (siehe Baumstruktur/Tree-Nav), aber rein lesend/navigierend, keine "+"-Anlegen-Buttons. Etagen-Zeilen zeigen rechtsbündig eine Kennzahl-Pille ("4 passen" in `{colors.primary}`-Füllung bei Top-Matches, sonst `{colors.surface-container}`-Füllung mit "N frei"). Aktive Etage: `{colors.primary-fixed}`-Füllung, `{colors.on-primary-fixed-variant}`-Text. Kopfzeile über dem Grundriss zeigt den vollen Pfad ("Liegenschaft / Gebäude / Etage") sowie einen Karte/Liste-Umschalter (zwei Icon-Buttons, aktiver Zustand `{colors.surface}`-Füllung + `shadow-sm`).

### Empty States (siehe `mockups/login-redirect/`, `mockups/systemfehler/`)
Zentrierter Aufbau: großer (80px) blass gefüllter Icon-Kreis (`{colors.surface-container-high}`, Icon bei 20% Deckkraft), `headline-lg`-Titel, `body-md`-Erklärtext, max. 400px Breite. Verwendet u. a. bei "Buchen für..." vor Kollegen-Auswahl, bei Suchergebnis-Ansichten ohne Treffer und bei Wer-sitzt-wo ohne Treffer. Drei Varianten desselben Grundmusters: (1) **Ladend** — Icon-Kreis durch rotierenden Spinner ersetzt, kein Erklärtext nötig (z.B. Anmelde-Redirect). (2) **Blockierend ohne Aktion** — Icon-Kreis in `{colors.error-container}`-Tönung statt neutral, kein Button (z.B. Zugriff verweigert). (3) **Blockierend mit Aktion** — zusätzlich ein primärer ("Erneut versuchen") und optional ein sekundärer Button ("Problem melden") unter dem Erklärtext (z.B. globaler Systemfehler). **Grundriss-Alternative** (siehe Interaktive Karten/Grundriss-Visualisierung): für Etagen ohne digitalisierte SVG-Kartierung ersetzt eine kartenbasierte Listenansicht (siehe Listen-Komponente) den leeren Kartenbereich, mit `info`-Icon-Hinweistext oberhalb statt des zentrierten Empty-State-Kreises — dieselbe Listenansicht ist über den Karte/Liste-Umschalter jederzeit manuell erreichbar.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Accent-/Buchen-Button: dunkle `{colors.tertiary-container}`-Füllung + weißer Text | Helles `{colors.on-tertiary-container}` (`#38AC9F`) als Buttonfüllung mit weißer Schrift verwenden (~2,8:1, WCAG-Fail) |
| Status-Badges auf hellem Grund: `{colors.on-tertiary-fixed-variant}` / `{colors.on-primary-fixed-variant}` als Text | `{colors.on-tertiary-container}` / `{colors.on-primary-container}` als Text auf hellen Washes einsetzen — diese Töne sind nur für Text auf der jeweiligen *dunklen* Container-Fläche selbst gedacht |
| Ein konsistentes Sidebar-Schema (ARBEITSPLATZ / VERWALTUNG / SPEZIALFUNKTIONEN, Linktext = Seitentitel) | Sektionsnamen oder Linktexte je Screen neu erfinden ("Workspace" vs. "Arbeitsplatz", "Meetingraum-Buchung" vs. "Meetingräume") |
| `{colors.focus-ring}` (2px, WCAG-geprüft ~4,6:1) für alle Tastaturfokus-Zustände | Uneinheitliche, teils zu kontrastarme Fokusringe pro Komponente (mal Teal, mal Navy, mal keiner) |
| Ambient-Glow sparsam (1–2 Flächen je Screen) für den "modern, nicht langweilig"-Charakter | Formulare wie ein reines Behörden-PDF wirken lassen — auch VS-NFD-Screens behalten Radius, Schatten und Struktur des Systems |
| Ein Akzent-Teal konsequent für "verfügbar/erfolgreich", Error-Rot konsequent für Ablehnung/Storno/Sicherheitswarnung | Farbcodierung mischen (z.B. Teal für eine Ablehnung, Rot für eine gewöhnliche Info-Kachel) |
| `data-tabular` für alle Zahlen-/Zeit-/ID-Spalten, damit Ziffern fluchten | Fließtext-Schriftschnitt für Uhrzeiten und IDs in Listen und Zeitleisten verwenden |

`imports/` enthält rohes Stitch-Quellmaterial (32 Exporte, teils mit WCAG-Fails und Duplikaten); `mockups/` enthält 24 Einträge unter klaren, auf die IA abgestimmten Namen — 15 kuratierte Stitch-Winner-Screens, 7 neu entschiedene Screens ohne Stitch-Vorlage (Benachrichtigungs-Panel, Suchergebnis-Ansicht, Anmelde-Redirect, Systemfehler, Sitzung abgelaufen, Meine-Präferenzen-Konto, Label-Katalog) und 2 Bild-Assets (Logo, Avatar-Referenzbild). `facility-management/` und `gezielte-buchung-raumplan/` wurden am 2026-08-19 substanziell erweitert (Standort-Hierarchie-CRUD, Gebäude/Etagen-Navigator) — Details in `.memlog.md`. Dieses Dokument gewinnt bei jedem Konflikt mit beiden — Details zur Winner-Auswahl je Screen in `reconcile-stitch-imports.md`.

