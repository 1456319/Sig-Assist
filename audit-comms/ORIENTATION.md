# Project orientation and audit baseline

Prepared by ChatGPT on 2026-11-28. This is an orientation, not a completed audit or clinical validation. It combines prior project context with public repository handoffs and directly checked GitHub metadata. The exact shared conversation was not retrieved in its entirety; public source and documented workstation evidence are used for verifiable claims. No private sources or links are reproduced here.

## 1. Purpose and trajectory

Sig-Assist is evolving from a deterministic prescription SIG translator into a technician-supervised pharmacy workflow assistance and automation platform for FrameworkLTC and DocuTrack, with read-only Iguana intake.

Long-term-care pharmacy staff receive electronic orders whose free-text directions must be transformed into site-specific, printable and clinically faithful instructions, then reviewed by a pharmacist. Sig-Assist aims to reduce repetitive transcription, lookup, navigation and entry while keeping clinical decisions with qualified humans.

Primary objectives:

- Translate instructions into pharmacy-specific SIG conventions without losing or changing dose, route, frequency, conditions, durations, hold parameters or other clinically meaningful details.
- Detect and retrieve the active electronic prescription (E-Rx), match the correct order, and prepare reviewed entry.
- Eventually assist with site-specific dates, quantities, administration times and batch-aware workflows, with explicit verification.
- Process eligible non-controlled E-DC orders with technician confirmation, including the linked Framework refusal and DocuTrack disposition only when identity and success can be reliably established.
- Observe normal technician workflow and learn from optional feedback and discrepancies, without interfering with work.
- Collect 10,000–50,000+ SIG observations over time, with genuinely confirmed source-to-final examples for quality evaluation.
- Later extend to refill and end-to-end E-Rx processing, not ahead of proven foundations.

Constraints: no admin privileges; portable Windows/Citrix deployment; local-first operation; no required external database for the local queue; read-only Iguana; FWDirect excluded; technician should not need to administer infrastructure. Do not silently reintroduce external runtime services. Preserve human review and distinguish product/clinical judgment from mechanical assistance.

## 2. Verified baseline

| Item | State |
| --- | --- |
| Source branch | prototype |
| Pinned SHA | `04ef96d1c65fde8d055b6d03787ff2ef3038382a` |
| Prototype version | v0.1.20 |
| Packaged build | `c8940f3cf7c9062ca049b6f0c8555b7f53c31853f28914554698daea4243cd7c` |
| Reported local tests | 1,500 tests in 109 files (reported in replay handoff; not independently rerun by ChatGPT) |
| Latest MVP CI | Windows verification, Ubuntu verification and prototype publication succeeded |

