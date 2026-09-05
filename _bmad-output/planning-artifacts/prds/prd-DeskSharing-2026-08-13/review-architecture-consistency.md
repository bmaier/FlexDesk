---
title: Architectural Consistency Review — DeskSharing BAMF PRD
reviewed: prd.md, addendum.md
date: 2026-08-13
---

# Architectural Consistency Review

Scope: internal consistency of `prd.md` (FR-1–FR-38, UJ-1–UJ-3, §1–§13) against `addendum.md`. Five check dimensions requested: (1) FR-vs-FR contradictions, (2) §6.3 sufficiency, (3) Non-Goals/MVP-Scope vs FR consistency, (4) notification architecture vs FR-29, (5) dangling ID references.

## Summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 1 |
| Medium | 3 |
| Low | 4 |

ID integrity (dimension 5) is clean: FR-1…FR-38 are sequential with no gaps or duplicates (verified by summing FRs per §4.1–§4.11 subsection: 5+3+2+3+2+2+4+7+1+4+5 = 38), UJ-1…UJ-3 have no gaps, and every in-document FR/UJ cross-reference (FR-12, FR-27, UJ-1–3, etc.) resolves to a real ID. No finding was needed for that dimension.

---

## Findings

### 1. [CRITICAL] No FR establishes desk double-booking prevention — the analogue of FR-8 is missing for §4.1

**Location:** §4.1 (Desk-Buchung, FR-1–FR-5); referenced gap surfaces in §5 NFR "Skalierung".

**Issue:** §4.2 (Meetingraum-Buchung) has an explicit FR for the core booking-integrity invariant: FR-8 "Konfliktvermeidung ohne Warteliste" — "System verhindert die Doppelbuchung eines Meetingraum-Slots." §4.1 (Desk-Buchung) has no equivalent. FR-1–FR-5 cover quick-booking, map exploration, preference ranking, full/half-day granularity, and unrestricted availability — but none of them require the system to prevent two people from booking the same desk for an overlapping period. FR-4's half-day switch (per-Liegenschaft configurable AM/PM cutoff) makes this a genuinely non-trivial invariant (does a full-day booking conflict with an existing half-day booking on the same desk?), yet it's nowhere stated as a requirement.

This gap is corroborated by §5's own NFR: "System muss gleichzeitige Buchungsvorgänge... korrekt verarbeiten, ohne Race Conditions bei Slot-Konflikten (**FR-8, FR-10**)." The NFR cites FR-8 (room conflicts) and FR-10 (series-conflict skipping) as the FRs it's protecting — but neither one is a desk-booking conflict requirement. FR-10 only describes what happens when a *series* encounters a conflict; it presupposes conflict detection exists rather than establishing it. The primary, highest-traffic MVP flow (SM-1/SM-2 both measure it) has no explicit correctness requirement for its core invariant.

**Suggested fix:** Add an FR in §4.1, e.g. "FR-5a: Konfliktvermeidung bei Desk-Buchung — System verhindert, dass derselbe Desk für überlappende Zeiträume (ganztags/halbtags) doppelt gebucht wird," with testable consequences covering the AM/PM boundary case from FR-4. Update §5's NFR citation to include it.

---

### 2. [HIGH] §6.3 architecture prerequisites for Release 2a are un-enforced by any FR and use inconsistent terminology with the one FR that touches errors

**Location:** §6.3; addendum "API-Design-Grundsätze für Release 1"; FR-12; UJ-2 edge case.

**Issue:** §6.3 lists three conditions Release 1 must satisfy so Release 2a can reuse the API "ohne Neubau": (1) named/standalone operations, (2) stable identifiers independent of label text, (3) structured (non-textual) error responses. The addendum is explicit that these are deliberately **not** FRs: "Diese drei Bedingungen sind eine Architektur-Vorgabe... keine Produktanforderung im FR-Sinn." That's a defensible PRD/architecture split in principle, but it means:

- No FR anywhere requires named/stable API operations or ID stability independent of labels.
- No FR anywhere requires structured/machine-readable error responses. The only two places the PRD touches error behavior at all use the opposite framing: FR-12's consequence says the system blocks the action "mit einer eindeutigen Fehlermeldung" (a clear/unambiguous *message*), and UJ-2's edge case says "mit klarer Fehlermeldung" — both read as human-facing text, which is in tension with §6.3 condition 3's explicit "strukturierte statt textuelle Fehlerantworten."
- Because §10.1 MVP Scope is defined by FR groups, and §6.3 has no FR, there is no line item in §10.1 that visibly carries this architecture prerequisite into delivery/acceptance tracking. It "floats disconnected" exactly as the task brief suspected — it's asserted in §6.3 and restated in the addendum, but nothing downstream (FR list, MVP scope, success metrics) tests it.
- This also affects dimension 3 (Non-Goals/MVP Scope): FR-30 (chat booking) is explicitly out of scope for R1 (§10.2) but its entire feasibility rests on §6.3 being satisfied by R1's *in-scope* work — a dependency that exists only in prose, not in any FR §10.1 can point to.

