# Astra functional audit and Sol handoff — 2026-11-16

Baseline: prototype 5ba102ee4a7c76eef7962e69e4c5882efaaf2d8b (v0.1.8). Focused audit, not a fresh exhaustive review of every Drive file or installer. Inspected current translation and observation code, existing tests, treatment cheat sheet, previous capture review and integration audit. Executed seven synthetic variations through translateClinicalSig. No production code changes.

## Verdict

Evidence has been used effectively to identify recorder storage contention and redundant queue translation, but not yet to maximize clinical translation or native field coverage. Passing 1,030 tests does not establish technician acceptance: 108 of the 129 sliding-scale tests are generated variants of a single sentence template. The latest capture is workflow metadata, not semantic source/expected-SIG evidence. Do not infer that it explains the user's reported translation failure rate.

## Highest priority: treatment instructions

Source: src/lib/clinical/treatmentOrderEngine.ts and early return in clinicalEngine.ts. Concrete reproduced defects:

| Synthetic input (product zinc oxide unless noted) | Actual output defect |
| --- | --- |
| Cleanse sacrum with normal saline, pat dry, apply zinc oxide. | Adds QS despite no frequency in the input |
| Cleanse sacrum with normal saline, pat dry, apply zinc oxide daily for 14 days. Notify provider if redness worsens. | Drops 14 days and the entire notification; only applied-correction finding |
| Wound dressing: Cleanse left heel with normal saline, pat dry, apply skin prep to periwound, cover with foam dressing every Monday Wednesday and Friday and as needed for soiling. | Outputs PRN only; drops named weekdays and soiling condition |

The formatter extracts one site/cleanser/application/dressing/wrap and reconstructs in a fixed order. It does not prove all source clauses were represented. clinicalEngine's message nevertheless claims complete instructions retained. Some existing tests explicitly reward omitted application detail, so green snapshots should not define the requirements.

The supplied docs/Treatments Cheat Sheet.docx says application order; ADM TPCL AREA FREQUENCY DIAGNOSIS; TX1/TX2/TX3/TXQS/TXHS; CWDSD/CWNS/CWS&W/CWWC and anatomical codes. Current treatment renderer instead commonly emits TO site:procedure QD/QS. Reconcile this document with later technician corrections and actual dictionary expansions before updating output expectations. Its one-container supply rule (NS exception) belongs to quantity handling, not dose inference.

Next implementation: ordered treatment action list with site, product, schedule, duration, indication, PRN reason and follow-up clauses attached to their owning action. Retain unknown clauses verbatim beside translated clauses. Eliminate the implicit QS fallback; preserve the missing-frequency state. Reuse shared frequency parsing for weekdays and routine/PRN schedules. Keep final SIG editable and technician acceptance plus optional correction/comment simple.

## Next: sliding-scale grammar and partial progress

frequencyEngine enters the scale parser only for literal SLIDING SCALE. The parser's condition grammar excludes ordinary postfix thresholds such as '250 or greater'; glucose mg/dL labels between condition and dose also break its grammar. Fixed dose plus scale and a recheck action explicitly fall back to the entire original source.

Reproduced synthetic cases (drug Insulin Lispro Injection 100 UNIT/ML):

- `Inject subcutaneously before meals for diabetes: blood sugar 150-199 give 1 unit; 200-249 give 2 units; 250 or greater give 3 units.` → generic dose/frequency processing, no structured scale.
- `Inject as per sliding scale: blood glucose 150-199 mg/dL: 1 unit; 200-249 mg/dL: 2 units; 250 or greater: 3 units, subcutaneously before meals for diabetes.` → unchanged uppercase source.
- `Inject 5 units plus sliding scale: 150-199=1 unit;200-249=2 units;250+=3 units, SQ TID for DM` → unchanged uppercase source.
- `Inject as per sliding scale: 150-199=1 unit;200-249=2 units;250+=3 units and recheck blood sugar in 2 hours, SQ TID for DM` → unchanged uppercase source.

Use a small tokenizer and typed intermediate representation: comparison bounds/inclusivity, insulin dose, additive base dose, notifications, hold/protocol/recheck actions and common or per-scale schedule. Detect scale structure with insulin context plus condition/dose bands, not the phrase alone. Track source spans/coverage; translate recognized portions and present unresolved clauses for technician correction rather than discarding all translation progress. Never invent absent regimen values. This is functional correctness, not an extra approval architecture.

Build a compact realistic grammar corpus, including omitted scale heading, tables/newlines, mg/dL, postfix comparisons, fixed-plus-correction, recheck actions, multiple schedules, treatment weekdays, durations and multiple sites. Measure complete translation, useful partial translation and technician-edit burden by category; keep a few examples outside development tests as a holdout. Do not use permutation count as a success rate. Existing discrepancy reports and the cheat sheet should provide the initial corpus; request a few additional failing examples only where those have gaps.

## Native reading: reuse a working technique

Latest capture: 288 readable snapshots, all partial, median ~117 nodes at ~1.2s; six busy attempts. Quantity/days supply/package/start-date controls not exposed. Observe in windows/FrameworkDesktop.cs repeatedly performs Current-property and pattern calls, starts DFS at the same root each sample, and prunes offscreen ancestors. VisibleRows in the SAME file already uses CacheRequest/GetUpdatedCache plus cached properties and handles some offscreen layout wrappers.

Next experiment: cached properties scoped to the active known view, prioritize focused field/entry views, rotate or resume less important traversal, enumerate supported patterns only when a control is first discovered. Keep fresh values for the active view. Measure field reach, latency and changed-value detection on a synthetic large tree and a short workstation example. A monolithic whole-window cache can itself block, so benchmark bounded view/element caching rather than just raising timeouts. No new broad fifteen-minute recording until critical fields appear.

Turn existing PSR actions and checkpoint/native evidence into a small step → active view → fields → action → observable result table. PSR and the latest recording may be different sessions: do not falsely join by timestamps. Installer contracts provide candidate interfaces; demonstrate installed-version callability before treating them as live endpoints. Existing cached UIA/known control IDs are the immediate route; SSRS remains useful for queue discovery and Iguana for source/history. FWDirect remains excluded. E-DC work remains earmarked while SIG automation is the active priority.

## Lovable job for next turn

Submitted to existing Sig-Assist Audit Lab using max_mode=true; accepted asynchronously. Response has NOT been reviewed and no success is presumed.

- Project: https://lovable.dev/projects/766dd189-ff18-4f49-b2d7-f97e8726f577
- Link/account ID: link_6a6e0563fc9881918dd6ac2cf7b6bcc0
- User message ID: umsg_01m7j7922ee3vrxv618hhc4yc6
- Requested artifact: docs/ASTRA-FUNCTIONAL-HANDOFF.md in the separate lab, with optional isolated experiments/tests.
- Provided current treatment/sliding-scale/frequency source, synthetic failures, cheat-sheet rules, observation evidence and implementation theories. No patient captures or credentials sent.
- Sol: fetch this original message's result; do not resend if still running. Review before porting. The lab was instructed not to modify/publish the pharmacy repository or deploy.

Recommended order for Sol: (1) retrieve Lovable handoff; (2) treatment clause retention and schedule bugs; (3) scale grammar/partial translation with real failing examples; (4) cached targeted native observation; (5) one short technician session validating both usefulness and field coverage. Preserve v0.1.8 storage recovery and the visible temporary logging removal marker. Avoid another long round of generic safety architecture or exhaustive reinstall analysis before these functional gains.
