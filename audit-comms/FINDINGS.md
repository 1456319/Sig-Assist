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
- **UI Caller Verification (`04ef96d1c65fde8d055b6d03787ff2ef3038382a`, relayed `2026-11-28T11:19:35Z`):**
  - `src/components/FrameworkDesktop.tsx` (`FrameworkTransfer`, lines 125–187) confirms there is no upstream UI fail-closed guard for single-PON or PON-match before `frameworkDesktop('send', ...)` (line 165). Lines 181–182 render non-blocking `<p role="alert">` warnings for `pons.length > 1` and `pons.length === 1 && pons[0] !== pon`, while `send()` (lines 158–165) and the Send button (line 187) only require the manual `matched` checkbox (line 184), `!blockReason`, and a non-expired `detected.token` + target field. Thus 0 PONs, multiple PONs, or a mismatched PON can all reach `FrameworkDesktop.cs` `Send`.
  - By contrast, `RxEntryTransfer` (`src/components/FrameworkDesktop.tsx`, lines 62–119) requires `entry?.draftReady === true && !!entry.token && entry.pon === pon` (line 68) before `frameworkDesktop('fill', ...)`.
  - `src/components/OrderQueueView.tsx` (lines 340–351) passes `selected.cancelled || !!selected.intakeHold || reviseId === selected.id` into `copyBlockReason` as `blocked` for `<FrameworkTransfer>`, which blocks local queue-cancelled/held orders; `selectedEdc` (line 43) is not passed directly into `blocked` at lines 340–351.
  - `windows/serve.ps1` (lines 50–52) is static-only (`GET`/`HEAD`); the `/connector/desktop/send` backend router was not yet inspected.
- **End-to-End Backend & E-DC Verification (`04ef96d1c65fde8d055b6d03787ff2ef3038382a`, relayed `2026-11-28T11:38:06Z`):**
  - `scripts/iguana-bridge.mjs` (`createBridge`, lines 307–322) routes `POST /connector/desktop/*` with JSON/origin/size checks only and delegates to `desktop(action, body)` in `scripts/framework-desktop.mjs` (lines 224–246).
  - `scripts/framework-desktop.mjs` enforces single-use token expiry (lines 225–227) and `body.approved === true && body.matched === true && body.pon.trim()` (line 228). While `fill` enforces `detected.pon === body.pon` and `detected.draftReady === true` (lines 231–233), `send` (lines 241–246) checks only field presence and value type/length—it never checks `bound.detected.pon === body.pon`, `pons.length === 1`, `ValidPon`, `patientId`, or E-DC/cancellation, and does not forward `body.pon` to `run({ action: 'send', expected: bound.detected, field: body.field, value: body.value })` (line 244). This confirms no layer (UI, HTTP bridge, desktop middleware, or `FrameworkDesktop.cs` `Send`) enforces single-PON or PON-match fail-closed gating on `send`.
  - **E-DC gating gap:** In `src/components/OrderQueueView.tsx`, `selectedEdc` (line 43, via `edcMatch` in `src/lib/docutrackQueue.ts:100–110`) can be truthy while `selected.cancelled` and `selected.intakeHold` are false, yet `selectedEdc` is only rendered in `<EdcWarning />` (line 241) and never wired into `copyBlockReason` (lines 344, 346), `<FrameworkTransfer>` (lines 340–351), or `<RxEntryTransfer>` (`src/components/FrameworkDesktop.tsx:205`). Active orders with a matched DocuTrack E-DC can therefore still be copied, sent, or filled without a fail-closed gate (can be tracked under `N-001` or split into a separate finding during remedy scoping if `C`/`K` prefer).
- **Independent assessments:** `N`: end-to-end 4-layer static trace + E-DC wiring complete; `C`: Confirmed core `Send` identity-gating defect (`MSG-C-010`/`MSG-C-011`, keeping E-DC separate); `K`: Confirmed core `Send` identity-gating defect (`MSG-K-005`/`MSG-K-007`/`K-004`, keeping E-DC separate as `N-001b`).

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

### N vote on K-001 (2026-11-28T11:19:35Z)
N CONFIRM on K-001 (baseline `04ef96d1c65fde8d055b6d03787ff2ef3038382a`, v0.1.20), bringing K-001 to 2/3 CONFIRM alongside K's MSG-K-004 (awaiting C). Immutable source-path trace in MSG-N-004 (`windows/FrameworkDesktop.cs:1676-1809` and `src/lib/workflowObservation.ts:25-37`) and K's K-002 negative control establish the issue on pinned baseline `04ef96d1c65fde8d055b6d03787ff2ef3038382a`. See MSG-N-006.

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

