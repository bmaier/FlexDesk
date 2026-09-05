---
title: Compliance/Privacy Review — DeskSharing BAMF PRD
reviewed: prd.md, addendum.md (prd-DeskSharing-2026-08-13)
review-date: 2026-08-13
reviewer-focus: DSGVO/GDPR, BITV 2.0/WCAG 2.1 AA, VS-NFD, Data Governance
---

# Compliance & Privacy Review — DeskSharing BAMF PRD

## Overall Verdict

The PRD's headline privacy claims (pseudonymized-by-default presence, no cancellation-reason capture) are directionally sound and clearly the product of real thought — but they are **necessary, not sufficient**, for a Launch-stakes federal-agency system. The stated stance is undermined by unspecified controls around the mechanisms that surround it (who can de-pseudonymize, how long audit/booking data is kept, whether the workforce co-determination process has even been triggered). Accessibility is asserted but not engineered — a real legal-risk gap at this stakes level. VS-NFD handling is already correctly flagged by the PM as risky, but the current spec goes further than "needs review" — it locks the no-control decision into Non-Goals (§9) *before* the promised expert sign-off happens, and provides no compensating control (audit trail) even as an interim measure. Data retention/deletion is a genuine blind spot: nothing in the document says how long presence/booking data lives, which is the single most consequential omission for a system whose entire value proposition is recording where employees are.

