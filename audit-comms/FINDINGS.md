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
| Focus areas | Not yet drafted | Pending | Pending | Pending | Not established |

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
**Status:** proposed.

| Priority | Scope | Evidence to produce |
| --- | --- | --- |
| P0 | Correct order and state across detection, reviewed desktop field entry, E-DC gating, and retry/outcome attribution. Include explicit controlled-substance exclusion, ambiguous or failed lookups, and post-write verification of dependent fields. | Trace each active path to its guard and outcome. Exercise synthetic changed-order, ambiguous, partial and retry controls. Reproduce dependent-field resets with a safe Windows fixture. |
| P0 | SIG semantic fidelity and expanded 199-character handling. Prioritize sliding scales, treatments, clinical conditions, units/routes, PRN and hold logic, duration and sequential phases. | Independently written synthetic expected cases, negative controls and boundary checks. Report source-only replay coverage separately from accepted-answer evaluation. |
| P1 | Native observer read budget, event delivery and outcome evidence. | Trace budget and provider boundaries. Use synthetic Windows mixed-host and owned-dialog checks before validating end-to-end pairing with a dummy order. Keep action observation and save verification distinct. |
| P1 | Dataset provenance, replay, recapture, migration, and durability. | Inspect and test offline provenance in parallel. Reserve whole-order live pairing conclusions for valid identity and capture evidence. |
| P2 | Quick boot-path, dependency and packaging checks. | Trace imports before classifying a runtime dependency. Check portable ZIP and build identity as part of any approved release. |

The alternate sequence of fixing observer coverage before all other work would delay independent SIG and active-path checks. Restrict the observer dependency to live pairing. Keep scope on the pinned prototype, use synthetic controls, and reserve actual pharmacy actions for the technician. Track unavailable Windows evidence explicitly. Findings should carry immutable source references and separate static claims from executed checks. Each proposed remedy, actual diff, and release has its own review. This proposal approves scope only.

FOCUS-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | C | APPROVE | 2026-11-28T08:51:38Z | Separates immediate order and SIG risks from live observer dependencies, and makes replay evidence limits explicit. See MSG-C-008.