### K-004 | K's confirmation of N-001 and split/assessment of N-002 + N-003 | P0/P1 | confirmed (N-001 core) / revised (N-002) / revise (N-003) | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | open

- **Source:** windows/FrameworkDesktop.cs (Send 1000–1026, FillDraft 948–999); src/components/FrameworkDesktop.tsx (FrameworkTransfer 125–187); src/lib/clinical/slidingScaleBudget.ts (fitSlidingScaleBudget 47–67); src/lib/clinical/clinicalEngine.ts (467–468); src/lib/reviewPolicy.ts (copyBlockReason 32–39); src/lib/workflowObservation.ts (workflowFrameSamples 25–37); src/lib/sigDataset.ts (235–244). Pinned baseline 04ef96d1c65fde8d055b6d03787ff2ef3038382a.
- **C's findings review (MSG-C-010, 2026-11-28T11:22:24Z):** C CONFIRMs K-001 (3/3); CONFIRMs N-001 core; directs N-002 wording split; REVISES/NEEDS_EVIDENCE on N-003 (isolate provenance mislabel from cross-frame sampling policy, supply synthetic replay + metric path).
- **K's assessment:**
  1. K-001 closed (3/3 CONFIRM). Accepts ISSUE-K-001@r1 versioned record.
  2. N-001: K confirms the core fail-closed defect on the exact criterion C set: Send does not validate ValidPon/patientId and does not re-verify detected[] == expected[] after write. K keeps the E-DC gating sub-claim as a separate candidate (N-001b) per C's exact-acceptance-criteria instruction. K votes CONFIRM on the N-001 core.
  3. N-002 split: K agrees with C's split into N-002a (sliding_scale_budget_exceeded uncorrected over-limit not fail-closed) and N-002b (sliding_scale_concessions applied transformation; sig_length_review raw-length only not wired to copyBlockReason). K does not infer blanket hard-block.
  4. N-003: K concurs with REVISE. The provenance mislabel (sourceMatch hardcoded unpaired) is confirmable statically; the cross-frame sampling-policy question is a separate issue needing synthetic replay + metric path.
- **Status:** open — N-001 confirmed (core), N-002 split pending C/N review, N-003 revise pending synthetic replay + metric evidence.

## ISSUE-K-001@r1 — unpaired workflow observations share an order key

**Baseline** `04ef96d1c65fde8d055b6d03787ff2ef3038382a` (v0.1.20).

Directions observations can carry captured field values without a PON. In the passive dataset input, two distinct missing-PON frames within one recorder session share the same session-level order key while retaining distinct part IDs and unpaired status. The shared key is insufficient for attributing observations to one order. The issue does not assert automatic pairing, accepted-answer creation, or that the observer schema lacks support for a PON.

**Evidence** Session 3 aggregate in MSG-C-008 and the Node negative control in MSG-C-011. The native Windows test remains pending. References for prior confirmations are MSG-K-004 and MSG-K-006, MSG-N-006, and MSG-C-010. Hydrogen can reconcile those votes with this exact wording and flag ambiguity. This issue record proposes no runtime change.

ISSUE-K-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | C | APPROVE | 2026-11-28T11:30:31Z | Narrow attribution defect reproduced in the Node control, with native Windows validation still pending. See MSG-C-011.
ISSUE-K-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | N | APPROVE | 2026-11-28T11:41:56Z | Independently verified at 04ef96d1c65fde8d055b6d03787ff2ef3038382a: WorkflowSnapshot (windows/FrameworkDesktop.cs:1766–1789) permits before.Length == 0 and emits pon = null, association = "unpaired", and workflowFrameSamples (src/lib/workflowObservation.ts:31,34) maps missing-PON frames to orderKey observer:${sessionId}:unpaired with distinct partId (${frame.id}:${role}) and sourceMatch: 'unpaired', matching C's Node K-002 reproduction.

## ISSUE-N-001@r1 — direct Framework transfer lacks an exact order-identity gate

**Baseline** `04ef96d1c65fde8d055b6d03787ff2ef3038382a` (v0.1.20). P0.

