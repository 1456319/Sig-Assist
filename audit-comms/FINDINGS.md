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

### N-001 | Active desktop Send allows writes with 0 or multiple PONs and omits post-write PON verification (and lacks E-DC/cancel check) | P0 | candidate | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | open

- **Priority / Workstream:** P0 (`P0-1`)
- **Status:** candidate (raised by `N`, awaiting `C`/`K` review and confirmation vote)
- **Baseline:** `04ef96d1c65fde8d055b6d03787ff2ef3038382a`
- **Source & Observed Evidence:**
  - `windows/FrameworkDesktop.cs` (`Send`, lines 1000–1026) writes `sig`/`times` via `ValuePattern.SetValue(value)` (line 1020). Unlike `FillDraft` (lines 948–999), which requires `ValidPon(pon)`, exact `pon` match, non-empty `patientId`, and a full post-write `BindDraft(Scan(...))` verifying `scopeId`/`pon`/`patientId`/`facilityId`, `Send` only checks `Serialize(current["pons"]) != Serialize(expected["pons"])` (lines 1015–1016). Because `Detect` does not fail when `pons` is empty (`[]`) or contains multiple PONs (setting `pon = null` and warning), `Send` can proceed with 0 or multiple PONs (`[] == []` passes) and never validates `ValidPon(...)` or `patientId`.
  - Post-write, `Send` checks `Read(control.element)` for `after.id == fresh.id && after.value == value` (lines 1021–1023) and calls `Detect(Scan(...))` (line 1024), but never re-verifies that `detected["pons"]` still matches `expected["pons"]`.
  - `src/lib/frameworkDesktop.ts` (`frameworkDesktop`, lines 31–46) is a thin HTTP POST wrapper with no client-side fail-closed gating.
  - No dedicated E-DC/discontinue/cancel gating exists in `windows/FrameworkDesktop.cs` or `src/lib/frameworkDesktop.ts`; cancellation guards exist only in `src/lib/orderQueue.ts` (`saveOrder` line 57; `cancelOrder` lines 80–83) and `src/lib/frameworkSigDataset.ts` (`findDatasetSource` line 37).
- **Impact:** Active SIG/times write can land on an unverified, ambiguous, or mid-write-switched Framework order, violating fail-closed order-identity boundaries.
- **Independent assessments:** `N`: static trace complete (pending check of UI callers of `frameworkDesktop('send', ...)`); `C`: Pending; `K`: Pending.

### N-002 | 199-character SIG concessions and over-limit flags do not gate copy/send, and non-sliding-scale paths check raw length only | P0 | candidate | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | open

- **Priority / Workstream:** P0 (`P0-2`)
- **Status:** candidate (raised by `N`, awaiting `C`/`K` review and confirmation vote)
- **Baseline:** `04ef96d1c65fde8d055b6d03787ff2ef3038382a`
- **Source & Observed Evidence:**
  - `src/lib/clinical/slidingScaleBudget.ts` (`fitSlidingScaleBudget`, lines 47–67; `scaleBudgetFindings`, lines 69–81) enforces `SCALE_SIG_LIMIT = 199` on `Math.max(rawLength, estimatedExpandedLength)` via progressive concessions (diagnosis omission via `omitDiagnosis`, `literal_ss`, `literal_cbs`), emitting `sliding_scale_concessions` (`tier: 'applied_correction'`) and `sliding_scale_budget_exceeded` (`tier: 'uncorrected_gap'`). Called from `src/lib/clinical/frequencyEngine.ts` (lines 72–73, 101–102) and `src/lib/clinical/clinicalEngine.ts` (lines 480–487).
  - For non-sliding-scale SIGs, `src/lib/sigEngine.ts` (lines 104–173) and `src/lib/clinical/outputCodePolicy.ts` (lines 43–152) enforce no 199-char limit/truncation/split; `src/lib/clinical/clinicalEngine.ts` (lines 467–468) emits `sig_length_review` (`tier: 'uncorrected_gap'`) when `!scale && policy.sig.length > 199` (raw length only, not estimated expanded length).
  - `src/lib/reviewPolicy.ts` (`copyBlockReason`, lines 32–39) only blocks copy/send on `unavailable`, empty `finalSig`, `rejectedOutputMatches`, `excludedMatches`, or stale `reviewStamp`. It does not check `sliding_scale_concessions`, `sliding_scale_budget_exceeded`, or `sig_length_review`.
- **Impact:** Over-199-char SIGs (including non-sliding-scale SIGs whose Framework expansion exceeds 199 chars) and concession-altered sliding-scale SIGs (with omitted diagnosis or suppressed SS/CBS expansions) can be approved and copied/sent without a hard gate or explicit concession acknowledgment.
- **Independent assessments:** `N`: static trace complete; `C`: Pending; `K`: Pending.

### N-003 | Observer dataset ingestion hardcodes `sourceMatch: 'unpaired'` and embeds per-frame IDs that defeat cross-frame deduplication | P1 | candidate | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | open

