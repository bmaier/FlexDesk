# Reconciliation: Party-Mode Session vs. PRD + Addendum

**Source input:** `_bmad-output/party-mode/2026-08-13-desk-sharing-bamf.html` (2026-08-13 party-mode keepsake, roster Mary/John/Sally/Winston/Amelia)
**Compared against:** `prd.md` and `addendum.md` in `_bmad-output/planning-artifacts/prds/prd-DeskSharing-2026-08-13/`

Purpose: verify that every decision/finding captured at the party-mode table survived into the final PRD, and flag anything that was lost, watered down, or never carried forward.

---

## 1. R1 / R2a / R2b release split

**Party-mode verdict:**
- R1 — Schnellpfad (Ein-Klick-Standardstandort) + Explorationspfad (Kartenzoom), gated by Winston's three architecture conditions.
- R2a — Chat-Buchung as a full parallel path (not replacing), generative UI components in chat instead of plain text, stack = A2UI + AG-UI + CopilotKit + Google Agent ADK.
- R2b — Chat also for Facility Management administration.

**PRD coverage:** Faithfully carried forward.
- R1 scope: FR-1/FR-2 (quick-path + map/exploration path), and §10.1 MVP Scope lists the full R1 feature set (Desk-Buchung, Meetingraum-Buchung, Serienbuchung, Vertretung, Stornierung, Vertrauliche Raumblockierung, Sichtbarkeit, FM-Verwaltung, Benachrichtigungen, semantische Datenschicht).
- R2a: FR-30 (conversational booking), FR-31 (generative UI components in chat), explicitly tagged *(R2a)*.
- R2b: FR-32 (conversational FM administration), explicitly tagged *(R2b)*.
- §10.2 Out of Scope confirms "Chat-basierte Buchung → Release 2a" / "Chat-basierte FM-Verwaltung → Release 2b."

**Verdict: No gap.** The three-tier split maps cleanly onto FRs and MVP scope sections.

---

## 2. Winston's three architecture conditions for R1

**Party-mode verdict text:** "R1 ... nach Winstons drei Architektur-Bedingungen: **benannte Operationen, stabile Bezeichner, strukturierte Fehlerantworten**" — i.e.:
1. Named, discrete backend operations (not generic CRUD).
2. Stable identifiers for domain objects, independent of user-facing labels.
3. Structured, machine-readable error responses for every action's preconditions and failure modes.

**PRD/addendum coverage:** Searched both documents for the underlying concepts (`operation`, `identifier`/`Bezeichner`, `Fehler`/`error`, `stabil`, `machine-readable`/`maschinenlesbar`). Findings:
- "Operation" appears once, in FR-36 ("Jede API-Ressource und -Operation ist ... über eine x-Extension mit ihrer RDF-Klasse/Property verlinkt") — this is about semantic linking, not about operations being named/discrete as an API design principle.
- "Fehlermeldung" appears twice, but both are **local, per-feature** mentions (UJ-2 edge case: missing Vertretungsberechtigung → "klare Fehlermeldung"; FR-12 consequence: same case → "eindeutige Fehlermeldung"). Neither is stated as a cross-cutting NFR that *every* action must expose structured/machine-readable preconditions and failure modes.
- No mention anywhere of stable/persistent identifiers for domain objects being decoupled from user-facing labels. The closest adjacent text is the Glossar entry for **Desk** ("Kanonischer Begriff — 'Platz', 'Schreibtisch', 'Arbeitsplatz' sind Synonyme..."), which addresses terminology consistency in the glossary, not identifier stability in the data/API model.
- §5 Cross-Cutting NFRs lists only Performance, Skalierung, Beobachtbarkeit — none of Winston's three conditions appear there.
- §4.11 Semantische Datenschicht (FR-34–FR-38: RDF vocab, SHACL shapes, OpenAPI x-extension linking, JSON-LD, schema.org basis) is architecturally adjacent — it's about machine-readable *data* semantics — but does not state operation-naming, ID-stability, or structured-error-response requirements.

**Verdict: Gap.** Winston's three architecture conditions — explicitly framed in the transcript as the *gate* for approving R1 — are not represented anywhere in the PRD as an NFR, nor detailed in the addendum (which is supposed to hold exactly this kind of architecture-level detail). This is the most material gap found: a named approval condition from the architect that never got written down as a requirement or even as an addendum note, so nothing currently holds implementers to it.

---

## 3. Chat as a fully parallel path, not a replacement; "chat preferred" deferred as a success criterion