The reviewed SIG/administration-times Send path lacks a required, exact, unambiguous PON for the selected destination and does not establish that identity after writing. Token expiry, a manual match acknowledgment, stable window/control attributes, and value read-back serve other purposes but leave this gap. This is a source-confirmed finding. It excludes DocuTrack advisory behavior, eligibility decisions and native save results. See MSG-N-005, MSG-N-006, MSG-N-007, MSG-K-005, MSG-K-007, and MSG-C-010.

## FIX-N-001@r1 — require the destination's exact PON for live Send

**Baseline** `04ef96d1c65fde8d055b6d03787ff2ef3038382a`. Issue approval and remedy consensus pending. Proposed implementer C.

- At the connector, require one valid detected PON equal to the intended PON. Pass that same PON to the native Send operation. Preserve the single-use binding, exact text approval, and technician match confirmation.
- At the native helper, scope identity to the selected destination window and order context. Check the exact PON and original target before writing. Re-read the same target and order after writing. If the provider cannot verify the order after a write attempt, show the uncertain outcome and withhold the follow-on token. Never infer success from field text alone. If the reader cannot establish association within the destination, disable direct Send for that case.
- The UI can still identify a destination for inspection. After identifying it, require an exact match before direct Send and explain how to re-detect or enter the reviewed text manually. Keep the manual patient and drug check. Do not change independent clipboard actions, E-DC warnings, or prescription save behavior. Patient-ID automation can be considered separately once the target view exposes a dependable value.
- Paths to inspect or change: `scripts/framework-desktop.mjs`, `windows/FrameworkDesktop.cs`, `src/components/FrameworkDesktop.tsx`, and their existing connector, native smoke and UI tests.
- Acceptance: an exact matching synthetic order and stable destination can still send. Missing, ambiguous, mismatched or incomplete identity blocks direct Send with actionable guidance. A target that changes after the write yields an uncertain result and no success toast or follow-on token. Check a prior valid order when the window contains unrelated scopes. Execute only with synthetic provider/Windows fixtures.
- Alternatives: warning alone retains the verified gap. Requiring a patient ID for every existing view could disable legitimate use when the provider cannot expose it. Exact destination-scoped PON plus human patient/drug confirmation is the narrower first step. Roll back via a focused revert and regenerate the matching portable archive.

## FIX-K-001@r1 — separate unrelated missing-PON observation frames

**Baseline** `04ef96d1c65fde8d055b6d03787ff2ef3038382a`. Proposed remedy to `ISSUE-K-001@r1`. Proposed implementer C.

- For newly collected native workflow frames without a PON, scope the synthetic observation order key to the recorder session and frame ID, using a separate unpaired namespace. Keep all role samples from the same frame together, and keep rereads of the same frame idempotent. Preserve the existing keys for PON-bearing frames and keep `sourceMatch: unpaired` for both paths. A visible PON alone supplies no validated source match.
- Leave historical data in place and use existing observation provenance when interpreting older exports. Do not guess a PON from the previous frame, silently attach a candidate source, mark acceptance, or change what offline replay counts as eligible.
- Paths: `src/lib/workflowObservation.ts` and the existing passive-capture tests. Acceptance: distinct no-PON frame IDs get distinct keys, same-frame roles share one key, replaying the same frame yields the same sample identities, and a native PON equal to a namespace-like synthetic token cannot collide with a no-PON key. Unavailable/button frames still generate no samples. Check dataset export and backward parsing. Rollback is a focused source revert without rewriting stored rows.
- Alternatives: dropping all unpaired data loses workflow evidence. Grouping by time or the last visible PON can conflate orders again. A frame is the smallest unit with a proven relationship among its fields.

ISSUE-N-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | C | APPROVE | 2026-11-28T11:42:30Z | Supports the exact scope and synthetic acceptance conditions above. See MSG-C-012.
FIX-N-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | C | APPROVE | 2026-11-28T11:42:30Z | Supports the exact scope and synthetic acceptance conditions above. See MSG-C-012.
FIX-K-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | C | APPROVE | 2026-11-28T11:42:30Z | Supports the exact scope and synthetic acceptance conditions above. See MSG-C-012.
ISSUE-N-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | N | APPROVE | 2026-11-28T11:50:03Z | Independently confirmed end-to-end across FrameworkDesktop.tsx:125–187, iguana-bridge.mjs:307–322, framework-desktop.mjs:224–246, and FrameworkDesktop.cs:1000–1026; exact r1 wording accurately scopes the direct Send identity-gating gap and excludes DocuTrack advisory behavior, eligibility decisions, and native save results.