Sources: [pinned commit](https://github.com/1456319/Sig-Assist/commit/04ef96d1c65fde8d055b6d03787ff2ef3038382a), [CI run](https://github.com/1456319/Sig-Assist/actions/runs/46111031971), [package manifest](../windows-demo/BUILD.json), [package.json](../package.json), [replay report](../docs/research/SIG-BATCH-REPLAY-244-397.md).

ChatGPT independently checked HEAD, package metadata, recent commit history and actual CI job conclusions. The latest source-baseline commit records live workstation findings; it is not a new runtime build. Green CI is not evidence of live clinical correctness. Documentation may describe older MVP stages; reconcile dates and the actual source before treating older plans as current.

## 3. Conceptual architecture

```text
Facility / eMAR --> Iguana (read-only) --> electronic order intake
                                               |
DocuTrack --> E-DC reader / matching --------> Sig-Assist
                                               |
                    deterministic SIG engine + review queue / workbench
                                               |
           local dataset <--- observations / feedback ---> FrameworkLTC
                                                      technician-reviewed entry
```

This is a conceptual information-flow diagram, not a claim that all write paths exist. The implementation primarily consists of React/TypeScript, a deterministic SIG engine, local Node.js connector, Windows accessibility helpers (UI Automation / WinEvent), and local persistence including IndexedDB. The portable browser build accommodates deployment restrictions. The native observer and active desktop assistance are separate; passive observation must not navigate or write orders.

Read [README](../README.md), [architecture](../docs/ARCHITECTURE.md), [Framework desktop](../docs/FRAMEWORK-DESKTOP.md), [Iguana connector](../docs/IGUANA-CONNECTOR.md), [automatic observation implementation](../docs/IMPLEMENTATION-2026-11-26.md) and [DocuTrack E-DC pilot](../docs/DOCUTRACK-EDC.md). Some older architectural documents describe plans rather than deployed behavior.

## 4. Principal engineering bottleneck: reliable Framework observation and identity

The latest real workstation session, documented in [Session 3 review](../docs/research/SESSION-3-REVIEW-2026-11-28.md), used v0.1.20. Start and stop automatic recording succeeded. The local journal had a contiguous sequence and no reported file failure, overflow or limit.

| Recorded measure | Result |
| --- | ---: |
| Local workflow journal records | 300 |
| Translation records | 157 |
| Native observations | 49 |
| Nonempty field-bearing snapshots | 4 |
| Native observations without nonempty fields | 18 |
| Read failure records | 27 |
| READ_LIMIT / BUSY / ORDER_CHANGED | 22 / 4 / 1 |
| Native button invocation events | 0 |

Only the overlapping interval is appropriate for PSR/native coverage comparisons: 119 PSR records, 88 Framework actions. The four field-bearing snapshots were Directions views and unpaired. Prescription-entry quantity, dates, delivery, days supply, administration times and current draft SIG were not observed. One queue snapshot had a PON. Four explicit Detect open E-Rx operations returned a candidate and lookup success, but passive association remains a separate problem. At least two overlapping PSR actions identified Done; no corresponding native button event was recorded.

Compared with Session 2 (no field-bearing native snapshots), Directions coverage improved; prescription-entry coverage and event delivery remain unverified. A Done event, PON match, or queue return does not establish that the intended prescription saved successfully.

Proposed next technical investigation: instrument bounded read stages (scope discovery, editor enumeration, field read, identity verification), reproduce mixed-host and owned-dialog UIA Invoke delivery on synthetic Windows fixtures, then compare a full dummy E-Rx journey with PSR. Preserve ambiguity, changed-order, and technician-request priority safeguards. Distinguish action intent from independently verified outcome.

Workflow nuances documented in Session 3:
- Therapeutic interchange may introduce placeholder directions; dose equivalence and product selection require human review. Preserve applicable annotation.
- Facility administration-time codes are context-dependent, not generic clock conversions.
- Changing dispensed date can shift start date; verify all resulting fields after applying ordered dates.
- The post-save prescription association prompt has a specific demonstrated technician decision; do not generalize to other prompts.
- Regular PM and Paxit sweeper calculations are distinct. Clarify scope of regular PM behavior before automation; do not infer universal quantity/date rules from one example.

## 5. SIG engine and dataset

The deterministic engine and local collector are important independent workstreams. Dataset stages distinguish original source, generated/presented suggestion, passive Framework observations, and technician-confirmed final instructions. PON alone does not prove a matched source. A copy or field transfer is not proof of a saved prescription. Local collection is not automatic deidentification.

The [corrected batch replay](../docs/research/SIG-BATCH-REPLAY-244-397.md) reported:

| Measure | Result |
| --- | ---: |
| Source observations translated | 154 / 154 |
| Nonempty printable cards | 160 |
| Distinct directions | 137 |
| Distinct drug/directions pairs | 142 |
| New pairs relative to preceding batch | 8 |
| Observations with potential error or unresolved gap | 23 |
| Unflagged observations | 131 |
| Parser exceptions | 0 |
| Eligible whole-order technician-confirmed accepted answers | 0 |

The combined replay contained 357 observations without duplicate observation records; repeated captures across builds are not necessarily new independent SIGs. Two daily-treatment observations changed following a targeted parser fix. A separate report checked eight ordered dose/range triples across two scales and routine dose/route/schedule fields in 62 oral-solid observations; these narrow checks are not an overall clinical accuracy estimate.

Translation coverage is not accuracy. An unflagged result may still be wrong. Audit preservation of conditional qualifiers, indications, dosage units, durations, route, treatment site, sequential phases, PRN transitions, hold rules and numeric boundaries. Prioritize sliding scales, treatments and other known difficult categories (including Miralax). Verify length handling against the site's actual expanded 199-character budget, not simply typed length.

Evaluation should separate source-only replay, unpaired observations, known expected outputs, and confirmed accepted pairs. Avoid train/test leakage from repeated observations and policy snapshots. Require held-out examples, negative controls, reproducible reports and explicit unknowns. See [dataset design](../docs/SIG-DATASET.md), [sliding scale handoff](../docs/SLIDING-SCALE-HANDOFF-2026-11-19.md), and [November 27 audit](../docs/research/LOVABLE-AUDIT-2026-11-27.md).

## 6. Current maturity (orientation, not final verdict)

| Capability | State |
| --- | --- |
| Standalone SIG translation | Functional, undergoing refinement |
| Read-only Iguana intake | Implemented; site reliability remains a verification topic |
| Detect open E-Rx | Demonstrated; reliability and identity remain under review |
| Discrepancy reports / optional ratings | Implemented; durability repeatedly hardened |
| SIG dataset collection | Implemented; accepted-answer evidence is sparse in the latest batch |
| Automatic workflow recording | Partially validated on real workstation |
| Framework native field observation | Incomplete |
| Reviewed field population | Implemented in part; verify actual scope and outcomes |
| DocuTrack E-DC detection | Pilot implementation |
| Automated E-DC disposition | Not fully implemented or validated; documented pilot uses technician actions |
| End-to-end E-Rx automation | Long-term objective |
| Automated refill processing | Future objective |

For E-DC, exact order identity, leading zeros/suffixes, facility/resident/medication match, pending status, eligibility, source document number and successful outcomes are critical. Empty, filtered, incomplete or ambiguous views cannot clear a request. Use manual procedures for controlled and already-processed orders. See [E-DC pilot](../docs/DOCUTRACK-EDC.md) and [disposition pilot](../docs/EDC-DISPOSITION-PILOT.md).

## 7. Proposed audit priority

These are ChatGPT's preliminary investigation priorities, not confirmed defect findings or an agreed scope. ChatGPT, Neon and Kimi must brainstorm and explicitly approve the same versioned focus proposal before formal workstream assignment. See README.md.

| Priority | Workstream |
| --- | --- |
| P0 | Wrong-order / stale-context / incorrect-identity risks |
| P0 | Silent loss or alteration of clinically meaningful instructions |
| P1 | Native observer budget, event failures and prescription-entry coverage |
| P1 | Dataset provenance, pairing, durability and accepted-answer quality |
| P1 | Site-specific dates, quantities, batches and administration rules |
| P1 | DocuTrack / Framework disposition, retry safety and completion verification |
| P2 | Discrepancy report persistence, recording controls and recovery |
| P2 | Test adequacy, dependency and architectural debt, package consistency |

Preliminary dependency lead: package.json contains a Supabase dependency and the tree contains a supabase directory. That is not proof of runtime usage or a defect. Trace actual imports, runtime initialization and portable behavior before deciding whether anything conflicts with local-first/no-required-external-database operation.

## 8. Audit methodology and previous work

The repository contains extensive previous Lovable audits, regression suites, installer-derived investigations and handoffs. Read them to prevent repeating already-resolved work; independently reproduce supported failures at the pinned baseline rather than blindly reapplying old patches.

Compare four layers: intended workflow; actual implementation; what automated tests establish; what real workstation evidence establishes. CI success, a passing synthetic fixture, a reported capture, and an independently verified live outcome are distinct evidence levels. Treat historical regressions as leads until reproduced.

Check [AGENTS.md](../AGENTS.md) for repository preservation and packaging policy, but the current authorization is for audit coordination only, not implementation. Keep the existing HIGH temporary logging-removal markers and private configuration boundaries. Do not publish private records or source details beyond existing public material.

ChatGPT is ready for the three-way brainstorming phase after Neon and Kimi establish their handshakes. Both should propose independent priorities and challenge this orientation. The three-party consensus rules in README.md govern focus, findings and remediation. No full code audit or independent suite execution is claimed by this document.