**Party-mode verdict / dialogue:**
- Sally: "Gegen den Ein-Klick-Chip gewinnt keine Konversation. Zwei ehrliche Türen ins selbe Haus."
- Winston: "First-class für Release 2 heißt, die Semantik-Schicht kriegt endlich einen echten Job." (chat is a genuine parallel capability, not a bolt-on)
- Mary: "'Wird bevorzugt' ist vom Tisch als Erfolgskriterium für Release 1 — das messen wir erst, wenn Release 2a wirklich läuft. Notiert als offener Punkt für die PRD, nicht als Blocker heute."

**PRD coverage:** Faithfully and explicitly carried forward.
- FR-33: "Chat als paralleler, nicht ersetzender Weg" — states the click path (§4.1) is not replaced and both remain permanently fully usable. Direct match to Sally's/Winston's framing.
- §10.2 Out of Scope: `[NOTE FOR PM]` "'Chat wird bevorzugt' als Erfolgskriterium — erst messbar nach Release-2a-Betrieb, siehe §11." — directly matches Mary's ruling, including the "not a blocker today, but a noted open point" framing (surfaced via the `[NOTE FOR PM]` tag).
- §11 Success Metrics, SM-5, explicitly marked "(erst relevant nach Release 2a)" — measures share of complex bookings done via chat vs. click-form, exactly the deferred success criterion Mary described.

**Verdict: No gap.** This is the cleanest carry-through of the four checks — the PRD even preserves Mary's "not a blocker, an open point" nuance via the `[NOTE FOR PM]` tag rather than silently dropping or silently promoting it.

---

## 4. Tech-stack interoperability finding (A2UI + AG-UI + CopilotKit + Google Agent ADK; v0.9 maturity risk)

**Party-mode verdict (Amelia):** "Ich hab's geprüft, nicht geraten: CopilotKit ist Launch-Partner für A2UI, AG-UI unterstützt die Spec direkt. Kein Frankenstein-Stack. Einziger echter Punkt: v0.9 ist jung — Reifegrad-Risiko, kein Kompatibilitätsrisiko." The party-mode verdict box also names the R2a stack explicitly: "Stack A2UI + AG-UI + CopilotKit + Google Agent ADK."

**PRD/addendum coverage:** Searched both documents for `A2UI`, `AG-UI`, `CopilotKit`, `Agent ADK`, `v0.9`, `Reifegrad`/`maturity`, `Frankenstein` — **zero matches in either file.**
- FR-31 ("Generative UI-Komponenten im Chat") describes the *product-level* requirement (interactive components instead of plain text) but names no technology.
- The addendum, whose stated purpose is exactly "technisches Detailwissen und Optionen-Rationale, die zur Architektur/Solution-Design gehören," covers integration landscape, event-driven notifications, and deployment — but has no section on the chat/generative-UI stack at all.
- No trace of the confirmed-compatible finding, and no trace of the v0.9 spec-maturity risk that Amelia flagged as the "one real risk" — this risk doesn't appear in §12 Open Questions or anywhere else.

**Verdict: Gap.** This is a fully verified feasibility finding (not speculation — Amelia was explicit that she checked rather than guessed) with a named, real risk attached (v0.9 spec maturity). None of it — stack names, compatibility confirmation, or the maturity risk — made it into the PRD or the addendum. Since R2a is scoped and its architecture precondition (semantic layer, FR-34–38) is being built in R1 specifically for R2a's sake, the absence of the underlying stack decision and its one known risk is a real gap: nothing currently tells the R2a architecture/build phase what stack was validated, or warns it about the v0.9 maturity risk it should track.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | R1/R2a/R2b release split | No gap — fully and correctly reflected |
| 2 | Winston's three architecture conditions | **Gap** — absent from PRD NFRs and from addendum; the R1 approval gate has no written form |
| 3 | Chat as parallel path + deferred "chat preferred" success criterion | No gap — faithfully reflected, including the nuance of "open point, not blocker" |
| 4 | Tech-stack interoperability finding (A2UI/AG-UI/CopilotKit/Agent ADK, v0.9 risk) | **Gap** — stack names, compatibility confirmation, and the v0.9 maturity risk are entirely absent from both PRD and addendum |

**Recommendation:** Items 2 and 4 both belong most naturally in `addendum.md` (architecture/technical detail, per the PRD's own stated split of concerns in §0), with a one-line cross-reference or NFR-style pointer added to the PRD itself (§5 Cross-Cutting NFRs for item 2; §7 Integration & Abhängigkeiten or §12 Open Questions for item 4, given the v0.9 maturity risk is exactly the kind of thing that belongs in a tracked open question).