ISSUE-N-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | K | APPROVE | 2026-11-28T11:53:00Z | K independently re-verified the four-layer identity trace (FrameworkDesktop.tsx:125–187, iguana-bridge.mjs:307–322, framework-desktop.mjs:224–246, FrameworkDesktop.cs:1000–1026) and confirms the exact r1 wording; the core send identity-gating defect is independently verified and the wording correctly excludes E-DC advisory behavior (N-001b separate). Unrun: native Windows UIA execution of the remedy (ER-K-002). See MSG-K-009.
FIX-N-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | N | APPROVE | 2026-11-28T11:50:03Z | Directly closes all four layers of ISSUE-N-001@r1 while preserving technician review, manual patient/drug checks, clipboard actions, E-DC warnings, and non-automated save behavior. Non-blocking implementation check: ensure FrameworkDesktop.cs Send asserts ValidPon and single-PON equality (not just serialized array equality) both pre- and post-write, and FrameworkDesktop.tsx disables Send whenever pons.length !== 1 || pons[0] !== pon.

FIX-N-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | K | APPROVE | 2026-11-28T11:53:00Z | K's independent assessment confirms FIX-N-001@r1 spans all four layers (connector exact-PON matching/forwarding; destination-scoped pre/post-write native verification with uncertain-outcome handling and withheld follow-on token; UI exact-match gating; synthetic fixtures; clean rollback) without touching E-DC warnings or non-automated save paths. Unrun: Windows UIA execution of the remedy (ER-K-002). See MSG-K-009.
FIX-K-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | N | APPROVE | 2026-11-28T11:50:03Z | Cleanly resolves ISSUE-K-001@r1 by scoping missing-PON keys to (sessionId, frameId) in a collision-free unpaired namespace, preserving same-frame role grouping, replay idempotency, historical exports, and offline replay eligibility without guessing PONs or overclaiming validated sourceMatch.

FIX-K-001@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | K | APPROVE | 2026-11-28T11:53:00Z | K's narrowed K-001 finding supports the remedy: distinct no-PON frame IDs get distinct keys, same-frame roles share one key, replaying the same frame yields the same sample identities, and a native PON cannot collide with a no-PON key; historical data and offline replay eligibility are preserved. Unrun: native Windows capture test (ER-K-002). See MSG-K-009.

FIX-K-001@r1 | 78d2a9b566a79b1e00f5b4b75d202409c6499dd2 | N | VERIFIED_DIFF | 2026-11-28T12:21:12Z | Reviewed src/lib/workflowObservation.ts and tests/workflowSamples.test.ts; matches FIX-K-001@r1 (disjoint observer-unpaired namespace, same-frame role grouping, idempotent replay, literal 'unpaired' PON non-collision, preserved sourceMatch: 'unpaired').
FIX-N-001@r1 | 7dca67e07b3c5f8cdb4dced8a77d87a1f4fe9305 | N | VERIFIED_DIFF | 2026-11-28T12:21:12Z | Reviewed FrameworkDesktop.cs, framework-desktop.mjs, FrameworkDesktop.tsx, and unit/UI/smoke tests; matches FIX-N-001@r1 across destination-scoped PON identity, same-window unrelated order rejection, post-write re-verification with uncertain outcome and withheld follow-on token, and UI exact-match gating (pending green Windows CI runs 46143983496 / 46143983487).

### N-001b (candidate) — matched DocuTrack E-DC (`selectedEdc`) is advisory-only and does not gate copy, `Send`, or `FillDraft`

- **Priority:** P0 (P0-1, split from `N-001` per `C`/`K` request)
- **Status:** candidate (awaiting independent acceptance criteria and confirmation votes)
- **Baseline:** `04ef96d1c65fde8d055b6d03787ff2ef3038382a` (v0.1.20)
- **Evidence:** `src/components/OrderQueueView.tsx` computes `selectedEdc = edcs && selected && edcMatch(edcs.documents, selected, orders)` (line 43, via `src/lib/docutrackQueue.ts:100–110`), which can be truthy while `selected.cancelled` and `selected.intakeHold` are false. `selectedEdc` is used solely to render `<EdcWarning />` (line 241) and is never wired into `copyBlockReason` (lines 344, 346), `<FrameworkTransfer>` (lines 340–351), or `<RxEntryTransfer>` (`src/components/FrameworkDesktop.tsx:205`).
- **Acceptance criteria (for remedy scoping):** Define separately whether unique vs. ambiguous `selectedEdc` matches should hard-block copy/`Send`/`FillDraft` or require explicit technician override/resolution, and define staleness/expiry rules for DocuTrack E-DC snapshots.

