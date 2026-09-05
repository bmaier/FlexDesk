# PRD Quality Review — Desk Sharing Anwendung für BAMF

## Overall verdict

This PRD is disciplined and largely decision-ready: it names trade-offs, tags assumptions and PM-level tensions honestly, and keeps FR/UJ/SM IDs and cross-references clean throughout. The main risk is a scope-thesis tension around the semantic data layer (§4.11, FR-34–38) — a substantial technical investment justified as an "architecture precondition" for Release 2a whose necessity is asserted more strongly than it's demonstrated. Secondary risk: roughly half the FRs skip an explicit testable-consequence block, which will push interpretation work onto downstream story authors.

## Decision-readiness — strong

Trade-offs are named, not smoothed. FR-5 ("Uneingeschränkte Desk-Verfügbarkeit" — no quota by team/Referat) is stated plainly as a decision, and its downside (team-clustering complaints) surfaces honestly as counter-metric **SM-C2** rather than being silently absorbed. FR-17 (no approval check for confidential room blocking) is a real risk accepted deliberately, and it's paired with `[NOTE FOR PM]` at §6.1 flagging it must still be checked with the actual BAMF Geheimschutzbeauftragter — a real tension, not a safe checkpoint. Open Questions (§12) are genuinely unresolved (pilot site, hosting operator/BSI-C5, VS-NFD sign-off, integration spec, adoption target, notification channel) rather than rhetorical.

### Findings
- **low** Quota trade-off narrated only via counter-metric, not in the FR itself (§4.1 FR-5, §9) — FR-5's consequence block states "Keine Kontingentierung nach Team, Referat oder Zugehörigkeit" with no rationale for why this is safe; the downside only appears three sections later as SM-C2. *Fix:* one sentence in FR-5's Beschreibung linking to the SM-C2 trade-off so the decision is legible standalone.

## Substance over theater — strong

No persona theater: three UJs, each tied to a specific FR ("Realisiert UJ-1" at FR-1, UJ-2 at FR-9/FR-11, UJ-3 at FR-27). No differentiation/innovation section written for its own sake. The Vision (§1) is specific to this product — named user roles, the 50-100-Liegenschaft scale, the "buchen im Auftrag ohne Grund preiszugeben" tension — not boilerplate that would swap into another agency's PRD unchanged. Cross-Cutting NFRs (§5) carry numbers, not adjectives: "≤10 Sekunden," "50-100 Liegenschaften," not "must be scalable."

## Strategic coherence — adequate

The thesis is legible: minimize friction for the common case (one-click booking, ranking not filtering, no approval workflow for the sensitive case), add friction only where deliberately warranted (VS-NFD as a separate, unavoidable step). Feature grouping and SM-1/SM-2 (adoption rate, P90 booking time) follow from that thesis rather than measuring raw activity.

The semantic data layer (§4.11, FR-34–38) sits outside that thesis and runs on a second, less-examined one: "platform readiness for Release 2a." §10.1 asserts it must be "von Anfang an mitgebaut, nicht nachgerüstet, da Architektur-Voraussetzung für Release 2a," and §6.3 repeats the claim. But the addendum's own language is weaker than the PRD's: "Diese drei Bedingungen [named operations, stable IDs, structured errors] sind eine Architektur-Vorgabe... Sie **hängen eng mit** der semantischen Datenschicht... **zusammen**" — "closely related to," not "requires." The three actual R2a preconditions (named ops, stable IDs, structured errors) don't obviously need RDF vocabularies, SHACL shapes, and JSON-LD delivery to be satisfied. FR-34–38 is honestly tagged `[ASSUMPTION]` as "selbst gesetzter Qualitätsanspruch ohne externes Mandat (kein bekannter externer Konsument)" — the PRD itself flags there's no known external consumer of this semantic layer — yet it's still placed in MVP scope on a causal claim that isn't fully earned.

### Findings
- **high** Semantic layer's MVP inclusion rests on an asserted-not-demonstrated dependency (§4.11, §6.3, §10.1; addendum "API-Design-Grundsätze für Release 1") — the PRD treats "architecture precondition for R2a" as settled fact, but the addendum's own phrasing ("hängen eng zusammen") is weaker, and the three concrete R2a preconditions don't obviously require RDF/SHACL/JSON-LD. This is real MVP scope/cost riding on a soft claim, in a PRD whose own `[ASSUMPTION]` tag admits there's no external consumer. *Fix:* Either strengthen the argument with a concrete Release 2a integration scenario that breaks without FR-34-38, or move FR-34-38 to a Release 1.x/2a-adjacent slot and let the three architecture conditions (§6.3) alone gate R2a readiness.

## Done-ness clarity — adequate

Where "Consequences (testable)" blocks exist, they're genuinely testable (FR-1's "max. 2 Interaktionen," FR-8's "kein Warteschlangen-Mechanismus," FR-16's "ohne ausgefüllte Begründung ist die Blockierung nicht abschließbar"). But coverage is inconsistent: roughly half the FRs (FR-2, FR-6, FR-7, FR-11, FR-13, FR-14, FR-18–20, FR-22–28, FR-30–38) have no Consequences block at all. Many are self-evident from the FR text alone (FR-6, FR-14), but not all:

