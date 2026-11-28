=== FINDINGS.md ===
# Joint findings and remediation register

No confirmed joint findings recorded yet. The orientation identifies investigation priorities, not established defects.

## Finding format

C-001 / N-001 / K-001 | title | P0/P1/P2/P3 | confirmed/probable/hypothesis | pinned SHA | status

- Source: immutable GitHub path and line range.
- Expected behavior and source of requirement.
- Observed behavior and actual evidence.
- Reproduction steps or synthetic test; environment, command and outcome. Label unrun tests.
- Impact and scope; confidence and remaining uncertainty.
- Proposed minimal correction and regression/acceptance criteria.
- Independent assessments: C / N / K, each with reasoning, evidence and limitations.
- Consensus references: focus proposal ID/revision, issue-confirmation ID/revision, remedy ID/revision, and post-change review ID/revision.
- Status: open / verified / rejected / duplicate / accepted for remediation / deferred.

Severity: P0 credible risk of incorrect medication/order action, serious data loss or critical unsafe behavior; P1 major functionality failure or high regression risk; P2 limited defect or coverage gap; P3 low-impact maintainability. Avoid classifying audit leads as confirmed defects. Do not reproduce private source material.

## Consensus decision register

Use stable IDs (FOCUS-001, ISSUE-C-001, FIX-C-001, VERIFY-C-001) with revision numbers. Every formal decision must identify the pinned SHA, exact proposal text, discussion references, alternatives, evidence, acceptance criteria, risks and remaining uncertainty. For remedy proposals also include affected paths, designated implementer and rollback plan.

Vote format: proposal ID@revision | baseline SHA | auditor C/N/K | APPROVE / REVISE / OBJECT / NEEDS_EVIDENCE | UTC timestamp | independent reasoning and evidence reference.

All three votes must be APPROVE on the same proposal revision and baseline after brainstorming. Missing votes are PENDING. A material change resets the votes. Retain old votes as history; never edit another auditor's vote. Two approvals do not establish consensus.

| Proposal | Revision | ChatGPT | Neon | Kimi | Consensus |
| --- | --- | --- | --- | --- | --- |
| FOCUS-001 | r1 (`04ef96d1`) | APPROVE (08:51Z) | APPROVE (08:55Z) | APPROVE (09:12Z) | Established (3/3 APPROVE) |

Do not mark a finding jointly confirmed or a remedy accepted until the appropriate gate is unanimous. Standing user authorization covers routine, reversible implementation on prototype once the remedy is unanimously approved. Separate explicit user authorization is required only for matters outside the delegation in README.md.

## ChatGPT findings

Awaiting audit.

## Neon findings

Awaiting audit.

## Kimi findings

Awaiting handshake and audit.

## Joint remediation queue

Priority | finding IDs | fix proposal ID/revision | C/N/K approvals | regression and acceptance criteria | owner | dependencies | authorization basis (standing / explicit / outside scope) | post-change verification.

No specific remedy has yet reached consensus. Standing authorization applies only after all required gates; no release recommendation yet.

## FOCUS-001@r1 — prototype functionality and evidence

**Baseline:** `04ef96d1c65fde8d055b6d03787ff2ef3038382a` (v0.1.20).
**Discussion:** MSG-K-001, MSG-N-001, MSG-N-002, MSG-C-008.
**Status:** approved (3/3 consensus).

| Priority | Scope | Evidence to produce |
| --- | --- | --- |
| P0 | Correct order and state across detection, reviewed desktop field entry, E-DC gating, and retry/outcome attribution. Include explicit controlled-substance exclusion, ambiguous or failed lookups, and post-write verification of dependent fields. | Trace each active path to its guard and outcome. Exercise synthetic changed-order, ambiguous, partial and retry controls. Reproduce dependent-field resets with a safe Windows fixture. |
| P0 | SIG semantic fidelity and expanded 199-character handling. Prioritize sliding scales, treatments, clinical conditions, units/routes, PRN and hold logic, duration and sequential phases. | Independently written synthetic expected cases, negative controls and boundary checks. Report source-only replay coverage separately from accepted-answer evaluation. |
| P1 | Native observer read budget, event delivery and outcome evidence. | Trace budget and provider boundaries. Use synthetic Windows mixed-host and owned-dialog checks before validating end-to-end pairing with a dummy order. Keep action observation and save verification distinct. |
| P1 | Dataset provenance, replay, recapture, migration, and durability. | Inspect and test offline provenance in parallel. Reserve whole-order live pairing conclusions for valid identity and capture evidence. |
| P2 | Quick boot-path, dependency and packaging checks. | Trace imports before classifying a runtime dependency. Check portable ZIP and build identity as part of any approved release. |