## ISSUE-N-002a@r1 — unresolved sliding-scale 199-char over-limit finding does not gate copy or `Send`

**Baseline** `04ef96d1c65fde8d055b6d03787ff2ef3038382a` (v0.1.20).

`fitSlidingScaleBudget` and `scaleBudgetFindings` (`src/lib/clinical/slidingScaleBudget.ts:47–81`, invoked via `frequencyEngine.ts:72–73,101–102` and `clinicalEngine.ts:480–487`) emit `sliding_scale_budget_exceeded` (`tier: 'uncorrected_gap'`) when `Math.max(rawLength, estimatedExpandedLength) > 199` after progressive concessions. `copyBlockReason` (`src/lib/reviewPolicy.ts:32–39`) performs no length or over-limit check, so an unresolved over-limit sliding-scale SIG can be approved and copied/sent. Any downstream remedy must specify how technician-edited output is re-evaluated against the 199-char budget and how stale over-limit warnings clear once edits fit.

ISSUE-N-002a@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | N | APPROVE | 2026-11-28T11:41:56Z | Verified in slidingScaleBudget.ts:47–81, clinicalEngine.ts:480–487, and reviewPolicy.ts:32–39 that sliding_scale_budget_exceeded is displayed without a length gate in copyBlockReason; scoped narrowly with explicit requirement for technician-edit recheck and stale-warning recovery in any remedy.

ISSUE-N-002a@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | K | APPROVE | 2026-11-28T11:53:00Z | K confirms sliding_scale_budget_exceeded (uncorrected over-limit; estimated expanded length > 199) is emitted without a copyBlockReason gate, and sig_length_review only checks raw length for non-scale paths. Agrees with C's requirement that any remedy specify technician-edit recheck and stale-warning clearing. Unrun: synthetic boundary test around the >199-char extended path. See MSG-K-009.

## ISSUE-N-002b@r1 — applied sliding-scale concessions have no dedicated acknowledgment beyond general review stamp

**Baseline** `04ef96d1c65fde8d055b6d03787ff2ef3038382a` (v0.1.20).

`fitSlidingScaleBudget` (`src/lib/clinical/slidingScaleBudget.ts:40–67`) applies ordered concessions (diagnosis omission via `omitDiagnosis`, `literal_ss`, `literal_cbs`) and emits `sliding_scale_concessions` (`tier: 'applied_correction'`, lines 76–77). While existing controls (`reviewStamp` in `src/lib/reviewPolicy.ts:28–30` and general warning display) apply, there is no dedicated concession-acknowledgment gate in `copyBlockReason` (lines 32–39). Kept strictly distinct from unresolved over-limit blocking (`ISSUE-N-002a@r1`) and general non-scale expanded-length checks (`N-002c`).

ISSUE-N-002b@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | N | APPROVE | 2026-11-28T11:41:56Z | Verified in slidingScaleBudget.ts:40–77 and reviewPolicy.ts:28–39 that applied clinical-meaning concessions rely on the general reviewStamp/warning display with no dedicated concession acknowledgment.

ISSUE-N-002b@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | K | APPROVE | 2026-11-28T11:53:00Z | K confirms applied sliding_scale_concessions are a disclosed transformation whose only acknowledgement is the general reviewStamp/warning display, with no dedicated concession-acknowledgment gate; kept distinct from N-002a over-limit blocking. Unrun: remediation that adds explicit concession acknowledgment. See MSG-K-009.

### N-002c (candidate) — non-sliding-scale 199-char warning checks raw length only, not estimated expanded length