**Suggested fix:** Either (a) promote the three §6.3 conditions into their own FRs with testable acceptance criteria and list them in §10.1, or (b) at minimum, align FR-12/UJ-2's error-message language with §6.3's "structured, machine-readable" requirement so the one existing error-related FR doesn't contradict the architecture note it's supposed to help satisfy.

---

### 3. [MEDIUM] Vision (§1) promises full chat/click equivalence for "die Buchung"; FR-30 scopes equivalence only to §4.1–§4.3, silently excluding delegation and confidential blocking

**Location:** §1 Vision; FR-30; FR-33.

**Issue:** §1 states chat becomes available "als vollwertiger, gleichwertiger Gesprächs-Flow... kein Chatbot-Anhängsel, sondern ein Weg, der dieselben Fähigkeiten trägt wie der klassische Klick-Pfad" — unqualified, for "die Buchung" generally. FR-30 narrows this explicitly: "funktional gleichwertig zu den Klick-Pfaden aus §4.1–§4.3" — i.e., desk, room, and series booking only. That silently excludes §4.4 (Vertretung/delegated booking) and §4.6 (confidential room blocking) from the chat-parity promise. Given that UJ-2 (Team-Assistenz, a headline journey) is a delegation scenario, the gap between the Vision's unqualified claim and FR-30's bounded scope is a real inconsistency, not just an omission — a reader following the Vision section would expect delegated booking to be chat-capable in R2a.

**Suggested fix:** Narrow §1's wording to match FR-30's actual scope, or extend FR-30 to explicitly state whether delegated booking is included/excluded (with a rationale), the way FR-33 explicitly states the click-path is not replaced.

---

### 4. [MEDIUM] Confidential-room-blocking's only safeguard is deliberate friction (FR-17: no permission check); neither FR-30 nor FR-32 states whether chat ever exposes §4.6, leaving the safeguard's future exposure unaddressed

**Location:** FR-16, FR-17 (§4.6); FR-30, FR-32 (§4.10).

**Issue:** §4.6's design intent is explicit: "Bewusst kein Kontrollmechanismus — die Reibung liegt allein darin, dass es ein separater, unübersehbarer Schritt ist" (FR-17: no approval/permission check at all — friction *is* the control). FR-30 (R2a) is scoped to §4.1–§4.3 and FR-32 (R2b) is scoped to FM label/Sperrung/Defekt management — neither mentions §4.6, so confidential blocking is excluded from chat only by omission, not by explicit statement. Since chat is designed as a fluid, "gleichwertig" conversational channel, and this feature's entire compliance control depends on the friction of a deliberately separate, unmissable step rather than any permission gate, a future chat extension that casually picked up "block this room for VS-NFD" as a conversational intent would silently remove BAMF's only control on that pathway — with no PRD language currently forbidding it.

**Suggested fix:** Add an explicit Non-Goal (§9) or an Out-of-Scope note under FR-30/FR-32 stating that confidential room blocking is deliberately and permanently excluded from any conversational/chat path, not merely unaddressed in R2a/R2b's current scope.

---

### 5. [MEDIUM] FR-29's "extensibility" consequence is an architectural property, not a black-box-testable functional requirement, undermining the PRD/addendum split it claims to preserve

**Location:** FR-29 (§4.9); addendum "Architekturmuster: Event-driven Notifications/Tasks".

**Issue:** FR-29's second "testable" consequence reads: "Der Auslösemechanismus ist erweiterbar um weitere Kanäle, ohne den Kernbuchungsfluss zu ändern." The addendum, by contrast, makes a specific, strong architectural commitment: CloudEvents-standard events published to EventGrid, consumed by independent Subscribers (Task creation, email), explicitly *not* directly coupled — "Zentrale Integrationsarchitektur für dieses Projekt." As literally written, FR-29 would be equally satisfied by a synchronous, hard-coded call from the booking service straight to an email sender — nothing in the FR's testable language would catch that regression, because "extensible without changing the core booking flow" isn't verifiable by a black-box functional test; it's an implementation/architecture property. This is inconsistent with the document's own stated split (§0, and explicitly restated in the §4.9 intro: "Der konkrete Mechanismus... ist in addendum.md dokumentiert; hier die produktseitige Anforderung") — the FR has absorbed an architecture-level claim into its "testable consequences" without actually making it testable at the product level.

