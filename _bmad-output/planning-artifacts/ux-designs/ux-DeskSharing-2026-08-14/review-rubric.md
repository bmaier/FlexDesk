# Spine Pair Review — DeskSharing

## Overall verdict

The pair source-extracts cleanly: every `{colors.x}`/`{rounded.x}`/`{spacing.x}` reference in both files resolves to a defined frontmatter token, all 14 components have matching visual (DESIGN.md) and behavioral (EXPERIENCE.md) specs under identical names, and all three PRD UJs plus the major FR clusters (genehmigungspflichtig, VS-NfD, Vertretung) have fully-formed Key Flows with protagonist, climax, and failure path. Nothing is mechanically broken. The real gaps are traceability and completeness at the edges: no inline linking from either spine into the 32 raw `imports/` exports (a downstream consumer must manually cross-reference `reconcile-stitch-imports.md`), a Facility-Management persona with rich behavioral specs but no walked Key Flow, several IA surfaces missing cold-load/empty states, and a dropped "Inspiration & Anti-patterns" section despite `reconcile-stitch-imports.md` already containing exactly that content in prose form. None of this blocks extraction; it will slow down whoever builds against the FM surface or needs to ground a component spec in its source screen.

## 1. Flow coverage — adequate
Checked: PRD §2.3 names three UJs (UJ-1 Yilmaz, UJ-2 Kaya, UJ-3 Berger) and five JTBD personas (§2.1: Mitarbeiter, Team-Assistenz/Manager, Facility Management, Mitarbeiter mit vertraulicher Aufgabe, Kollege/Führungskraft). EXPERIENCE.md's six Key Flows were checked against these plus the FR-39/40 (Genehmigung) and FR-16/17 (VS-NfD) clusters for named protagonist, numbered steps, a climax beat, and a failure path.

### Findings
- **medium** Facility Management is a full PRD persona (§2.1) with two dedicated VERWALTUNG surfaces and a detailed behavioral spec (EXPERIENCE.md Component Patterns, "Baumstruktur/Tree-Nav" row), but has no Key Flow narrated from its own perspective — FM only appears offstage in Flow 6 as the entity that sets a Sperrung, triggering Frau Berger's story. Assigning a Raumverantwortlicher, toggling genehmigungspflichtig, or executing a FR-43 Zwangsstornierung is never walked end to end (EXPERIENCE.md Key Flows, no Flow 7). *Fix:* add a Flow 7 for an FM-Admin protagonist covering label/lock/assign/force-cancel.
- **low** "Kollege/Führungskraft" (the "wer sitzt wo" persona) has no Key Flow either, but this is disclosed honestly via Open Question #1 rather than silently dropped — lower severity than the FM gap. *Fix:* none required until Open Question #1 resolves; then add the flow.

## 2. Token completeness — strong
Extracted: all 47 `colors` keys, 8 `typography` roles, 6 `rounded` scale entries, 8 `spacing` entries, and 23 `components` entries in DESIGN.md's frontmatter, plus every `{path.to.token}` reference in both files' prose (colors: 33 distinct references; rounded: 6; spacing: 8; EXPERIENCE.md: 1 functional reference, `{colors.focus-ring}`). Every reference resolves to a defined key — no dangling tokens. All color tokens carry hex values (no missing values); contrast ratios are explicitly stated for every load-bearing combination the spec calls out as corrected (badge/button teal fail, focus-ring, badge fixed-variant text).

### Findings
- **low** Two of the stated contrast ratios don't hold up under independent WCAG relative-luminance recompute: `{colors.on-tertiary-fixed-variant}` on `{colors.tertiary-fixed}` is stated "~8.6:1" (recompute: ~7.26:1); `{colors.on-primary-fixed-variant}` on `{colors.primary-fixed}` is stated "~8:1" (recompute: ~7.24:1). Both still clear WCAG AA (4.5:1) comfortably, so no pass/fail conclusion changes, but a downstream automated contrast check that trusts the spine's printed number verbatim would carry the wrong figure forward. (DESIGN.md, Colors section and Badges component note.) *Fix:* recompute and correct, or soften to a range ("comfortably >7:1") rather than a specific decimal.
- **low** 8 of 47 color tokens never appear outside their own frontmatter definition — dead MD3-template carryover with no assigned role: `surface-dim`, `surface-bright`, `inverse-on-surface`, `surface-tint`, `inverse-primary`, `secondary-fixed-dim`, `on-secondary-fixed-variant`, `on-background`. `surface-bright` and `surface` also share an identical hex value (`#f7f9fb`), suggesting the duplication was inherited wholesale rather than pruned. (DESIGN.md frontmatter.) *Fix:* delete or give each a one-line role per the spec's "why each exists" requirement.