- **Priority:** P1 (P0-2, kept distinct from sliding-scale concessions per `C`'s `MSG-C-011`)
- **Status:** candidate
- **Baseline:** `04ef96d1c65fde8d055b6d03787ff2ef3038382a` (v0.1.20)
- **Evidence:** `src/lib/clinical/clinicalEngine.ts` (lines 467–468) checks `!scale && policy.sig.length > 199` (raw code length) to emit `sig_length_review`, whereas `slidingScaleBudget.ts` checks `Math.max(rawLength, estimatedExpandedLength) > 199`. Non-sliding-scale SIGs whose short codes expand past 199 characters in Framework do not trigger `sig_length_review`, and `copyBlockReason` (`src/lib/reviewPolicy.ts:32–39`) does not check `sig_length_review`.

## ISSUE-N-003@r1 — passive observer dataset inputs hardcode `sourceMatch: 'unpaired'` even when a PON is present and conflate missing-PON frames onto one session `orderId`

**Baseline** `04ef96d1c65fde8d055b6d03787ff2ef3038382a` (v0.1.20).

Narrowed per `C`'s `MSG-C-011` to statically verifiable provenance defects only (excluding offline replay count-inflation claims, as the pinned offline replay skips passive Framework observations and restricts distinct-source count to `source_received`):
- `workflowFrameSamples` (`src/lib/workflowObservation.ts:34`) hardcodes `sourceMatch: 'unpaired'` even when `frame.pon` is present; once `sigDatasetStore.record` (`src/lib/sigDataset.ts:238`) HMAC-hashes `orderKey` into `orderId` and strips raw `orderKey`, PON-observed frames cannot be distinguished from unpaired frames via `sourceMatch`.
- When `frame.pon` is missing (`ISSUE-K-001@r1`), all unpaired frames in a session hash to the same synthetic `orderId` (`observer:${frame.sessionId}:unpaired`), conflating distinct orders under one `orderId`.
- Any broader downstream count-inflation claim requires naming a specific consumer of passive observer records and demonstrating its count delta.

ISSUE-N-003@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | N | APPROVE | 2026-11-28T11:41:56Z | Narrowed per C's MSG-C-011 to statically verified provenance defects in workflowObservation.ts:31,34 and sigDataset.ts:238 (hardcoded sourceMatch: 'unpaired' when frame.pon is present, plus session-level orderId conflation on missing-PON frames), dropping unverified offline replay count claims.

ISSUE-N-003@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | K | APPROVE | 2026-11-28T11:53:00Z | K's K-004 assessment confirms the static provenance defects (sourceMatch hardcoded to unpaired even when frame.pon is present; missing-PON frames collapsing onto one session orderId). C/N/K APPROVE on the narrowed static defects; the broader cross-frame sampling-policy question stays separate and nonspeculative pending a synthetic replay and a named downstream metric. Unrun: synthetic replay + metric test. See MSG-K-009.

### N-004 (candidate) — divergent `demo:package` script and statically bundled `@supabase/supabase-js` in portable build

- **Priority:** P2 (low-priority packaging/hygiene; non-blocking for P0 `ISSUE-N-001@r1` / `FIX-N-001@r1` / `FIX-K-001@r1`)
- **Status:** candidate
- **Baseline:** `04ef96d1c65fde8d055b6d03787ff2ef3038382a` (v0.1.20)
- **Evidence:**
  - `package.json:17` (`demo:package`) runs `scripts/package-windows.mjs` (lines 9–18), which writes `windows-demo/app/` and `windows/serve.ps1` without the connector/native scripts (`iguana-bridge.mjs`, `framework-desktop.mjs`, `pilot-journal.mjs`, `framework-observer.mjs`, `FrameworkDesktop.cs`), without creating a `.zip`, and without a `--check` verification gate—diverging from `prototype:package` (`scripts/package-demo.py`, verified by `checks.yml`).
  - `scripts/package-demo.py:19–20` packages `FrameworkDesktop.cs` source rather than a prebuilt `FrameworkDesktop.exe` (built separately in `native-observer.yml`).
  - `@supabase/supabase-js` (`package.json:51`) is statically imported through `src/components/AppLayout.tsx:20–22` → `DictionaryView`/`ExpansionView` → `sigDictionaryService.ts`/`sigExpansionService.ts`/`techRulesService.ts` → `src/lib/supabase.ts:1–14` and bundled into the inlined portable `windows-demo/index.html`, though runtime calls remain safely gated behind `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (`supabase === null` by default, falling back to `localStorage` / `'local-only'`).

### C review of the split issue revisions

ISSUE-N-002a@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | C | APPROVE | 2026-11-28T12:13:09Z | Source trace and executed 199-character boundary/edited-draft control support the narrow issue. See MSG-C-013 and MSG-C-014.

ISSUE-N-002b@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | C | APPROVE | 2026-11-28T12:13:09Z | Confirms current acknowledgment behavior only. Review any proposed change separately. See MSG-C-014.

ISSUE-N-003@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | C | REVISE | 2026-11-28T12:13:09Z | Separate PON presence from source match, and retain the independently tracked K-001 grouping issue. See MSG-C-014.

ISSUE-N-003@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | N | WITHDRAW | 2026-11-28T12:17:13Z | Agree with C's MSG-C-014 REVISE: sourceMatch: 'unpaired' intentionally denotes absence of validated pairing to an independent source (not PON presence), and missing-PON session orderKey conflation is already isolated and resolved by ISSUE-K-001@r1 / FIX-K-001@r1 (3/3 APPROVE). No current consumer requires a separate observed-PON provenance marker; defer any additive provenance field until a concrete consumer and test exist.

## FIX-N-002a@r1 — gate copy and `Send` on live sliding-scale 199-char budget recheck with stale-warning recovery

**Baseline** `04ef96d1c65fde8d055b6d03787ff2ef3038382a` (v0.1.20). Proposed remedy to `ISSUE-N-002a@r1` (`3/3 APPROVE`). Proposed implementer: `C` (after `FIX-N-001@r1` and `FIX-K-001@r1`).

- Evaluate the technician's current sliding-scale draft (single part or split-order group joined with `FRAMEWORK_SPLIT_SEPARATOR`) against the 199-character budget (`Math.max(rawLength, estimatedExpandedLength) <= 199`, reusing `slidingScaleBudget.ts` measurement logic) rather than trusting a static initial-translation `sliding_scale_budget_exceeded` flag.
- Pass the live over-limit state into `copyBlockReason` (`src/lib/reviewPolicy.ts:32–39`) so copy and direct `Send` are blocked with an actionable length message while the current sliding-scale output exceeds 199 characters.
- Stale-warning recovery: When the technician edits the sliding-scale draft so the live recheck passes (`<= 199`), immediately clear the over-limit block and stale over-limit warning so normal `reviewStamp` approval, copy, and `Send` proceed without re-translation. Conversely, if a technician edit pushes a previously fitting sliding-scale draft over 199 characters, re-engage the block.
- Scope boundaries: Applies only to unresolved sliding-scale over-limit drafts (`ISSUE-N-002a@r1`). Does not add a blanket copy block or new checkbox for applied concessions (`ISSUE-N-002b@r1`) and does not alter non-sliding-scale length handling (`N-002c`).
- Paths: `src/lib/clinical/slidingScaleBudget.ts`, `src/lib/reviewPolicy.ts`, the sliding-scale review/queue caller wiring `copyBlockReason`, and unit tests.
- Acceptance: (1) Initial over-199 sliding-scale draft blocks copy and `Send`; (2) technician edit condensing the draft/group to `<= 199` clears the stale over-limit warning and unblocks once approved; (3) technician edit expanding a valid sliding-scale draft `> 199` blocks copy and `Send`; (4) non-sliding-scale drafts and `ISSUE-N-002b@r1` concession behavior remain unchanged.
- Rollback: Focused source revert without modifying stored dataset rows or queue schema.

FIX-N-002a@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | N | APPROVE | 2026-11-28T12:17:13Z | Narrowly remedies ISSUE-N-002a@r1 by gating copyBlockReason on live re-evaluation of the technician-edited sliding-scale draft/group, directly satisfying C's MSG-C-011/MSG-C-013 requirement for edit recheck and stale-warning recovery while leaving ISSUE-N-002b@r1 and N-002c untouched.

FIX-N-002a@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | C | APPROVE | 2026-11-28T12:22:43Z | Measure actual current parts and recover from stale warnings while keeping technician approval. See MSG-C-016.


FIX-N-002a@r1 | 04ef96d1c65fde8d055b6d03787ff2ef3038382a | K | APPROVE | 2026-11-28T12:26:07Z | K approves FIX-N-002a@r1 as proposed by Neon: live 199-char re-evaluation of the technician-edited sliding-scale draft/group in copyBlockReason with immediate stale-warning clearing on valid edits, keeping ISSUE-N-002b@r1 and N-002c strictly separate. Satisfies C's MSG-C-011/MSG-C-013 requirement for edit recheck and stale-warning recovery. No deviation from the approved scope noted.
