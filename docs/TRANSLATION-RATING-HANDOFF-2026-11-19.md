# Optional translation ratings — implementation handoff

Status: design reviewed against prototype `5eca8c8`; **not implemented**. The runtime remains v0.1.13. Preserve this plan rather than rushing a partial storage/UI migration within the remaining conversation budget.

## Technician workflow

Place ten selectable stars immediately below the presented automatic SIG in Queue and Workbench, including split-order review. Show the numeric selected score and accessible labels/keyboard operation. Rating and explanation are optional and never block editing, copying, transfer or moving to the next order. Bind a rating to the specific source revision, presented suggestion and part/regimen being rated, not whichever order is selected when an asynchronous write completes.

| Rating | Report action | Inline choices |
|---|---|---|
| Unrated | No rating-driven discrepancy; outcome unknown | None |
| 10 | No new rating-driven discrepancy | None |
| 6–9 | Immediately preserve a technician-confirmed translation error | The error is obvious; I will briefly explain the error |
| 1–5 | Immediately preserve a technician-confirmed translation error | I don't want to explain the error; I will briefly describe the error; I will give an in-depth explanation of the error; I will explain the error later |

The user's wording mentions three choices but supplies two for the upper band, and excludes 9 in one sentence despite defining every score below 10 as an error. Use the two named choices for 6–9; do not invent a third. A score measures translation quality, not a calibrated clinical-harm severity.

Save a below-ten report on the rating click, before explanation selection or text entry. Obvious/no-explanation reports are valid with empty comments and no corrected SIG yet. Open brief/detailed text inline, without a modal or focus theft. A small punctuation error can be reported with a rating and one quick choice. Failed writes retain the pending snapshot and clearly show that saving failed; retry/export recovery must not require a full write-up or falsely claim success.

## Evidence and report history

Freeze the original evidence locally: PON plus source/order identity, facility where available, revision, drug/strength/form, raw SIG and default template, baseline generated SIG, actual suggestion shown after preferences, current technician draft, split parts, warnings/findings, app/build identity, timestamps, complete effective exclusions/overrides and policy/dictionary identity where available. Distinguish unavailable fields from empty values. Use existing loaded context; do not add network lookups to the rating click.

Append subsequent rating changes, explanation-mode selections, partial/submitted comments, deferral/resumption, technician corrections and actual copied/verified text as timestamped revisions. Preserve earlier snapshots and comments; don't overwrite them with the newest draft or collapse iterations in export/merge. Re-rating a previously reported failure as 10 must retain its earlier history, even though a fresh 10 creates no discrepancy. A copy/transfer remains distinct from an actual Framework save.

For obvious/no-explanation reports, the source-to-suggestion and suggestion-to-final diffs are useful evidence. Capture later corrections for that report at the matching copy/transfer boundary, even if the rating preceded editing. A difference does not by itself prove what the technician intended; an inferred autopsy remains separate from technician statements.

Do not classify ignored ratings as successful translations or include them as explicit tens in success statistics. No new rating-driven report is created for ignored/ten ratings. Preserve the separately authorized passive SIG dataset; it has a different collection purpose. Automatically creating an unrated-edit discrepancy would change this reporting policy and is only a possible future opt-in improvement.

## Deferred explanation queue

Persist queue state with the discrepancy reports. Save the complete original snapshot immediately, not just PON: a live order can disappear or a PON can be reused. Reopen the saved source locally and present original raw SIG, original generated/presented SIG, available technician correction and a fresh retranslation side by side. Label the new build/policy; never replace the original evidence with the new result. Save each explanation/retranslation as another iteration, keeping completed and deferred history exportable. No need to reopen or alter a live prescription to explain a historical error.

## Replace checkpoints without losing working collection

Remove start/checkpoint/stop/bundle steps from routine technician screens. Migrate or expose recovery for any active legacy recording so hiding its panel cannot orphan a recorder or leave its three-second polling running. Preserve existing files, SIG dataset collection and normal diagnostics. Ratings supply translation feedback; they do not implement passive observation of native application actions.

The attached Lovable/Sol recommendation supports a separate event-driven native observer spike. Its persistent WinEvent/UIA listener is still a proposal, not an implemented replacement for the current helper. Keep native observation changes separate from this rating/report migration; avoid coupling rating clicks to desktop scans. FWDirect remains excluded.

## Concrete implementation points and checks

Extend `DiscrepancyReport` in `src/lib/clinical/types.ts` with backward-compatible rating, explanation state and immutable event/snapshot history. Reuse `citrixStorage`, `discrepancyDatabase` and discrepancy exports, checking same-ID merge behavior for concurrent events. The existing `DiscrepancyPanel` requires corrected text or notes, so it cannot directly implement the one-click negative-report path.

Integrate shared rating UI with `SigReviewPanel`, `MultiOrderCards` and their Queue/Workbench callers; pass real source/policy context rather than reconstructing it from display strings. Extend `DiscrepancyArchive` for deferred explanations. Review `AppLayout`, `IntensifiedLogging` and connector pilot lifecycle before removing checkpoint UI. Preserve manual detailed reporting for nontranslation problems.

Test: score boundaries including 9; immediate zero-comment negative saves; no new report for ignored/10; no processing block; order/revision/split isolation; later corrected-copy association; source/policy immutability; append-only rating/comment history including re-rating to 10; deferred reopen without live intake; current-vs-original retranslation; storage failure/retry/reload/export; legacy reports; recorder recovery and independent dataset survival. Commit increments and rebuild/commit portable artifacts with runtime changes. This handoff is documentation only; no runtime tests or package rebuild were needed.