- **Priority / Workstream:** P1 (`P1-2`)
- **Status:** candidate (raised by `N`, awaiting `C`/`K` review and confirmation vote)
- **Baseline:** `04ef96d1c65fde8d055b6d03787ff2ef3038382a`
- **Source & Observed Evidence:**
  - `src/lib/sigDataset.ts` properly HMAC-hashes `orderKey` → `orderId` and `partId` → `sampleId` with a per-DB salt (lines 237–241), hashes exclusions → `exclusionPolicyId` (line 240), strips raw `orderKey`/`partId`/`exclusions` in `clinicalFields` (lines 79–106), and enforces their absence in `validRecord` (lines 118–137).
  - However, `src/lib/workflowObservation.ts` (`workflowFrameSamples`, lines 25–37) hardcodes `sourceMatch: 'unpaired'` (line 34) even when `frame.pon` is present, making PON-observed frames indistinguishable from truly unpaired frames via `sourceMatch` once `orderKey` is hashed.
  - `src/components/AutomaticObservationSamples.tsx` (lines 7–35) polls every 1500 ms and passes `workflowFrameSamples(frame)` into `queueSigSample` (`src/lib/sigDatasetCapture.ts`, lines 43–52) and `sigDatasetStore.record` (`src/lib/sigDataset.ts`, lines 230–263). Because `partId` (`${frame.id}:${role}`) and `observation` (`frame: frame.id`, `observedAt`) change on every frame, `dedupKey` (`sigDataset.ts:244`) only prevents exact `(frame.id, role)` replays—identical SIG text re-observed across different frames produces duplicate dataset rows.
  - Combined with `K-001`, unpaired frames in a session all collapse onto one hashed `orderId` (`observer:${frame.sessionId}:unpaired`), conflating distinct orders under a single `orderId`.
- **Impact:** Biases dataset counts/evaluation metrics via cross-frame duplicates and conflated unpaired `orderId` buckets while obscuring whether an observer frame actually carried a PON.
- **Independent assessments:** `N`: static trace complete; `C`: Pending; `K`: Pending.

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

### K vote on K-001 (2026-11-28T10:10:00Z)
K CONFIRM on K-001 (baseline 04ef96d1c65fde8d055b6d03787ff2ef3038382a, v0.1.20), citing Neon's immutable source-path trace (MSG-N-004 §1) and the synthetic negative control Neon proposed (MSG-N-004 §2). Neon's trace of `src/lib/workflowObservation.ts` (`workflowFrameSamples`, lines 25-37) shows `orderKey` = `observer:${sessionId}:${pon || 'unpaired'}` with `sourceMatch: 'unpaired'`; any Directions frame without an inline/labeled PON collapses into the shared `observer:<sessionId>:unpaired` bucket. This confirms the narrowed K-001 claim that the Session 3 field-bearing snapshots lacked a PON and could not be attributed to a specific order. The broader schema-level assertion is confirmed for the `workflowFrameSamples` path by the trace; the native writer's Direction-capture code remains the specific verified locus.

### K-002 | Synthetic negative control for K-001 (concept verified) | P0 | verified (concept) | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | open - execution pending shell/CI

- **Source:** Neon's proposal in MSG-N-004 §2; `src/lib/workflowObservation.ts` (`workflowFrameSamples`, lines 25-37); `windows/FrameworkDesktop.cs` (`WorkflowSnapshot`, lines 1676-1809).
- **Description:** Pass two distinct `WorkflowFrame` payloads (`kind: 'fields_changed'`, `view: 'directions'`, `pon: null`, different fields) under the same `sessionId` into `workflowFrameSamples`; verify collision on `observer:<sessionId>:unpaired` with `sourceMatch: 'unpaired'`. Plus a fixture verifying `WorkflowSnapshot` emits `pon = null` when `DirectionsView` lacks `PonLabel`/`PonInline`/`ERxGrid`, or `DatasetPons` throws.
- **Expected behavior:** An empty/ambiguous order-identity frame must be surfaced as an attribution failure and never silently auto-matched to a PON or candidate.
- **Independent assessment (K):** The negative control is a necessary and sufficient control for K-001: it proves the pipeline does not auto-match an empty/ambiguous identity frame. Concept verified by K against Neon's trace. Execution unrun - requires a shell/CI run; label unrun until executed.
- **Status:** open - execution and shell/CI run pending.

### K-003 | Observer read budget, Done-event delivery, and 199-char SIG budget | P1 | probable (static claim; unrun) | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | open