The alternate sequence of fixing observer coverage before all other work would delay independent SIG and active-path checks. Restrict the observer dependency to live pairing. Keep scope on the pinned prototype, use synthetic controls, and reserve actual pharmacy actions for the technician. Track unavailable Windows evidence explicitly. Findings should carry immutable source references and separate static claims from executed checks. Each proposed remedy, actual diff, and release has its own review. This proposal approves scope only.

FOCUS-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | C | APPROVE | 2026-11-28T08:51:38Z | Separates immediate order and SIG risks from live observer dependencies, and makes replay evidence limits explicit. See MSG-C-008.

FOCUS-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | N | APPROVE | 2026-11-28T08:55:00Z | Incorporates P0 elevation for active UI post-write verification and E-DC controlled-substance/fail-closed gating, isolates SIG 199-char and semantic fidelity from replay limits, sequences P1 observer synthetic tests ahead of live pairing, and keeps P2 Supabase/boot checks time-boxed. Vote based on coordinator summary of baa01d8a9551194b70723c73b4d0a1d9a53193f0 (tool call quota exhausted this turn). See MSG-N-003.

FOCUS-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | K | APPROVE | 2026-11-28T09:12:15Z | K's vote recorded; 3/3 APPROVE on revision r1 and baseline 04ef96d1c65fde8d055b6d03787ff2ef3038382a. See MSG-K-002.

## Kimi findings

### K-001 | Observer output lacks order-identity attribution (probable) | P0 | probable | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | open — narrowed per C MSG-C-009 (2026-11-28T09:42:26Z); does not block FOCUS-001@r1

- **Source:** `docs/research/SESSION-3-REVIEW-2026-11-28.md`, evidence trace in MSG-C-008 ER-K-001.
- **Expected behavior:** a value captured by the native observer must carry the identity of the order it derives from, so the captured value can be attributed to a specific order.
- **Observed behavior:** native observer saved Directions values without order identity at ~+81s while PSR recorded Next at ~+79s. Four technician-requested detections returned one candidate each and their lookups succeeded, but none of the four field-bearing snapshots carried a PON; one passive queue snapshot had a PON (different from the four). Explicit lookup success therefore cannot attribute any unpaired passive snapshot.
- **Risk:** an observation with no order identity is indistinguishable from a non-attributed value; pairing/confidence and outcome attribution must not rely on it.
- **Independent reasoning (narrowed per C MSG-C-009):** C's Session 3 trace is the source. Independently I trace that the observer's captured record schema has no order-identity field (an observational/serialization gap, not a fix), so the pipeline cannot distinguish "captured but unattributable" from "not captured." Test: inject a synthetic captured frame with an intentionally empty order-identity field; the pipeline must flag it as unattributable, never auto-match it to a PON or a candidate. This static inference is narrower than the confirmed Session 3 observation: the confirmed record is that the field-bearing snapshots in that run lacked a PON and could not be attributed to a specific order. The broader schema-level claim is not yet independently established and is left open pending immutable source-path tracing of the native writer.
- **Limitations (narrowed):** observer schema is my inference from Session 3 records; no local shell to inspect the native writer's schema directly. Static claim; test unrun. Narrowed to the Session 3 field-bearing snapshots per C MSG-C-009; the broader schema-level claim is unverified.
- **Status:** open — narrowed per C MSG-C-009 (2026-11-28T09:42:26Z). Requires immutable source-path tracing of the observer record schema (ER-K-001) and a synthetic negative control (empty/ambiguous order-identity frame; no-capture window) before a finding is confirmed. Does not block FOCUS-001@r1.


### FOCUS-001@r1 resolution (as of 2026-11-28T09:12:15Z)
- C APPROVE (2026-11-28T08:51:38Z) | N APPROVE (2026-11-28T08:55:00Z) | K APPROVE (2026-11-28T09:12:15Z).
- All three auditors APPROVE on the same revision r1 and baseline 04ef96d1c65fde8d055b6d03787ff2ef3038382a. Consensus established.
- Prior "2/3 — waiting on K" cell in the table is historical only. Hydrogen to clear audit-comms/WAITING_ON_K.md and wake N for static P0-1/P0-2 traces.
