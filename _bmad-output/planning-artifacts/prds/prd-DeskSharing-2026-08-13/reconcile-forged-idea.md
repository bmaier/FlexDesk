# Reconciliation: forged-idea.md → prd.md / addendum.md

Source: `_bmad-output/forge/bamf-desk-sharing/forged-idea.md` (13 gehärtete Entscheidungen, Status: GEHÄRTET)
Compared against: `prd.md` and `addendum.md` in `prd-DeskSharing-2026-08-13/`

Legend: ✅ fully captured · ⚠️ gap/weakening/drift · ➕ PRD addition not sourced from forged-idea (informational, not a defect)

## 1. Identität & Sichtbarkeit

| Forged decision | PRD coverage | Status |
|---|---|---|
| Buchende Person + hinterlegte Vertreter sehen Klarnamen im Buchungskontext | FR-19 (near-verbatim) | ✅ |
| Alle anderen sehen nur IDM-Kennung/Pseudonym in Übersichten | FR-18 | ✅ |
| Pseudonym→Name-Auflösung nie automatisch, nur über bewussten IdM-Lookup-Schritt | FR-20 | ✅ |

**Note (➕):** FR-21 ("Freiwillige Namens-Offenlegung") adds an opt-in mechanism letting an employee publish their own real name as a label, visible to everyone. This has no basis in forged-idea.md and — while opt-in — sits in tension with the hardened "alle anderen sehen nur Pseudonym" default. Not a dropped requirement, but a scope addition the PM should confirm was intentional rather than drifted in during PRD authoring.

## 2. Delegation (Buchen/Stornieren im Auftrag)

| Forged decision | PRD coverage | Status |
|---|---|---|
| Mischmodell: Org-Sync (Linienvorgesetzter + Team-Assistenz automatisch) + Self-Service (zusätzliche Vertreter benennen) | FR-12(a)+(b) | ✅ |
| Kein Stornierungsgrund erfasst — reine Berechtigungsprüfung | FR-15, FR-15 Consequences | ✅ |
| Verworfen: Freitext-/Kategorie-Grund (Art.-9-DSGVO-Risiko) | FR-15 `[ASSUMPTION]`, §6.1 DSGVO, §13 Assumptions Index | ✅ (rejection explicitly preserved) |

## 3. VS-NFD / vertrauliche Raumnutzung

| Forged decision | PRD coverage | Status |
|---|---|---|
| Ganzer Raum (inkl. nicht nutzbarer Desks) blockierbar mit Pflicht-Begründung | FR-16 | ✅ |
| Begründung rein dokumentarisch, kein Freigabe-Workflow, keine Berechtigungsprüfung | FR-17, §9 Non-Goals | ✅ |
| Verworfen: Approval-Mechanismus (bewusst nicht gewollt) | §9 Non-Goals, §4.7 Out of Scope | ✅ (rejection explicitly preserved) |

Bonus: PRD adds a sensible `[NOTE FOR PM]` in §6.1 flagging this should be sanity-checked with the actual Geheimschutzbeauftragter — consistent with, not contradicting, the forged decision.

## 4. Chat-Buchung / KI ⚠️ GAP

| Forged decision | PRD coverage | Status |
|---|---|---|
| KI ausdrücklich gewünscht | Vision §1, FR-30–33 | ✅ |
| Frontend: A2UI + AG-UI + CopilotKit | **not found anywhere in prd.md or addendum.md** | ⚠️ **DROPPED** |
| Backend: zusätzlich Google Agent ADK zur gekapselten Agentenlogik | **not found anywhere in prd.md or addendum.md** | ⚠️ **DROPPED** |

This is the clearest gap. `prd.md` §0 explicitly says technical/architecture details live in `addendum.md`, and `addendum.md` does cover other named technologies (Keycloak, EventGrid/CloudEvents, OpenTelemetry, Kubernetes/Podman) — but the specific hardened chat/agent stack (A2UI, AG-UI, CopilotKit, Google Agent ADK) is absent from both documents. FR-31 ("Generative UI-Komponenten im Chat") captures the *product* requirement these tools were meant to satisfy, but the concrete technology decision itself has not been carried forward anywhere. Confirmed via text search — zero hits for any of the four terms in either file.

## 5. Semantic-Web-Schicht (RDF/SHACL/JSON-LD)