### Findings
- **medium** FR-24 "Dubletten-Vermeidung bei Labels" uses an unbounded term (§4.8) — "System schlägt beim Anlegen eines neuen Labels **ähnliche**, bestehende Labels vor" has no similarity threshold or matching method; an engineer can't derive a test case for what counts as a suggested match. *Fix:* add a Consequences bullet with a concrete bound (e.g., string-distance threshold, or defer to addendum with a note).
- **medium** FR-13 "Auditierbarkeit von Vertretungshandlungen" lacks a testable consequence (§4.4) — "wird... **separat protokolliert**" doesn't specify what fields are logged, retention period, or who can query the log, despite this being a compliance-adjacent control (DSGVO context in §6.1). *Fix:* add fields/retention/access as an explicit consequence, or an `[ASSUMPTION]` tag if genuinely deferred.
- **low** Cross-cutting NFR "Beobachtbarkeit" (§5) states only "OpenTelemetry-konforme Traces/Metriken" with no bound (which traces, what SLOs, alert thresholds); the addendum reference doesn't add specificity either — it repeats the same sentence. *Fix:* either add a minimal bound in the PRD or explicitly mark this as an architecture-owned detail out of PRD scope.
- **low** No explicit Security NFR beyond pseudonymization/DSGVO (§4.7, §6.1) — for a government system with role-based delegation (Vertretung) and confidential-room blocking, access-control granularity, session handling, and audit-log retention are absent from both NFRs and Constraints, and not flagged as a deliberate deferral. *Fix:* add a Security NFR bullet or an `[ASSUMPTION]`/`[NOTE FOR PM]` noting it's deferred to architecture.

## Scope honesty — strong

Non-Goals (§9) does real work (external users, quotas, approval workflow, waitlists, build-vs-buy) and `[NOTE FOR PM]` appears at genuine tensions (§6.1 VS-NFD sign-off, §10.2 "Chat wird bevorzugt" as a not-yet-measurable success criterion). The `[ASSUMPTION]` roundtrip is clean: all four inline tags (FR-15 §4.5, §4.11, §6.2, §8) are indexed in §13, and no index entry lacks an inline occurrence. Open-items density (6 Open Questions + 4 Assumptions + 2 NOTE FOR PM) is proportionate to the stakes of a federal-agency system with unresolved hosting/certification and VS-NFD questions — not excessive padding.

### Findings
- **medium** Platform/device scope is never stated (§1, §2.3, §4) — UJ-1 says "authentifiziert... öffnet die App," implying a client exists, but no FR, NFR, Non-Goal, or `[ASSUMPTION]` addresses whether this is a responsive web app, native mobile, or both. Given BITV/WCAG 2.1 AA applies "für alle Oberflächen" (§6.1), the surface area this covers is currently undefined. *Fix:* add an explicit platform statement (even a one-line `[ASSUMPTION]`) in §1 or §5.

## Downstream usability — strong

The PRD explicitly targets UX, architecture, and story-creation audiences (§0), and the mechanics back that up: FR IDs run FR-1–FR-38 with no gaps or duplicates, UJ-1–3 and SM-1–5/SM-C1–2 are likewise contiguous, and FR→UJ traceability tags ("Realisiert UJ-1/2/3") and SM→FR validation tags ("Validiert FR-1, FR-2") all resolve to real IDs. The Glossary (§3) is comprehensive and pre-empts drift explicitly — e.g. "Desk" is called out as canonical with "Platz/Schreibtisch/Arbeitsplatz" named as synonyms that still mean Desk.

## Shape fit — strong

This is a multi-stakeholder internal tool with a meaningful UX layer (Mitarbeiter, Team-Assistenz/Manager, FM) plus a regulatory dimension (BITV/WCAG, DSGVO, VS-NFD) — the PRD's shape matches: three UJs with named protagonists carry the consumer-facing flows, §4.8 reads as a capability spec for FM (appropriately, since FM is closer to a single-operator role), and §6.1 gives compliance constraints real traceability to FRs (FR-15, §4.6/§4.7) rather than a generic compliance paragraph. Neither over- nor under-formalized.

## Mechanical notes

- **Glossary gap:** "Meetingraum" is used extensively as a first-class concept (§4.2 heading, FR-6, FR-7, FR-8) but has no own Glossary bullet — it only appears as a `Typ` value inside the "Raum" definition (§3). Given Meetingraum behaves very differently from a Desk-holding Raum (whole-unit booking, 30-minute granularity vs. half/full-day), it likely warrants its own entry.
- **UJ protagonist naming:** UJ-1 (Herr Yilmaz) and UJ-3 (Frau Berger) have named individuals; UJ-2's protagonist is role-only ("Team-Assistenz mit hinterlegter Vertretungsberechtigung für 12 Mitarbeitende"), inconsistent with the other two.
- **ID continuity:** FR-1–38, UJ-1–3, SM-1–5/SM-C1–2 all contiguous, unique, no dangling cross-references found.
- **Assumptions Index roundtrip:** clean — 4 inline `[ASSUMPTION]` tags (§4.5, §4.11, §6.2, §8), all 4 indexed in §13, no orphans either direction.
- **Required sections:** all present for the agreed stakes (Document Purpose, Vision, Target User incl. Non-Users and UJs, Glossary, Features/FRs, NFRs, Constraints, Integration, Rollout, Non-Goals, MVP Scope, Success Metrics, Open Questions, Assumptions Index).