**Suggested fix:** Either drop the extensibility clause from FR-29's testable consequences (leaving FR-29 purely about the observable notification behavior) and let the addendum's event-driven pattern stand on its own as an architecture decision, or add a genuinely testable acceptance criterion, e.g. "cancellation/notification triggering is observable as a discrete, independently-consumable event, verifiable independent of which channel(s) are currently wired up."

---

### 6. [LOW] UJ-3's climax is jointly realized by FR-27 and FR-29, but only FR-27 is tagged "Realisiert UJ-3"

**Location:** FR-27; UJ-3.

**Issue:** UJ-3's climax is "Frau Berger erfährt vorab per Benachrichtigung, nicht erst vor dem gesperrten Raum" — that's the notification (FR-29), not the auto-cancellation (FR-27) alone. Only FR-27 carries the "Realisiert UJ-3" tag. Minor traceability gap.

**Suggested fix:** Tag FR-29 as also realizing UJ-3 (or split the tag: FR-27 realizes the cancellation step, FR-29 realizes the notification/climax step).

---

### 7. [LOW] FR-19's "Buchende Person" is ambiguous in delegated-booking scenarios, affecting who sees real names

**Location:** FR-19 (§4.7); interacts with FR-11/FR-12 (§4.4), UJ-2.

**Issue:** FR-19: "Buchende Person und ihre gemäß FR-12 hinterlegten Vertreter sehen den Klarnamen im jeweiligen Buchungskontext." When a Team-Assistenz books on behalf of an employee (FR-11, UJ-2 — "Mitarbeiter sieht die Buchungen unter eigenem Namen"), it's unclear whether "Buchende Person" in FR-19 means the employee whose booking it structurally is, or whoever performed the click (the assistant). This determines whether the assistant can see the employee's real name (arguably yes, since they need it to act), but as worded the sentence doesn't unambiguously say so, and it matters given FR-18's pseudonymized default.

**Suggested fix:** Reword FR-19 to explicitly say "der Mitarbeiter, für den die Buchung erfolgt, sowie seine gemäß FR-12 hinterlegten Vertreter."

---

### 8. [LOW] FR-28 (Defektmeldung) does not trigger Sperrung/cancellation/notification for existing bookings on the reported resource

**Location:** FR-28 (§4.8); contrast with FR-26/FR-27/FR-29.

**Issue:** Reporting a desk/room/equipment as defective (FR-28) only makes the report visible to "nachfolgende Nutzer und FM" — it does not itself set a Sperrung or trigger the FR-27/FR-29 auto-cancel-and-notify chain. Someone with an existing booking on a desk reported broken minutes earlier gets no notification via FR-28 alone; only an FM-initiated Sperrung does that. This may be intentional (FM is expected to escalate defect → Sperrung manually), but it's not stated, and it's a plausible real-world gap (user shows up to a desk already known to be broken).

**Suggested fix:** Either state explicitly that FM must manually convert a Defektmeldung into a Sperrung to protect existing bookings, or add a consequence to FR-28 addressing existing bookings on the reported resource.

---

### 9. [LOW] FR-36 presupposes an OpenAPI specification that no FR requires the system to produce

**Location:** FR-36 (§4.11).

**Issue:** FR-36 requires every API resource/operation to be linked to RDF/SHACL "in der OpenAPI-Spezifikation über eine definierte x-Extension" — this presupposes an OpenAPI spec exists as a deliverable, but no FR (or NFR) independently states that the system publishes one. Likely an implicit/reasonable baseline, but strictly speaking it's an unstated dependency of FR-36, and it's also the natural home for §6.3's "named/standalone operations" condition (Finding 2) if that gets promoted to an FR.

**Suggested fix:** Add a one-line FR or NFR: "System stellt eine OpenAPI-Spezifikation für alle Backend-Operationen bereit," or fold it into whatever FR is created to close Finding 2.

---

## Cross-reference: how findings map to the five requested check dimensions

1. **FR-vs-FR contradictions (§4.1–§4.9 vs §4.10/§4.11):** Findings 3, 4, 6, 7, 8.
2. **§6.3 sufficiency:** Finding 2 (primary), with dependency implications noted under dimension 3.
3. **Non-Goals/MVP Scope consistency:** Finding 2 (FR-30 out-of-scope depends on un-enforced §6.3 conditions that have no FR home in §10.1's in-scope list); no other Non-Goal/Scope contradiction found — §9 and §10 are otherwise internally consistent with FR-5, FR-8, FR-17 consequences.
4. **Notification/event-driven architecture vs FR-29:** Finding 5.
5. **Dangling FR/UJ references or ID gaps/duplicates:** None found — clean.
