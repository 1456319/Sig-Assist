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