## 3. Component coverage — strong
Extracted all component names used anywhere: Buttons, Desk-Cards, Meetingraum-Karten, Sidebar-Navigation, Badges/Chips/Status-Tags, Listen, Formulare/Wizard-Schritte, KPI-Kacheln, Baumstruktur/Tree-Nav, Kalender/Timeline-Grid, Modals/Dialoge, Avatare/Headshots, Interaktive Karten/Grundriss-Visualisierung, Empty States — 14 total. Every one has a DESIGN.md `###` subsection (visual spec: anatomy, color usage, sizing, state appearance) and a matching EXPERIENCE.md Component Patterns table row (behavioral: real interaction/state rules, not one-word descriptions — e.g. the Formulare/Wizard row specifies the long-press mechanic, checkbox auto-reset, and the two-step vs. three-section distinction in detail).

### Findings
None — full 1:1 coverage with substantive rules on both sides.

## 4. State coverage — thin
Walked all 17 IA surfaces (including the two chrome-wide, header-level ones) against the state set (empty, cold-load, focus, error, offline, permission-denied) and the 12-row State Patterns table.

### Findings
- **medium** No cold-load/empty-state row exists for: Facility-Management-Baumstruktur (empty liegenschaft, zero search results), Genehmigungscenter (no pending requests), Meine Präferenzen (first use, zero saved favorites), Standort-Exploration, and Meetingräume-Ops-Ansicht. (EXPERIENCE.md, State Patterns table — no rows for these surfaces.) *Fix:* add rows, reusing the Empty States component pattern DESIGN.md already defines.
- **medium** Vertrauliche Raumblockierung has no state for backend rejection *after* a completed long-press (e.g. duplicate active blockierung, invalid Aktenzeichen) — only the early-release-abort path is specified (EXPERIENCE.md Key Flows, Flow 5 Failure; Component Patterns, Formulare/Wizard row). Given this is the most security-sensitive flow in the app, an unhandled-failure gap here carries above-average downstream risk. *Fix:* add an explicit post-submit error state.
- **low** Benachrichtigungs-Panel and Suchergebnis-Ansicht states are fully unspecified, but this is disclosed transparently via Open Questions #4 and #7 rather than silently omitted. *Fix:* none until those Open Questions resolve.