**None of this blocks continued design work**, but several items should not survive to build without an explicit decision (ideally from BAMF's Datenschutzbeauftragter, Personalrat, and Barrierefreiheitsbeauftragter, mirroring the VS-NFD escalation already planned).

## Findings by Severity

| # | Severity | Area | Section/FR | Summary |
|---|----------|------|------------|---------|
| 1 | Critical | Data Governance | §6.2 | No retention/deletion policy for Bewegungsdaten or audit logs anywhere in the PRD |
| 2 | Critical | GDPR/Process | §7, §8, §12 | No mention of Personalrat co-determination (Mitbestimmung) for an employee location/behavior-capable system |
| 3 | Critical | VS-NFD | §4.6, FR-16/17, §9 | "No check at all" locked into Non-Goals pre-emptively, with no compensating audit control |
| 4 | High | GDPR | FR-20 | No access control specified on who may perform pseudonym→Klarname resolution |
| 5 | High | GDPR | FR-13, FR-29 | Vertretungs-audit trail + notifications create unretention-limited, unrestricted linkage of actor↔subject data |
| 6 | High | GDPR/Process | §6.1, §12 OQ3 | No DPIA (Art. 35 DSGVO) referenced despite systematic employee monitoring |
| 7 | High | Accessibility | §6.1 | BITV 2.0/WCAG 2.1 AA has zero FR/NFR backing, no acceptance criteria, no test obligation |
| 8 | High | Data Governance | §6.2, §7 | No linkage between data lifecycle and employment lifecycle (leaver deletion) despite HR integration |
| 9 | Medium | GDPR/Process | §6.1 vs §12 OQ3 | Inconsistent rigor: VS-NFD gets a named expert-review commitment, DSGVO design does not |
| 10 | Medium | GDPR | FR-21, FR-24/25 | Real names stored as generic Labels are exposed to FM's label-dedup/merge tooling |
| 11 | Medium | Accessibility | FR-2, FR-31 | Highest-risk UI patterns for accessibility (map explorer, generative chat UI) have no accessibility acceptance criteria |
| 12 | Low | GDPR | (document-wide) | No data-subject rights process (Art. 15 access / Art. 17 erasure) referenced |
| 13 | Low | Data Governance / Addendum | addendum.md "Chat-Buchung — Tech-Stack"; PRD §6.2, §12 OQ2 | Google Agent ADK backend for R2 raises international-transfer questions, still unresolved alongside hosting/BSI-C5 |

---

## Detailed Findings

### 1. [CRITICAL] No retention/deletion policy for presence/booking data
**Section:** §6.2 Data Governance; touches FR-1–FR-14, FR-16, FR-18–FR-21, FR-26, FR-27.

§6.2 asserts separate DB schemas for Stammdaten (master data) vs. Bewegungsdaten (bookings) as an `[ASSUMPTION]`, but nowhere does the PRD say how long booking history, cancellation records, defect reports, or the FR-13 Vertretungs-audit log are retained, or how/when they are deleted or anonymized. Bewegungsdaten here is functionally **employee location/presence history** — exactly the category DSGVO Art. 5(1)(e) (storage limitation) targets. The schema separation is a good foundation for attaching different retention rules per data class, but the PRD never exploits it.

**Fix:** Add an explicit retention FR/NFR per data class (e.g., raw Bewegungsdaten retained N months for operational use, then anonymized/aggregated for capacity-planning stats; Vertretungs-audit log retained separately with its own, likely longer, justified retention). Add a deletion/anonymization job as an in-scope FR, not an afterthought.

### 2. [CRITICAL] No Personalrat / workforce co-determination process referenced
**Section:** §7 Integration & Abhängigkeiten, §8 Rollout & Change Management, §12 Open Questions.

A system that records who sits where, who booked/cancelled on whose behalf (FR-13), and retains this indefinitely (see Finding 1) is squarely the type of system that triggers statutory co-determination rights for the staff council in German public-sector employment law (e.g., BPersVG-equivalent "Einführung und Anwendung technischer Einrichtungen, die zur Überwachung des Verhaltens oder der Leistung der Beschäftigten bestimmt sind"). §8 discusses phased *technical* rollout but not the *legal* prerequisite of a Dienstvereinbarung with the Personalrat. Without this, the system cannot legally launch in a German federal agency regardless of how well the technical privacy controls are built.

**Fix:** Add to §12 Open Questions and §8: Personalrat consultation/Dienstvereinbarung as a rollout gate, sequenced before the pilot in §8, analogous to the VS-NFD Geheimschutzbeauftragter check already planned.

### 3. [CRITICAL] VS-NFD: no check *and* no compensating control, pre-committed in Non-Goals
**Section:** §4.6, FR-16, FR-17, §9 Non-Goals, §6.1, §12 OQ3.

The PM already flagged this with `[NOTE FOR PM]` and it's an Open Question (§12.3) — good instinct. But the current draft goes further than "pending review": §9 states **"Kein Approval-Workflow für vertrauliche Raumblockierung"** as a committed Non-Goal, and FR-17's "Out of Scope" explicitly rules out "Approval-Workflow, Berechtigungsrollen für VS-NFD" — i.e., the decision is already locked into the spec *before* the promised Geheimschutzbeauftragter sign-off happens. Separately, FR-17 removing *all* checks means there is no verification that the person invoking a VS-NFD block is even security-cleared (SÜG) for VS-NFD matters, no audit logging requirement (unlike FR-13 for Vertretung), and no statement on who can see the mandatory free-text justification — which could itself contain sensitive detail. This creates both a misuse vector (false VS-NFD claims to reserve a room) and a potential information-leakage vector (justification visible to unauthorized viewers).

**Fix:** (a) De-couple §9/FR-17's "no approval workflow" from "no logging at all" — add a mandatory, access-restricted audit log (who, when, room, justification) as a minimum compensating control, independent of whether an approval gate is ever added. (b) Move "no approval workflow" out of §9 Non-Goals until the Geheimschutzbeauftragter review (§12 OQ3) actually happens — Non-Goals should not pre-empt a review the document itself says is still needed. (c) Clarify justification-text visibility scope.

### 4. [HIGH] No access control on pseudonym-resolution ("IdM-Lookup")
**Section:** §4.7, FR-20.

FR-20 states de-pseudonymization only happens via "einen separaten, bewussten IdM-Lookup-Schritt" — but never says *who* is authorized to perform that lookup. Pseudonymization's entire protective value depends on restricting re-identification; an unrestricted lookup step (e.g., available to any authenticated user, or any FM staffer) makes FR-18's "pseudonymized by default" a UI convention rather than a real privacy control. This is the single most important gap relative to the PRD's own headline privacy claim.

**Fix:** Add an FR specifying which roles may invoke IdM-Lookup, under what conditions (e.g., only FM/HR with documented need, only Vertreter within an active Vertretungsbeziehung per FR-19), and whether lookups are themselves logged (mirroring FR-13's audit pattern).

### 5. [HIGH] Vertretungs-audit trail + notifications risk indirect special-category inference
**Section:** §4.4 FR-13, §4.9 FR-29, in tension with §4.5 FR-15.

FR-15 deliberately omits a cancellation-reason field specifically to avoid capturing special-category (health) data — a sound design instinct. But FR-13 requires that every on-behalf booking/cancellation be logged against both the affected employee and the acting Vertreter, with no stated retention limit or access restriction (see Finding 1), and FR-29 fans this out to notification channels. Recurring, unretention-limited timing/frequency patterns of on-behalf cancellations (e.g., a specific employee's bookings are cancelled by their manager every Monday for months) can still allow inference of health-adjacent patterns even without an explicit reason field — the omission of the field doesn't remove the risk, it just moves it from explicit to inferable.

**Fix:** Explicitly scope who can query/aggregate the FR-13 audit log across time (vs. single-booking lookups only), and apply the same retention limit from Finding 1's fix to this specific log.

### 6. [HIGH] No DPIA referenced
**Section:** §6.1 Compliance & Regulatorik; §12 Open Questions.

Systematic recording of employee location/presence across 50-100 sites, with role-based re-identification (FR-19/20) and audit trails (FR-13), plausibly meets the Art. 35(3) DSGVO criteria for mandatory Datenschutz-Folgenabschätzung (systematic monitoring at scale of a publicly accessible area is one enumerated trigger category, and BfDI/state DPA guidance treats large-scale workplace-monitoring-capable systems as DPIA candidates). §6.1 lists DSGVO as a constraint but doesn't mention a DPIA obligation or owner.

**Fix:** Add a DPIA action item to §12 Open Questions, owned by BAMF's Datenschutzbeauftragter, gating pilot rollout (§8).

### 7. [HIGH] BITV 2.0/WCAG 2.1 AA is a bullet, not a requirement
**Section:** §6.1 (one line); no FR/NFR coverage anywhere.

§6.1 states accessibility is "rechtlich verbindlich für Bundesbehörden" — correct — but this is the only mention in the entire document. There is no FR, no NFR (§5 covers only performance/scaling/observability), no acceptance criteria, no mention in MVP Scope (§10) despite covering "alle Oberflächen," no success metric, and no Open Question tracking it. For a Launch-stakes PRD at a federal agency, an unenforced legal requirement with zero testable backing is a real gap: it risks discovering accessibility failures late (post-build), and BITV 2.0 non-compliance carries genuine legal exposure (Schlichtungsstelle complaints, Verbandsklage under BGG). This is out of step with how rigorously the PRD treats VS-NFD (explicit note + open question + planned expert review) — accessibility gets none of that scaffolding despite being equally legally binding and touching every screen.

**Fix:** Add accessibility as its own NFR category in §5 with testable criteria (WCAG 2.1 AA conformance level per component, Barrierefreiheitserklärung content/location, feedback-mechanism SLA), and add an Open Question/gate for a formal accessibility audit before Launch, mirroring the rigor given to VS-NFD.

### 8. [HIGH] No data-lifecycle link to employment lifecycle
**Section:** §6.2, §7.

The HR-system integration ("DataGrid Services", §7/addendum) presumably supplies org structure for Vertretung (FR-12a), but nothing in the PRD ties an employee's departure/offboarding to deletion or anonymization of their Stammdaten, Bewegungsdaten, Labels (including the optional Klarname label, FR-21), or historical audit entries. Combined with Finding 1 (no retention policy at all), a leaver's presence history could persist indefinitely by default.

**Fix:** Add an FR (or extend the HR integration description in the addendum) specifying that a leaver event triggers defined data handling (anonymize Bewegungsdaten after N days, remove active Labels/preferences, retain only what's legally required).

### 9. [MEDIUM] Inconsistent compliance rigor between VS-NFD and DSGVO
**Section:** §6.1, §12 OQ3 vs. rest of §6.1.

The PRD explicitly commits to getting VS-NFD handling "gegengeprüft" by the actual Geheimschutzbeauftragter before finalizing (§6.1, §12.3) — a good practice. No equivalent commitment exists for the pseudonymization design (§4.7) or retention posture (§6.2) being reviewed by BAMF's actual Datenschutzbeauftragter, despite comparable stakes (both are federal-agency-specific compliance domains with a named internal expert role that should sign off).

**Fix:** Add a parallel Open Question: "DSGVO-Pseudonymisierungs- und Aufbewahrungskonzept final mit dem BAMF-Datenschutzbeauftragten abstimmen," mirroring §12.3.

### 10. [MEDIUM] Real names stored as generic Labels, exposed to FM dedup tooling
**Section:** §4.7 FR-21, §4.8 FR-24/FR-25.

FR-21 lets an employee opt in to expose their Klarname "als eigenes Label." Labels are otherwise generic FM-managed metadata (equipment features, etc.) subject to FR-24's automatic similarity-suggestion and FR-25's manual FM merge/correction workflow. As written, an employee's real name could surface to FM staff reviewing/merging labels for unrelated purposes (e.g., "Fenster" vs. "Fensterplatz" dedup sweeps), even though FM has no defined need to process employee names.

**Fix:** Either model name-disclosure as a distinct data type outside the general Label system, or explicitly exclude self-disclosed name labels from FR-24/FR-25's suggestion/merge surfaces.

### 11. [MEDIUM] No accessibility criteria for the highest-risk UI patterns
**Section:** §4.1 FR-2 (map-based exploration), §4.10 FR-31 (generative UI in chat).

Map-zoom navigation (Land → Region → Stadt → Gebäude → Etage → Raum) and dynamically generated chat UI components (cards, calendars, selectable tiles) are precisely the interaction patterns hardest to make WCAG 2.1 AA-conformant (keyboard navigation through nested spatial UI; screen-reader semantics for dynamically generated, non-standard components). §6.1 says BITV covers "alle Oberflächen," but neither FR mentions an accessible fallback or acceptance criterion.

**Fix:** Add accessibility consequences to FR-2 (e.g., a non-map, list/search-based equivalent path) and to FR-31 (generative components must degrade to accessible semantic HTML/ARIA, not just visual richness).

### 12. [LOW] No data-subject-rights process referenced
**Section:** document-wide.

No FR or NFR addresses how an employee exercises Art. 15 (access) or Art. 17 (erasure) DSGVO rights over their own Bewegungsdaten, Labels, or the FR-13 audit entries naming them.

**Fix:** Add a short NFR/FR noting the process (even if "handled via existing BAMF DSGVO-Auskunftsprozess, out of scope for this system's UI") so it's at least acknowledged rather than silent.

### 13. [LOW] R2 backend (Google Agent ADK) raises international-transfer questions
**Section:** addendum.md "Chat-Buchung — Tech-Stack"; PRD §6.2, §12 OQ2.

The addendum names Google Agent ADK as the backend for chat-based booking logic (R2a/R2b, realizing FR-30–33). If this processes employee booking queries/personal data through Google-operated infrastructure, it raises DSGVO Art. 44–49 international-transfer and BSI/data-residency questions — currently unaddressed and adjacent to the already-open hosting/BSI-C5 question (§6.2, §12 OQ2). Flagged as low severity here only because it's R2-scope/addendum-level, not blocking Release 1, but it should be tracked now so it doesn't surface late.

**Fix:** Add a line to §12 Open Questions or the addendum noting that R2's backend vendor choice must be validated against the same hosting/BSI-C5/data-residency decision still open for Release 1 infrastructure.

---

## Summary Table by Focus Area

- **GDPR/DSGVO (Focus 1):** 8 findings (2 critical, 3 high, 2 medium, 2 low — note one item, #1, is double-counted under Data Governance). Core issue: the two headline privacy claims (pseudonymization, no-reason-capture) are real but under-armored — access control on de-pseudonymization, retention limits, DPIA, and Personalrat co-determination are all absent.
- **BITV 2.0/WCAG 2.1 AA (Focus 2):** 2 findings (1 high, 1 medium). Real gap — legally binding requirement with zero FR/NFR-level enforcement at Launch stakes.
- **VS-NFD (Focus 3):** 1 finding (critical). Worth escalating beyond the existing `[NOTE FOR PM]`: the spec pre-commits "no control, ever" into Non-Goals ahead of the review it says is still needed, and provides no audit-log compensating control.
- **Data Governance / Retention (Focus 4):** 2 findings (1 critical, 1 high). Real and significant gap — no retention or deletion policy exists for what is fundamentally employee presence/location data, and no link between data lifecycle and employment lifecycle.