| Forged decision | PRD coverage | Status |
|---|---|---|
| Persönlicher Qualitätsanspruch, kein externes Mandat, kein bekannter Konsument | §4.11 `[ASSUMPTION]`, §13 Assumptions Index | ✅ |
| Ziel: durchgängige, geprüft eindeutige semantische Bedeutung | FR-34–38 | ✅ |
| Eigentliche Begründung: maschinenprüfbare Konsistenz FE/BE/KI-Tool-Calls — nicht "KI braucht RDF für Synonyme" | §4.11 Beschreibung states this almost verbatim | ✅ (well captured, arguably improved) |

## 6. Buchungs-UX (Desk)

| Forged decision | PRD coverage | Status |
|---|---|---|
| Schnellpfad: Standardstandort als Ein-Klick-Chip | FR-1 | ✅ |
| Explorationspfad: Kartenansicht mit Cluster-Zoom (Land→Region→Stadt→Gebäude→Etage→Raum) | FR-2 (identical hierarchy) | ✅ |
| Halbtags-Umschaltzeitpunkt pro Liegenschaft konfigurierbar | FR-4 Consequences | ✅ |
| Präferenz-Matching: Ranking, keine harte Filterung | FR-3 | ✅ |
| Keine Team-/Referats-Kontingente | FR-5, §9 Non-Goals | ✅ |

## 7. Sperrung & Serienbuchung

| Forged decision | PRD coverage | Status |
|---|---|---|
| FM sperrt Desk/Raum/Liegenschaft (befristet oder ab Datum, mit/ohne Enddatum) | FR-26 | ✅ |
| Nachträgliche Sperrung: automatische Stornierung + Benachrichtigung (Kanal noch offen) | FR-27, FR-29; addendum.md resolves the channel question via CloudEvents/EventGrid pattern and explicitly references closing this open forge-session point | ✅ |
| Serienbuchung Teilkonflikte: automatisch übersprungen, Lücken, Liste am Ende | FR-10 | ✅ |
| Verworfen: alles-oder-nichts-Ablehnung | §4.3 Out of Scope | ✅ (rejection explicitly preserved) |

## 8. Meetingräume

| Forged decision | PRD coverage | Status |
|---|---|---|
| Nur ganze Räume buchbar, halbstundenbasiert | FR-6, FR-7 | ✅ |
| Keine Warteliste — Slot belegt oder frei | FR-8, §4.2 Out of Scope, §9 Non-Goals | ✅ |

## 9. Label-System

| Forged decision | PRD coverage | Status |
|---|---|---|
| FM vergibt Labels | FR-23 | ✅ |
| Gute Vorschlagstechnik beim Anlegen (Dubletten vermeiden) | FR-24 | ✅ |
| Bereits entstandene Dubletten manuell korrigierbar/zusammenführbar | FR-25 | ✅ |

## 10. Offen / nicht in Forge-Session behandelt

| Forged open item | PRD handling | Status |
|---|---|---|
| Benachrichtigungskanal (E-Mail-System?) | Resolved architecturally in addendum.md (event-driven, pluggable subscribers); still listed as concrete Open Question #6 in prd.md §12 — consistent handling | ✅ |
| Meetingraum-Ausstattung-Label-Details | Generic Label mechanism (FR-23) applies to Räume incl. Meetingräume; no meeting-room-specific detail added, but this was explicitly deferred in forged-idea itself, not a hardened decision | ✅ (appropriately still open) |
| Architektur/Technologie-Details (bewusst auf später verschoben) | addendum.md covers most (IDM/IAM, EventGrid, OTEL, Deployment) — **except** the chat/AI stack, see §4 gap above | ⚠️ (see gap above) |

## Summary

Of the 13 hardened decision areas in forged-idea.md, 12 are faithfully and often near-verbatim represented across prd.md and addendum.md, including every explicitly "Verworfen" (rejected) alternative, which are all correctly preserved as Non-Goals/Out-of-Scope rather than silently vanishing.

**One clear gap:**
- The Chat-Buchung/KI section's specific technology decisions — **A2UI + AG-UI + CopilotKit** (frontend) and **Google Agent ADK** (backend, encapsulated agent logic) — do not appear anywhere in prd.md or addendum.md. The product-level requirement they were meant to satisfy (generative/interactive chat UI, FR-31) survived, but the concrete hardened tech-stack decision itself was dropped.

**One drift worth flagging (not sourced from forged-idea):**
- FR-21's opt-in real-name disclosure is a PRD addition with no origin in forged-idea.md, and it softens the otherwise hardened "pseudonym-by-default, no automatic name resolution" stance. Likely intentional and reasonable, but should be confirmed with the PM/stakeholder rather than assumed.