## 5. Visual reference coverage — thin
Listed `mockups/`, `wireframes/` (both absent — expected at this stage, no misuse implied) and `imports/` (32 Stitch exports + `federal_administrative_design_system/DESIGN.md`, `desksharing_bamf_logo/`, and the headshot reference, all cited in DESIGN.md's frontmatter `sources`). Checked whether either spine links inline to a specific import at the section it illustrates, and whether a "spines win on conflict" rule is stated.

### Findings
- **low** `mockups/`/`wireframes/` don't exist yet — only `imports/` — which is expected and stated factually per the project's current stage, not itself a defect.
- **high** Neither DESIGN.md nor EXPERIENCE.md contains a single resolvable link (inline markdown link or path) from a specific section to a specific `imports/*/screen.png` or `code.html`. Import folder names appear only as bare backticked words in prose (e.g. `` `vertrauliche_blockierung` ``, `` `meetingraum_buchung` ``) with no path. Verifying which of the 32 imports backs a given DESIGN.md/EXPERIENCE.md claim requires manually consulting `reconcile-stitch-imports.md` and `.memlog.md`, both outside the spine-pair contract. *Fix:* pull `reconcile-stitch-imports.md`'s winner-to-section mapping into the spines as reference lines — the mapping already exists, this is a placement fix, not new research.
- **medium** The "spines win on conflict" rule — present verbatim in both example EXPERIENCE.md files' IA sections — appears nowhere in this workspace's DESIGN.md or EXPERIENCE.md. Since the 32 raw imports remain on disk and visibly contain the WCAG-failing colors DESIGN.md explicitly corrected (e.g. the `#38AC9F`-on-white badge/button fill), an implementer who opens `imports/` directly without this rule stated could reintroduce a corrected defect. *Fix:* add one line to Foundation or IA: "`imports/` is raw source material; DESIGN.md/EXPERIENCE.md win on any conflict."

## 6. Bloat & overspecification — adequate
Checked for pixel specs where tokens already cover the value, source restatement, prose-where-a-table-works, sections no downstream consumer would read, and decorative narrative untied to a decision. DESIGN.md's editorial voice in Brand & Style is appropriate to its role; EXPERIENCE.md stays functional and doesn't editorialize; Key Flows narrative color stays load-bearing (every beat ties to a concrete UI state change or FR), consistent with the example files' own Key Flows style.

### Findings
- **low** The WCAG-fail correction on the teal badge/button fill (`{colors.on-tertiary-container}` ~2.6–2.8:1) is restated near-verbatim four times: Colors section, Buttons component, Badges component, and the Do's/Don'ts table. Not incorrect, but repetitive — a single canonical statement with cross-references would carry the same information once. *Fix:* keep one full explanation (Colors section) and shorten the other three to a cross-reference.

## 7. Inheritance discipline — strong
Checked `sources` frontmatter resolution (all paths exist on disk), UJ/requirement names against PRD §2.3 verbatim, glossary/term consistency against PRD §3, and component-name consistency across both files' sections.

### Findings
- **low** Both spines consistently spell the security classification "VS-NfD" (mixed case); the PRD and addendum spell it "VS-NFD" (all caps) throughout — a verbatim-inheritance drift on a compliance-sensitive term that feeds an audit-log requirement (FR-17). *Fix:* align capitalization to the PRD's canonical spelling to avoid the mismatch propagating into schema/field names downstream.
- **low** EXPERIENCE.md Flow 1 uses `{Desk}` as a runtime-interpolation placeholder in toast copy ("`{Desk} erfolgreich gebucht.`") — identical brace syntax to the token-reference system (`{colors.x}` etc.), even though `Desk` isn't a frontmatter root. A parser or story-dev treating all `{...}` uniformly could misread it as an unresolvable token reference. *Fix:* use a different placeholder convention (e.g. `<Desk>` or `[Desk]`) for runtime copy variables.
- No other issues: UJ-1/2/3 titles are verbatim from PRD §2.3 (including em-dashes), FR references spot-checked correct (FR-1, FR-5a, FR-12, FR-16/17, FR-27/29, FR-39/40 all match their PRD definitions), component names are consistent across DESIGN.md prose headers and EXPERIENCE.md table rows (cosmetic slash-spacing aside), and the frontmatter `sources` list resolves cleanly on both files.

## 8. Shape fit — strong, with two gaps
DESIGN.md's section order is fully canonical: Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts. EXPERIENCE.md has all eight required-by-default sections (Foundation, IA, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows).

### Findings
- **medium** "Inspiration & Anti-patterns" (required-when-applicable — triggered here because `reconcile-stitch-imports.md`'s "Verworfen"/"Nicht übernommen" sections document extensive rejected alternatives: flat-list vs. tree FM nav, Du-form voice, a master-detail multi-approver view, a "lighter" VS-NfD blocking tier, a second-page meeting-room booking model) is entirely absent from EXPERIENCE.md. That rationale currently lives only in a document outside the spine pair. *Fix:* pull the reject rationale into an Inspiration & Anti-patterns section using the example files' "Rejected — X: because Y" format — the content already exists, this is a placement fix.
- **medium** "Responsive & Platform" (required-when-applicable — triggered by the product's own Desktop-First-with-degradation framing in Foundation) is missing, but the gap is disclosed transparently and correctly reasoned via Open Question #5 (no source material exists for breakpoint behavior). Judged an acceptable interim state for a UX spine at this stage, not a silent omission — but it should block any story-dev work on responsive-degradation behavior specifically until resolved.

## Mechanical notes

- No broken cross-references: every `{colors.x}`/`{rounded.x}`/`{spacing.x}` token in both files resolves; both `sources` frontmatter lists point to files that exist on disk (`imports/federal_administrative_design_system/DESIGN.md`, `imports/desksharing_bamf_logo/screen.png`, `imports/professional_headshot_of_a_german_government_official_in_their_40s_friendly_but/screen.png`, `../../prds/prd-DeskSharing-2026-08-13/prd.md`).
- Component section names differ only cosmetically between files (e.g. "Badges / Chips / Status-Tags" in DESIGN.md vs. "Badges/Chips" in EXPERIENCE.md's table) — no ambiguity, but a strict automated name-matcher would need slash/space normalization.
- `imports/DESIGN.md` (top-level) is byte-identical to `imports/federal_administrative_design_system/DESIGN.md` — an orphan duplicate not cited by either spine's `sources`; harmless but worth deleting during cleanup.
- No Mermaid diagrams present in either file — n/a for syntax checking.
- Frontmatter completeness: DESIGN.md has `name`, `description`, `status`, `sources`, `created`, `updated`, plus full token blocks. EXPERIENCE.md has `name`, `status`, `created`, `updated`, `sources` — complete per spec, though `status: draft` on EXPERIENCE.md vs. `status: in-review` on DESIGN.md is worth reconciling before this is called a finished spine pair.