- **Source:** Neon's additional findings, MSG-N-004 §3: `windows/FrameworkDesktop.cs` (`WorkflowSnapshot` lines 1688-1779; `DatasetSnapshot` lines 1352-1406; `WatchEvents` lines 1810-1907); `src/lib/clinical/slidingScaleBudget.ts` (`fitSlidingScaleBudget`, lines 47-67; `SCALE_SIG_LIMIT = 199` line 4).
- **Description:** (P1-1) `WorkflowSnapshot`/`DatasetSnapshot` enforce a 3,000 ms / 640-node / 24-depth / 32-candidate cap returning `DatasetFailure("READ_LIMIT", true)`, matching the 22 READ_LIMIT failures in Session 3. `WatchEvents` captures `Done` only via `InvokePattern.InvokedEvent` with trimmed `Name` matching `^(?:Save|Done|...)$` (lines 1839-1842), a plausible cause of 0 native Done events despite PSR clicks. (P0-2) `fitSlidingScaleBudget` enforces the 199-char budget and ordered concessions.
- **Independent assessment (K):** Sound leads requiring synthetic mixed-host/owned-dialog/Invoke tests (Neon/C/K tracks) and adversarial synthetic SIG pairs around the expanded 199-char path. Static claims only; tests unrun.
- **Status:** open - verification via synthetic Windows fixtures (Neon/C/K tracks) and adversarial synthetic SIG pairs.
## Kimi independent assessments of Neon's candidate findings (MSG-N-005)

K independent assessment — N-001 (P0-1, Active desktop Send & E-DC gating)
- Verification: confirmed against pinned baseline 04ef96d1c65fde8d055b6d03787ff2ef3038382a (fetched windows/FrameworkDesktop.cs). `FillDraft` is strictly fail-closed; `Send` compares `Serialize(current["pons"]) != Serialize(expected["pons"])` and performs a post-write read-back, but does not validate `ValidPon`/`patientId` and does not re-verify the post-write `detected["pons"]` against `expected["pons"]`; empty or multiple PONs pass the change check (`[] == []` treated as equal) and `Detect` does not fail on 0/multiple PONs.
- Independent reasoning: Neon's static trace is consistent and reproducible from the pinned source. The C# `Send` PON-change check is not fail-closed for 0/multiple PONs. Frontend `FrameworkDesktop.tsx` mitigates via the `matched` checkbox (and time-approval for times) but renders "Sending remains available" for 0/multiple PONs, so it is advisory, not a hard block. The backend `Send` is the fail-closed locus.
- Evidence: `windows/FrameworkDesktop.cs` `Send` (~lines 1016/1020/1024), `FillDraft` (~lines 948-999), pinned baseline.
- Status: K assessment confirms the candidate. Awaiting C/K confirmation vote before remedy.

K independent assessment — N-002 (P0-2, 199-char SIG paths & copy/send gating)
- Verification: confirmed against pinned baseline. `fitSlidingScaleBudget`/`scaleBudgetFindings` enforce `SCALE_SIG_LIMIT = 199` via ordered concessions; `clinicalEngine.ts` emits `sig_length_review` on raw `policy.sig.length > 199` only; non-sliding-scale paths (`sigEngine.ts`, `outputCodePolicy.ts`) impose no truncation/split; `reviewPolicy.copyBlockReason` blocks copy/send only on `unavailable`, `rejectedOutputMatches`, `excludedMatches`, stale `reviewStamp` and does not check `sliding_scale_concessions`, `sliding_scale_budget_exceeded`, or `sig_length_review`.
- Independent reasoning: the concession engine emits informational findings (`sliding_scale_concessions`, `sliding_scale_budget_exceeded`) that are not wired into any approval/copy/send gate, so an over-199-char SIG (or a concession-stripped sliding-scale SIG) can be approved, copied, and sent without a hard gate. `sig_length_review` uses raw length only, not estimated expanded length. Confirmed.
- Evidence: `slidingScaleBudget.ts` (SCALE_SIG_LIMIT line 4), `clinicalEngine.ts` (467, 482-483), `reviewPolicy.ts` (32-39), pinned baseline.
- Status: K assessment confirms the candidate. Recommend a remedy gate on `sliding_scale_concessions`, `sliding_scale_budget_exceeded`, and `sig_length_review`.

K independent assessment — N-003 (P1-2, dataset provenance & cross-frame dedup)
- Verification: confirmed against pinned baseline. `workflowFrameSamples` (`workflowObservation.ts`:26-37) embeds `partId: ${frame.id}:${role}` and `observation: {sessionId, frame: frame.id, observedAt, sigMode, fields}` which change on every frame, so `dedupKey` (`sigDataset.ts`:244) only deduplicates exact `(frame.id, role)` replays; combined with K-001 (`orderKey: observer:${sessionId}:${pon || 'unpaired'}`, `sourceMatch: 'unpaired'`) the cross-frame duplicate bias is real and biases counts/evaluation metrics.
- Independent reasoning: repeated identical SIG observations across different frames produce duplicate dataset rows, and unpaired frames collapse onto one `orderId`, conflating distinct orders. This biases cross-frame aggregation. Confirmed.
- Evidence: `workflowObservation.ts` (31, 34), `sigDataset.ts` (235-244), `AutomaticObservationSamples.tsx` (~1500 ms poll), pinned baseline.
- Status: K assessment confirms the candidate. Execution requires synthetic frame-replay tests.
